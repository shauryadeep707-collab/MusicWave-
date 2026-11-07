from flask import Blueprint, jsonify, request
from backend.database.db import query_db

music_bp = Blueprint('music', __name__, url_prefix='/api/music')

@music_bp.route('/genres', methods=['GET'])
def get_genres():
    """Retrieve all active genres with accents and artwork."""
    genres = query_db("SELECT * FROM genres WHERE is_active = 1 ORDER BY name ASC")
    return jsonify({'genres': genres}), 200

@music_bp.route('/trending', methods=['GET'])
def get_trending():
    """Retrieve trending tracks from database cache or providers."""
    tracks = query_db("""
        SELECT * FROM tracks 
        ORDER BY play_count DESC, created_at DESC 
        LIMIT 20
    """)
    return jsonify({'tracks': tracks}), 200

@music_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Lightweight recommendation based on genres and popularity."""
    genre = request.args.get('genre')
    if genre:
        tracks = query_db("SELECT * FROM tracks WHERE genre = ? ORDER BY RANDOM() LIMIT 15", (genre,))
    else:
        tracks = query_db("SELECT * FROM tracks ORDER BY RANDOM() LIMIT 15")
    return jsonify({'recommendations': tracks}), 200

@music_bp.route('/search', methods=['GET'])
def search_tracks():
    """Universal search across title, artist, album and genre."""
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'results': []}), 200
    
    pattern = f"%{q}%"
    tracks = query_db("""
        SELECT * FROM tracks
        WHERE title LIKE ? OR artist_name LIKE ? OR album_name LIKE ? OR genre LIKE ?
        ORDER BY play_count DESC
        LIMIT 30
    """, (pattern, pattern, pattern, pattern))
    
    return jsonify({'results': tracks, 'query': q}), 200
