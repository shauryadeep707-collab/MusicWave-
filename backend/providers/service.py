from typing import List, Dict, Any, Optional
from backend.database.db import query_db, execute_db, is_postgres
from .base import UnifiedTrack, is_single_track
from .internet_archive import InternetArchiveProvider
from .jamendo import JamendoProvider
from .local_vault import LocalVaultProvider
from .youtube import YouTubeProvider

class MusicService:
    """
    Unified Music Service: Aggregates multiple external music providers,
    supports direct YouTube link import, synchronizes tracks with the database cache,
    and ensures high availability.
    """
    def __init__(self):
        self.providers = {
            'local': LocalVaultProvider(),
            'internet_archive': InternetArchiveProvider(),
            'jamendo': JamendoProvider(),
            'youtube': YouTubeProvider()
        }

    def _persist_tracks(self, tracks: List[Any]) -> List[Dict[str, Any]]:
        """Persist or update discovered tracks in the database and return unified dicts with internal database IDs."""
        persisted = []
        is_pg = is_postgres()

        for track in tracks:
            is_dict = isinstance(track, dict)
            provider_id = track.get('provider_id') if is_dict else getattr(track, 'provider_id', '')
            provider_track_id = track.get('provider_track_id') if is_dict else getattr(track, 'provider_track_id', '')
            if not provider_id or not provider_track_id:
                continue

            # Check if track already exists in database
            existing = query_db(
                "SELECT * FROM tracks WHERE provider_id = ? AND provider_track_id = ?",
                (provider_id, provider_track_id),
                one=True
            )

            if existing:
                persisted.append(existing)
                continue

            title = track.get('title') if is_dict else getattr(track, 'title', 'Untitled')
            artist_name = track.get('artist_name') if is_dict else getattr(track, 'artist_name', 'Unknown')
            album_name = track.get('album_name') if is_dict else getattr(track, 'album_name', '')
            genre = track.get('genre') if is_dict else getattr(track, 'genre', '')
            duration = track.get('duration') if is_dict else getattr(track, 'duration', 0)

            # Strictly reject compilations, multi-hour albums, jukeboxes, and radio shows
            if not is_single_track(title, artist_name, duration):
                continue
            artwork_url = track.get('artwork_url') if is_dict else getattr(track, 'artwork_url', '')
            stream_url = track.get('stream_url') if is_dict else getattr(track, 'stream_url', '')
            download_url = track.get('download_url') if is_dict else getattr(track, 'download_url', '')
            download_allowed = bool(track.get('download_allowed', True) if is_dict else getattr(track, 'download_allowed', True))
            streaming_allowed = bool(track.get('streaming_allowed', True) if is_dict else getattr(track, 'streaming_allowed', True))
            licence_information = track.get('licence_information') if is_dict else getattr(track, 'licence_information', '')
            licence_url = track.get('licence_url') if is_dict else getattr(track, 'licence_url', '')
            source_name = track.get('source_name') if is_dict else getattr(track, 'source_name', '')

            try:
                execute_db("""
                    INSERT INTO tracks (
                        provider_id, provider_track_id, title, artist_name, album_name,
                        genre, duration, artwork_url, stream_url, download_url,
                        download_allowed, streaming_allowed, licence_information, licence_url, source_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (provider_id, provider_track_id) DO NOTHING
                """, (
                    provider_id, provider_track_id, title, artist_name, album_name,
                    genre, duration, artwork_url, stream_url, download_url,
                    download_allowed, streaming_allowed, licence_information, licence_url, source_name
                ))

                saved = query_db(
                    "SELECT * FROM tracks WHERE provider_id = ? AND provider_track_id = ?",
                    (provider_id, provider_track_id),
                    one=True
                )
                if saved:
                    persisted.append(saved)
                else:
                    persisted.append(track if is_dict else track.to_dict())
            except Exception as e:
                print(f"[Track Persistence Warning]: {e}")
                persisted.append(track if is_dict else track.to_dict())

        return persisted

    def _async_persist(self, tracks: List[UnifiedTrack], app=None):
        """Persist tracks in background without blocking API response, ensuring database connections are returned to pool."""
        if app:
            with app.app_context():
                try:
                    self._persist_tracks(tracks)
                except Exception as e:
                    print(f"[Async Persistence Background Notice]: {e}")
        else:
            try:
                self._persist_tracks(tracks)
            except Exception as e:
                print(f"[Async Persistence Background Notice]: {e}")

    def import_youtube(self, url_or_id: str) -> Optional[Dict[str, Any]]:
        """Directly import any YouTube song by link or ID."""
        yt_provider: YouTubeProvider = self.providers.get('youtube')
        if not yt_provider:
            return None
        track = yt_provider.fetch_track(url_or_id)
        if not track:
            return None
        persisted_list = self._persist_tracks([track])
        return persisted_list[0] if persisted_list else track.to_dict()

    def search(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Search across local cache, YouTube links, and live external providers in parallel."""
        query = query.strip()
        if not query:
            return []

        # Check if query is a direct YouTube link or ID
        yt_provider: YouTubeProvider = self.providers.get('youtube')
        if yt_provider and yt_provider.extract_id(query):
            yt_track = self.import_youtube(query)
            if yt_track:
                return [yt_track]

        # 1. Search existing local database cache first (instant)
        pattern = f"%{query}%"
        cached_results = query_db("""
            SELECT * FROM tracks
            WHERE title LIKE ? OR artist_name LIKE ? OR album_name LIKE ? OR genre LIKE ?
            ORDER BY play_count DESC
            LIMIT ?
        """, (pattern, pattern, pattern, pattern, limit))

        # 2. Query active providers concurrently with ThreadPoolExecutor
        provider_tracks = []
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import threading

        def fetch_provider(pid):
            p = self.providers.get(pid)
            if not p:
                return []
            try:
                return p.search(query, limit=12)
            except Exception as e:
                return []

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(fetch_provider, pid): pid
                for pid in ['youtube', 'local', 'jamendo']
            }
            try:
                for fut in as_completed(futures, timeout=3.5):
                    try:
                        res = fut.result()
                        if res:
                            provider_tracks.extend(res)
                    except Exception:
                        pass
            except Exception:
                pass

        # Convert UnifiedTrack objects to dicts instantly
        track_dicts = []
        for t in provider_tracks:
            if hasattr(t, 'to_dict'):
                track_dicts.append(t.to_dict())
            elif isinstance(t, dict):
                track_dicts.append(t)

        # Merge and deduplicate by (provider_id, provider_track_id)
        seen = set()
        merged = []
        for t in cached_results + track_dicts:
            key = (t.get('provider_id'), t.get('provider_track_id'))
            if key not in seen:
                seen.add(key)
                merged.append(t)
            if len(merged) >= limit:
                break

        # Persist newly discovered tracks in background thread without delaying user
        if provider_tracks:
            try:
                from flask import current_app
                app_ref = current_app._get_current_object()
            except Exception:
                app_ref = None

            threading.Thread(
                target=self._async_persist,
                args=(provider_tracks, app_ref),
                daemon=True
            ).start()

        return merged

    def get_trending(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve trending songs instantly from cache/database, refreshing providers asynchronously in background."""
        import time
        now = time.time()
        if hasattr(self, '_trending_cache') and self._trending_cache and (now - getattr(self, '_trending_cache_time', 0) < 300):
            return self._trending_cache[:limit]

        # 1. Fetch from database first (instant ~10ms)
        db_tracks = query_db("SELECT * FROM tracks ORDER BY play_count DESC, id DESC LIMIT ?", (limit,))
        if db_tracks and len(db_tracks) >= 8:
            self._trending_cache = db_tracks
            self._trending_cache_time = now
            return db_tracks[:limit]

        # 2. Fast provider fetch (local + youtube only, skipping slow external scrapers on main thread)
        provider_tracks = []
        for pid in ['local', 'youtube']:
            provider = self.providers.get(pid)
            if provider:
                try:
                    tracks = provider.get_trending(limit=8)
                    provider_tracks.extend(tracks)
                except Exception as e:
                    pass

        track_dicts = [t.to_dict() if hasattr(t, 'to_dict') else t for t in provider_tracks]
        seen = set()
        results = []
        for t in (db_tracks or []) + track_dicts:
            key = (t.get('provider_id'), t.get('provider_track_id'))
            if key not in seen and is_single_track(t.get('title'), t.get('artist_name'), t.get('duration', 0)):
                seen.add(key)
                results.append(t)
            if len(results) >= limit:
                break

        self._trending_cache = results
        self._trending_cache_time = now

        # Persist newly discovered tracks in background thread without delaying user
        if provider_tracks:
            try:
                from flask import current_app
                app_ref = current_app._get_current_object()
            except Exception:
                app_ref = None

            import threading
            threading.Thread(
                target=self._async_persist,
                args=(provider_tracks, app_ref),
                daemon=True
            ).start()

        return results

    def get_by_genre(self, genre: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve tracks filtered by a specific music genre with fast database-first retrieval."""
        pattern = f"%{genre}%"
        cached = query_db("SELECT * FROM tracks WHERE genre LIKE ? ORDER BY play_count DESC LIMIT ?", (pattern, limit))
        
        if cached and len(cached) >= 4:
            return cached

        provider_tracks = []
        for pid in ['local', 'youtube']:
            provider = self.providers.get(pid)
            if provider:
                try:
                    tracks = provider.get_by_genre(genre, limit=8)
                    provider_tracks.extend(tracks)
                except Exception as e:
                    pass

        track_dicts = [t.to_dict() if hasattr(t, 'to_dict') else t for t in provider_tracks]
        seen = set()
        results = []
        for t in (cached or []) + track_dicts:
            key = (t.get('provider_id'), t.get('provider_track_id'))
            if key not in seen and is_single_track(t.get('title'), t.get('artist_name'), t.get('duration', 0)):
                seen.add(key)
                results.append(t)
            if len(results) >= limit:
                break

        if provider_tracks:
            try:
                from flask import current_app
                app_ref = current_app._get_current_object()
            except Exception:
                app_ref = None

            import threading
            threading.Thread(
                target=self._async_persist,
                args=(provider_tracks, app_ref),
                daemon=True
            ).start()

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
