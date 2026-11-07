from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

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
            'source_name': self.source_name
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
