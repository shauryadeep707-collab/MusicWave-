from typing import List, Dict, Any, Optional
from backend.database.db import query_db, execute_db, is_postgres
from .base import UnifiedTrack
from .internet_archive import InternetArchiveProvider
from .jamendo import JamendoProvider
from .local_vault import LocalVaultProvider

class MusicService:
    """
    Unified Music Service: Aggregates multiple external music providers,
    synchronizes tracks with the database cache, and ensures high availability.
    """
    def __init__(self):
        self.providers = {
            'local': LocalVaultProvider(),
            'internet_archive': InternetArchiveProvider(),
            'jamendo': JamendoProvider()
        }

    def _persist_tracks(self, tracks: List[UnifiedTrack]) -> List[Dict[str, Any]]:
        """Persist or update discovered tracks in the database and return unified dicts with internal database IDs."""
        persisted = []
        is_pg = is_postgres()

        for track in tracks:
            # Check if track already exists in database
            existing = query_db(
                "SELECT * FROM tracks WHERE provider_id = ? AND provider_track_id = ?",
                (track.provider_id, track.provider_track_id),
                one=True
            )

            if existing:
                persisted.append(existing)
                continue

            try:
                if is_pg:
                    execute_db("""
                        INSERT INTO tracks (
                            provider_id, provider_track_id, title, artist_name, album_name,
                            genre, duration, artwork_url, stream_url, download_url,
                            download_allowed, streaming_allowed, licence_information, licence_url, source_name
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (provider_id, provider_track_id) DO NOTHING
                    """, (
                        track.provider_id, track.provider_track_id, track.title, track.artist_name, track.album_name,
                        track.genre, track.duration, track.artwork_url, track.stream_url, track.download_url,
                        track.download_allowed, track.streaming_allowed, track.licence_information, track.licence_url, track.source_name
                    ))
                else:
                    execute_db("""
                        INSERT OR IGNORE INTO tracks (
                            provider_id, provider_track_id, title, artist_name, album_name,
                            genre, duration, artwork_url, stream_url, download_url,
                            download_allowed, streaming_allowed, licence_information, licence_url, source_name
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        track.provider_id, track.provider_track_id, track.title, track.artist_name, track.album_name,
                        track.genre, track.duration, track.artwork_url, track.stream_url, track.download_url,
                        track.download_allowed, track.streaming_allowed, track.licence_information, track.licence_url, track.source_name
                    ))

                saved = query_db(
                    "SELECT * FROM tracks WHERE provider_id = ? AND provider_track_id = ?",
                    (track.provider_id, track.provider_track_id),
                    one=True
                )
                if saved:
                    persisted.append(saved)
                else:
                    persisted.append(track.to_dict())
            except Exception as e:
                print(f"[Track Persistence Warning]: {e}")
                persisted.append(track.to_dict())

        return persisted

    def search(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Search across local vault, database cache, and live external providers."""
        query = query.strip()
        if not query:
            return []

        # 1. Search existing local database cache first
        pattern = f"%{query}%"
        cached_results = query_db("""
            SELECT * FROM tracks
            WHERE title LIKE ? OR artist_name LIKE ? OR album_name LIKE ? OR genre LIKE ?
            ORDER BY play_count DESC
            LIMIT ?
        """, (pattern, pattern, pattern, pattern, limit))

        # 2. Query active providers in parallel/sequence
        provider_tracks = []
        for pid, provider in self.providers.items():
            try:
                tracks = provider.search(query, limit=10)
                provider_tracks.extend(tracks)
            except Exception as e:
                print(f"[Provider '{pid}' search failed]: {e}")

        # Persist newly discovered tracks
        newly_persisted = self._persist_tracks(provider_tracks)

        # Merge and deduplicate by (provider_id, provider_track_id)
        seen = set()
        merged = []
        for t in cached_results + newly_persisted:
            key = (t.get('provider_id'), t.get('provider_track_id'))
            if key not in seen:
                seen.add(key)
                merged.append(t)
            if len(merged) >= limit:
                break

        return merged

    def get_trending(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve trending songs across all open legal music providers."""
        provider_tracks = []
        for pid, provider in self.providers.items():
            try:
                tracks = provider.get_trending(limit=10)
                provider_tracks.extend(tracks)
            except Exception as e:
                print(f"[Provider '{pid}' trending failed]: {e}")

        persisted = self._persist_tracks(provider_tracks)

        # Fetch from database ordered by play_count
        db_tracks = query_db("SELECT * FROM tracks ORDER BY play_count DESC, id DESC LIMIT ?", (limit,))
        
        seen = set()
        results = []
        for t in db_tracks + persisted:
            key = (t.get('provider_id'), t.get('provider_track_id'))
            if key not in seen:
                seen.add(key)
                results.append(t)
            if len(results) >= limit:
                break
        return results

    def get_by_genre(self, genre: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve tracks filtered by a specific music genre."""
        # Check cache
        pattern = f"%{genre}%"
        cached = query_db("SELECT * FROM tracks WHERE genre LIKE ? LIMIT ?", (pattern, limit))
        
        if len(cached) >= limit:
            return cached

        # Fetch more from providers
        provider_tracks = []
        for pid, provider in self.providers.items():
            try:
                tracks = provider.get_by_genre(genre, limit=8)
                provider_tracks.extend(tracks)
            except Exception as e:
                pass

        persisted = self._persist_tracks(provider_tracks)
        seen = set()
        results = []
        for t in cached + persisted:
            key = (t.get('provider_id'), t.get('provider_track_id'))
            if key not in seen:
                seen.add(key)
                results.append(t)
            if len(results) >= limit:
                break
        return results

    def get_recommendations(self, genre: Optional[str] = None, limit: int = 15) -> List[Dict[str, Any]]:
        """Generate smart recommendations based on genre preference or popularity."""
        if genre:
            return self.get_by_genre(genre, limit=limit)
        
        tracks = query_db("SELECT * FROM tracks ORDER BY RANDOM() LIMIT ?", (limit,))
        if not tracks:
            return self.get_trending(limit=limit)
        return tracks

# Singleton Instance
music_service = MusicService()
