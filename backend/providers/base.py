import re
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

COMPILATION_KEYWORDS = [
    'full album', 'complete album', 'jukebox', 'audio jukebox', 'video jukebox',
    'non stop', 'non-stop', 'nonstop', 'mashup', 'mega mix', 'megamix',
    'compilation', 'best of', 'all songs', 'greatest hits', 'hit collection',
    'songs collection', 'carvaan', 'weekend classic', 'radio show', 'podcast',
    'episode', 'live stream', 'livestream', 'superhit songs', 'top 10 songs',
    'top 20 songs', 'top 50 songs', 'top 100 songs', 'evergreen songs',
    'purane gane', 'full songs jukebox', 'audio songs jukebox', 'disco mix',
    'remix jukebox', 'continuous mix'
]

def is_single_track(title: str, artist: str = '', duration: int = 0) -> bool:
    """
    Returns True ONLY if this track is a genuine single standalone song,
    and False if it is a compilation, full album, jukebox, radio show, or continuous mix.
    """
    title_lower = (title or '').lower()
    artist_lower = (artist or '').lower()
    combined = f"{title_lower} {artist_lower}".strip()

    # Reject tracks with duration longer than 380 seconds (6 minutes 20 seconds)
    if duration and duration > 380:
        return False
    # Reject snippet/preview tracks under 40 seconds
    if duration and duration < 40:
        return False

    for kw in COMPILATION_KEYWORDS:
        if kw in combined:
            return False

    if re.search(r'\b\d+\s*(?:hr|hour|hours)\b', combined):
        return False
    if re.search(r'\b\d{2,}\s+songs\b', combined):
        return False
    if re.search(r'\bradio\s*(?:show|station|broadcast|special)\b', combined):
        return False

    return True

class UnifiedTrack:
    """
    Standardized internal representation of a track across all providers.
    Follows Section 6 of the Master Architecture.
    """
    def __init__(
        self,
        provider_id: str,
        provider_track_id: str,
        title: str,
        artist_name: str,
        album_name: Optional[str] = None,
        genre: Optional[str] = None,
        duration: int = 0,
        artwork_url: Optional[str] = None,
        stream_url: str = "",
        download_url: Optional[str] = None,
        download_allowed: bool = True,
        streaming_allowed: bool = True,
        licence_information: str = "Creative Commons / Open Access",
        licence_url: Optional[str] = None,
        source_name: str = "MusicWave Unified Provider"
    ):
        self.provider_id = provider_id
        self.provider_track_id = str(provider_track_id)
        self.title = title or "Untitled Track"
        self.artist_name = artist_name or "Unknown Artist"
        self.album_name = album_name or "Single"
        self.genre = genre or "General"
        self.duration = max(0, int(duration or 0))
        self.artwork_url = artwork_url or "/static/images/default-cover.png"
        self.stream_url = stream_url
        self.download_url = download_url or stream_url
        self.download_allowed = bool(download_allowed)
        self.streaming_allowed = bool(streaming_allowed)
        self.licence_information = licence_information
        self.licence_url = licence_url
        self.source_name = source_name

    @property
    def version_type(self) -> str:
        text = f"{self.title} {self.album_name or ''}".lower()
        if any(k in text for k in ['lofi', 'lo-fi', 'slowed', 'reverb', 'chillhop', 'ambient chill', 'chillout', 'lo fi']):
            return 'lofi'
        return 'official'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'provider_id': self.provider_id,
            'provider_track_id': self.provider_track_id,
            'title': self.title,
            'artist_name': self.artist_name,
            'album_name': self.album_name,
            'genre': self.genre,
            'duration': self.duration,
            'artwork_url': self.artwork_url,
            'stream_url': self.stream_url,
            'download_url': self.download_url,
            'download_allowed': self.download_allowed,
            'streaming_allowed': self.streaming_allowed,
            'licence_information': self.licence_information,
            'licence_url': self.licence_url,
            'source_name': self.source_name,
            'version_type': self.version_type
        }

class BaseMusicProvider(ABC):
    """Abstract Base Class for external and internal music source adapters."""
    def __init__(self, provider_id: str, name: str):
        self.provider_id = provider_id
        self.name = name

    @abstractmethod
    def search(self, query: str, limit: int = 20) -> List[UnifiedTrack]:
        pass

    @abstractmethod
    def get_trending(self, limit: int = 20) -> List[UnifiedTrack]:
        pass

    @abstractmethod
    def get_by_genre(self, genre: str, limit: int = 20) -> List[UnifiedTrack]:
        pass
