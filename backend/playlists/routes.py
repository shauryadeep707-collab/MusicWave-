from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db, execute_db

playlists_bp = Blueprint('playlists', __name__, url_prefix='/api/playlists')

@playlists_bp.route('/', methods=['GET'])
def get_user_playlists():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'playlists': []}), 200
    
    playlists = query_db("""
        SELECT p.*, COUNT(pt.track_id) as track_count
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY p.updated_at DESC
    """, (user_id,))
    return jsonify({'playlists': playlists}), 200

@playlists_bp.route('/', methods=['POST'])
def create_playlist():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    is_public = 1 if data.get('is_public', True) else 0

    if not title:
        return jsonify({'error': 'Playlist title is required'}), 400

    playlist_id, _ = execute_db("""
        INSERT INTO playlists (user_id, title, description, is_public)
        VALUES (?, ?, ?, ?)
    """, (user_id, title, description, is_public))

    return jsonify({
        'message': 'Playlist created successfully',
        'playlist': {
            'id': playlist_id,
            'title': title,
            'description': description,
            'is_public': bool(is_public),
            'track_count': 0
        }
    }), 201
