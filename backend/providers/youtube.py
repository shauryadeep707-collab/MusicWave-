import re
import json
import requests
from typing import Optional, List
from .base import BaseMusicProvider, UnifiedTrack

class YouTubeProvider(BaseMusicProvider):
    """
    Direct YouTube Provider with Zero API Key needed.
    Supports:
    1. Direct link / Video ID extraction & oEmbed resolution.
    2. Live keyword search across all YouTube Music (Bollywood, Punjabi, Pop, Hip-Hop, etc.)
    """
    OEMBED_URL = "https://www.youtube.com/oembed"
    SEARCH_URL = "https://www.youtube.com/results"
    YOUTUBE_REGEX = re.compile(
        r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
    )
    USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    def __init__(self):
        super().__init__("youtube", "YouTube Music")

    @classmethod
    def extract_id(cls, text: str) -> Optional[str]:
        """Extract 11-character YouTube video ID from URL or raw ID."""
        text = text.strip()
        if len(text) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', text):
            return text
        match = cls.YOUTUBE_REGEX.search(text)
        return match.group(1) if match else None

    def fetch_track(self, video_id_or_url: str) -> Optional[UnifiedTrack]:
        """Fetch video metadata using YouTube public oEmbed."""
        video_id = self.extract_id(video_id_or_url)
        if not video_id:
            return None

        video_url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            resp = requests.get(
                self.OEMBED_URL,
                params={'url': video_url, 'format': 'json'},
                timeout=6
            )
            if resp.status_code != 200:
                return None
            data = resp.json()

            raw_title = data.get('title', 'YouTube Track')
            author = data.get('author_name', 'YouTube Artist')

            clean_title = raw_title
            artist_name = author
            if " - " in raw_title:
                parts = raw_title.split(" - ", 1)
                artist_name = parts[0].strip()
                clean_title = parts[1].strip()

            clean_title = re.sub(r'\(Official\s*(Video|Audio|Music Video|HD|4K).*?\)', '', clean_title, flags=re.IGNORECASE).strip()
            clean_title = re.sub(r'\[Official\s*(Video|Audio|Music Video|HD|4K).*?\]', '', clean_title, flags=re.IGNORECASE).strip()

            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

            return UnifiedTrack(
                provider_id=self.provider_id,
                provider_track_id=video_id,
                title=clean_title or raw_title,
                artist_name=artist_name,
                album_name="YouTube Single",
                genre="YouTube Music",
                duration=210,
                artwork_url=thumbnail,
                stream_url=video_id,
                download_url=None,
                download_allowed=False,
                streaming_allowed=True,
                licence_information="Standard YouTube License",
                licence_url=video_url,
                source_name="YouTube"
            )
        except Exception as e:
            print(f"[YouTube Provider fetch error for {video_id}]: {e}")
            return None

    def search(self, query: str, limit: int = 15) -> List[UnifiedTrack]:
        """
        Live search across YouTube for any song name or artist.
        Zero API key required.
        """
        query = query.strip()
        if not query:
            return []

        # If direct link or video ID, resolve directly
        video_id = self.extract_id(query)
        if video_id:
            t = self.fetch_track(video_id)
            return [t] if t else []

        query_lower = query.lower()
        if any(term in query_lower for term in ['lofi', 'lo-fi', 'slowed', 'reverb', 'chill', 'remix', 'official', 'audio', 'video', 'cover']):
            search_query = query
        else:
            search_query = f"{query} song"
        encoded = requests.utils.quote(search_query)
        headers = {
            'User-Agent': self.USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9'
        }

        try:
            resp = requests.get(f"{self.SEARCH_URL}?search_query={encoded}", headers=headers, timeout=8)
            if resp.status_code != 200:
                return []
            html = resp.text

            match = re.search(r'var ytInitialData = ({.*?});</script>', html)
            if not match:
                match = re.search(r'window\["ytInitialData"\] = ({.*?});', html)
            if not match:
                return []

            data = json.loads(match.group(1))
            contents = data.get('contents', {}).get('twoColumnSearchResultsRenderer', {}).get('primaryContents', {}).get('sectionListRenderer', {}).get('contents', [])

            tracks = []
            for section in contents:
                items = section.get('itemSectionRenderer', {}).get('contents', [])
                for item in items:
                    v = item.get('videoRenderer')
                    if v and v.get('videoId'):
                        vid = v['videoId']
                        raw_title = v.get('title', {}).get('runs', [{}])[0].get('text', 'Unknown Song')
                        channel = v.get('ownerText', {}).get('runs', [{}])[0].get('text', 'YouTube Artist')

                        # Parse duration string (e.g. "3:45" or "1:02:15") to seconds
                        duration_str = v.get('lengthText', {}).get('simpleText', '3:30')
                        duration_secs = self._parse_duration(duration_str)

                        clean_title = raw_title
                        artist_name = channel
                        if " - " in raw_title:
                            parts = raw_title.split(" - ", 1)
                            artist_name = parts[0].strip()
                            clean_title = parts[1].strip()

                        clean_title = re.sub(r'\(Official\s*(Video|Audio|Music Video|Lyric Video|HD|4K|Visualizer).*?\)', '', clean_title, flags=re.IGNORECASE).strip()
                        clean_title = re.sub(r'\[Official\s*(Video|Audio|Music Video|Lyric Video|HD|4K|Visualizer).*?\]', '', clean_title, flags=re.IGNORECASE).strip()

                        track = UnifiedTrack(
                            provider_id=self.provider_id,
                            provider_track_id=vid,
                            title=clean_title or raw_title,
                            artist_name=artist_name,
                            album_name="YouTube Music",
                            genre="YouTube Music",
                            duration=duration_secs,
                            artwork_url=f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                            stream_url=vid,
                            download_url=None,
                            download_allowed=False,
                            streaming_allowed=True,
                            licence_information="Standard YouTube License",
                            licence_url=f"https://www.youtube.com/watch?v={vid}",
                            source_name="YouTube"
                        )
                        tracks.append(track)
                        if len(tracks) >= limit:
                            break
                if len(tracks) >= limit:
                    break

            return tracks
        except Exception as e:
            print(f"[YouTube Live Search Error]: {e}")
            return []

    def _parse_duration(self, dur_str: str) -> int:
        try:
            parts = [int(p) for p in dur_str.split(':')]
            if len(parts) == 3:
                return parts[0] * 3600 + parts[1] * 60 + parts[2]
            elif len(parts) == 2:
                return parts[0] * 60 + parts[1]
            return 210
        except Exception:
            return 210

    def get_trending(self, limit: int = 15) -> List[UnifiedTrack]:
        return self.search("trending top hits songs", limit=limit)

    def get_by_genre(self, genre: str, limit: int = 15) -> List[UnifiedTrack]:
        return self.search(f"{genre} top songs hits", limit=limit)
