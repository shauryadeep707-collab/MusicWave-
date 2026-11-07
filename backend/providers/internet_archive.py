import requests
import re
from typing import List, Optional
from .base import BaseMusicProvider, UnifiedTrack

class InternetArchiveProvider(BaseMusicProvider):
    """
    Internet Archive audio collection adapter.
    Fetches openly accessible MP3 audio collections and item metadata.
    """
    BASE_SEARCH_URL = "https://archive.org/advancedsearch.php"
    METADATA_URL = "https://archive.org/metadata"
    DOWNLOAD_BASE_URL = "https://archive.org/download"

    def __init__(self):
        super().__init__("internet_archive", "Internet Archive")

    def _query_archive(self, query: str, limit: int = 15, sort: str = "downloads desc") -> List[UnifiedTrack]:
        params = {
            'q': f'mediatype:audio AND (collection:audio_music OR collection:freemusicarchive OR {query})',
            'fl[]': ['identifier', 'title', 'creator', 'year', 'description', 'format'],
            'sort[]': sort,
            'rows': limit,
            'page': 1,
            'output': 'json'
        }
        
        try:
            resp = requests.get(self.BASE_SEARCH_URL, params=params, timeout=7)
            if resp.status_code != 200:
                return []
            docs = resp.json().get('response', {}).get('docs', [])
        except Exception as e:
            print(f"[Internet Archive Provider Search Error]: {e}")
            return []

        tracks = []
        for doc in docs:
            ident = doc.get('identifier')
            if not ident:
                continue
            
            track = self._resolve_track_files(ident, doc)
            if track:
                tracks.append(track)
                if len(tracks) >= limit:
                    break

        return tracks

    def _resolve_track_files(self, ident: str, doc: dict) -> Optional[UnifiedTrack]:
        """Fetch metadata for files in archive item and find the primary MP3 audio."""
        try:
            meta_resp = requests.get(f"{self.METADATA_URL}/{ident}/files", timeout=5)
            if meta_resp.status_code != 200:
                return None
            files = meta_resp.json().get('result', [])
            mp3_files = [f for f in files if f.get('name', '').lower().endswith('.mp3')]
            if not mp3_files:
                return None

            # Pick the primary MP3 file (prefer VBR or highest bitrate)
            chosen_file = mp3_files[0]
            for f in mp3_files:
                if 'vbr' in f.get('format', '').lower():
                    chosen_file = f
                    break

            file_name = chosen_file.get('name')
            raw_title = chosen_file.get('title') or doc.get('title') or ident
            clean_title = re.sub(r'[_]+', ' ', raw_title).strip()
            artist = doc.get('creator') or chosen_file.get('creator') or 'Archive Artist'
            
            # Duration in seconds
            raw_duration = chosen_file.get('length')
            duration = int(float(raw_duration)) if raw_duration else 210

            stream_url = f"{self.DOWNLOAD_BASE_URL}/{ident}/{file_name}"
            artwork_url = f"https://archive.org/services/img/{ident}"

            return UnifiedTrack(
                provider_id=self.provider_id,
                provider_track_id=f"{ident}_{file_name}",
                title=clean_title,
                artist_name=artist,
                album_name=doc.get('title') or 'Internet Archive Collection',
                genre="Open Audio",
                duration=duration,
                artwork_url=artwork_url,
                stream_url=stream_url,
                download_url=stream_url,
                download_allowed=True,
                streaming_allowed=True,
                licence_information="Public Domain / Creative Commons",
                licence_url=f"https://archive.org/details/{ident}",
                source_name="Internet Archive"
            )
        except Exception as e:
            return None

    def search(self, query: str, limit: int = 15) -> List[UnifiedTrack]:
        sanitized = re.sub(r'[^\w\s]', '', query).strip()
        if not sanitized:
            return []
        q = f'title:({sanitized}) OR creator:({sanitized}) OR description:({sanitized})'
        return self._query_archive(q, limit=limit, sort="downloads desc")

    def get_trending(self, limit: int = 15) -> List[UnifiedTrack]:
        return self._query_archive("collection:freemusicarchive", limit=limit, sort="downloads desc")

    def get_by_genre(self, genre: str, limit: int = 15) -> List[UnifiedTrack]:
        sanitized = re.sub(r'[^\w\s]', '', genre).strip()
        q = f'collection:audio_music AND (subject:({sanitized}) OR title:({sanitized}))'
        return self._query_archive(q, limit=limit, sort="downloads desc")
