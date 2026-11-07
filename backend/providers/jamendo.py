import requests
from typing import List
from config import Config
from .base import BaseMusicProvider, UnifiedTrack

class JamendoProvider(BaseMusicProvider):
    """
    Jamendo Music API v3.0 adapter.
    Documentation: https://developer.jamendo.com/
    """
    BASE_URL = "https://api.jamendo.com/v3.0/tracks/"

    def __init__(self):
        super().__init__("jamendo", "Jamendo Music")
        self.client_id = Config.JAMENDO_CLIENT_ID or ""

    def _call_api(self, params: dict) -> List[UnifiedTrack]:
        if not self.client_id:
            # Client ID not provided yet in env
            return []

        default_params = {
            'client_id': self.client_id,
            'format': 'json',
            'audioformat': 'mp32',
            'include': 'musicinfo+licenses'
        }
        default_params.update(params)

        try:
            resp = requests.get(self.BASE_URL, params=default_params, timeout=6)
            if resp.status_code != 200:
                return []
            data = resp.json()
            results = data.get('results', [])
        except Exception as e:
            print(f"[Jamendo API Error]: {e}")
            return []

        tracks = []
        for item in results:
            track = UnifiedTrack(
                provider_id=self.provider_id,
                provider_track_id=str(item.get('id')),
                title=item.get('name', 'Untitled'),
                artist_name=item.get('artist_name', 'Jamendo Artist'),
                album_name=item.get('album_name', 'Single'),
                genre=item.get('musicinfo', {}).get('vocalinstrumental', 'Music'),
                duration=int(item.get('duration', 0)),
                artwork_url=item.get('album_image') or item.get('image') or "/static/images/default-cover.png",
                stream_url=item.get('audio', ''),
                download_url=item.get('audiodownload') if item.get('audiodownload_allowed') else None,
                download_allowed=bool(item.get('audiodownload_allowed', False)),
                streaming_allowed=True,
                licence_information=item.get('license_ccurl', 'Creative Commons'),
                licence_url=item.get('license_ccurl'),
                source_name="Jamendo Music"
            )
            if track.stream_url:
                tracks.append(track)
        return tracks

    def search(self, query: str, limit: int = 20) -> List[UnifiedTrack]:
        return self._call_api({'namesearch': query, 'limit': limit, 'order': 'popularity_total'})

    def get_trending(self, limit: int = 20) -> List[UnifiedTrack]:
        return self._call_api({'limit': limit, 'order': 'popularity_month', 'featured': 1})

    def get_by_genre(self, genre: str, limit: int = 20) -> List[UnifiedTrack]:
        return self._call_api({'tags': genre.lower(), 'limit': limit, 'order': 'popularity_total'})
