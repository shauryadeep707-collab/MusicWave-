from flask import Blueprint, jsonify, request
import re
from backend.database.db import query_db, execute_db
from backend.providers import music_service

music_bp = Blueprint('music', __name__, url_prefix='/api/music')

def tag_track_version(track: dict) -> dict:
    if not track:
        return track
    if 'version_type' not in track or not track.get('version_type'):
        title = track.get('title', '')
        album = track.get('album_name', '')
        text = f"{title} {album}".lower()
        if any(k in text for k in ['lofi', 'lo-fi', 'slowed', 'reverb', 'chillhop', 'ambient chill', 'chillout', 'lo fi']):
            track['version_type'] = 'lofi'
        else:
            track['version_type'] = 'official'
    return track

@music_bp.route('/genres', methods=['GET'])
def get_genres():
    """Retrieve all active genres with accents and artwork."""
    genres = query_db("SELECT * FROM genres WHERE is_active = 1 ORDER BY name ASC")
    return jsonify({'genres': genres}), 200

@music_bp.route('/trending', methods=['GET'])
def get_trending():
    """Retrieve trending tracks dynamically from unified providers."""
    limit = int(request.args.get('limit', 20))
    tracks = music_service.get_trending(limit=limit)
    for t in tracks:
        tag_track_version(t)
    return jsonify({'tracks': tracks}), 200

@music_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Lightweight recommendation based on genres and popularity."""
    genre = request.args.get('genre')
    limit = int(request.args.get('limit', 15))
    tracks = music_service.get_recommendations(genre=genre, limit=limit)
    for t in tracks:
        tag_track_version(t)
    return jsonify({'recommendations': tracks}), 200

@music_bp.route('/search', methods=['GET'])
def search_tracks():
    """Universal search across local cache, database, and external providers."""
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'results': [], 'query': ''}), 200
    
    limit = int(request.args.get('limit', 25))
    tracks = music_service.search(q, limit=limit)
    for t in tracks:
        tag_track_version(t)
    return jsonify({'results': tracks, 'query': q}), 200

@music_bp.route('/versions', methods=['GET'])
def get_track_versions():
    """
    Retrieve both Official Version and Lo-Fi Version for any song.
    Query params:
      q: song title or search phrase
      artist: optional artist name
    """
    q = request.args.get('q', '').strip()
    artist = request.args.get('artist', '').strip()
    if not q:
        return jsonify({'error': 'Song title or query required'}), 400

    clean_q = q
    clean_q = re.sub(r'\(.*?\)|\[.*?\]', '', clean_q).strip()
    clean_q = re.sub(r'\b(lofi|lo-fi|slowed|reverb|official|song|audio|video)\b', '', clean_q, flags=re.IGNORECASE).strip()
    search_base = f"{clean_q} {artist}".strip() or q

    # 1. Directly query YouTube provider for ultra-fast response
    yt_provider = music_service.providers.get('youtube')
    if yt_provider:
        try:
            off_tracks = yt_provider.search(f"{search_base} official audio", limit=3)
            lofi_tracks = yt_provider.search(f"{search_base} lofi slowed chill", limit=3)
            official_candidates = music_service._persist_tracks(off_tracks)
            lofi_candidates = music_service._persist_tracks(lofi_tracks)
        except Exception:
            official_candidates = music_service.search(f"{search_base} official", limit=3)
            lofi_candidates = music_service.search(f"{search_base} lofi slowed", limit=3)
    else:
        official_candidates = music_service.search(f"{search_base} official", limit=3)
        lofi_candidates = music_service.search(f"{search_base} lofi slowed", limit=3)

    for t in official_candidates:
        t['version_type'] = 'official'
    for t in lofi_candidates:
        t['version_type'] = 'lofi'

    best_official = official_candidates[0] if official_candidates else None
    best_lofi = lofi_candidates[0] if lofi_candidates else None

    return jsonify({
        'query': q,
        'base_song': clean_q,
        'official_version': best_official,
        'lofi_version': best_lofi,
        'official_list': official_candidates,
        'lofi_list': lofi_candidates
    }), 200

@music_bp.route('/youtube/import', methods=['POST'])
def import_youtube_track():
    """Import any YouTube music track by link or video ID."""
    data = request.get_json() or {}
    url_or_id = data.get('url') or data.get('id') or ''
    if not url_or_id:
        return jsonify({'error': 'YouTube URL or video ID is required'}), 400

    track = music_service.import_youtube(url_or_id)
    if not track:
        return jsonify({'error': 'Could not extract metadata for this YouTube link. Please ensure it is a valid public video.'}), 404

    tag_track_version(track)
    return jsonify({'message': 'YouTube track imported successfully', 'track': track}), 200

@music_bp.route('/genre/<genre_name>', methods=['GET'])
def get_tracks_by_genre(genre_name):
    """Retrieve tracks for a given genre category."""
    limit = int(request.args.get('limit', 25))
    tracks = music_service.get_by_genre(genre_name, limit=limit)
    for t in tracks:
        tag_track_version(t)
    return jsonify({'genre': genre_name, 'tracks': tracks}), 200

@music_bp.route('/track/<int:track_id>', methods=['GET'])
def get_track_details(track_id):
    """Retrieve specific track details."""
    track = query_db("SELECT * FROM tracks WHERE id = ?", (track_id,), one=True)
    if not track:
        return jsonify({'error': 'Track not found'}), 404
    tag_track_version(track)
    return jsonify({'track': track}), 200

@music_bp.route('/track/<int:track_id>/play', methods=['POST'])
def record_track_play(track_id):
    """Increment play counter and record history."""
    execute_db("UPDATE tracks SET play_count = play_count + 1 WHERE id = ?", (track_id,))
    return jsonify({'status': 'recorded'}), 200
