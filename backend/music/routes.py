from flask import Blueprint, jsonify, request
from backend.database.db import query_db, execute_db
from backend.providers import music_service

music_bp = Blueprint('music', __name__, url_prefix='/api/music')

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
    return jsonify({'tracks': tracks}), 200

@music_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Lightweight recommendation based on genres and popularity."""
    genre = request.args.get('genre')
    limit = int(request.args.get('limit', 15))
    tracks = music_service.get_recommendations(genre=genre, limit=limit)
    return jsonify({'recommendations': tracks}), 200

@music_bp.route('/search', methods=['GET'])
def search_tracks():
    """Universal search across local cache, database, and external providers."""
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'results': [], 'query': ''}), 200
    
    limit = int(request.args.get('limit', 25))
    tracks = music_service.search(q, limit=limit)
    return jsonify({'results': tracks, 'query': q}), 200

@music_bp.route('/genre/<genre_name>', methods=['GET'])
def get_tracks_by_genre(genre_name):
    """Retrieve tracks for a given genre category."""
    limit = int(request.args.get('limit', 25))
    tracks = music_service.get_by_genre(genre_name, limit=limit)
    return jsonify({'genre': genre_name, 'tracks': tracks}), 200

@music_bp.route('/track/<int:track_id>', methods=['GET'])
def get_track_details(track_id):
    """Retrieve specific track details."""
    track = query_db("SELECT * FROM tracks WHERE id = ?", (track_id,), one=True)
    if not track:
        return jsonify({'error': 'Track not found'}), 404
    return jsonify({'track': track}), 200

@music_bp.route('/track/<int:track_id>/play', methods=['POST'])
def record_track_play(track_id):
    """Increment play counter and record history."""
    execute_db("UPDATE tracks SET play_count = play_count + 1 WHERE id = ?", (track_id,))
    return jsonify({'status': 'recorded'}), 200
