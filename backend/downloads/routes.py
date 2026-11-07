from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db, execute_db, get_auth_user_id

downloads_bp = Blueprint('downloads', __name__, url_prefix='/api/downloads')

@downloads_bp.route('/permissions/<int:track_id>', methods=['GET'])
def check_permission(track_id):
    """Verify if a track is legally authorized for offline download."""
    track = query_db("SELECT id, title, download_allowed, download_url, licence_information FROM tracks WHERE id = ?", (track_id,), one=True)
    if not track:
        return jsonify({'error': 'Track not found'}), 404
    return jsonify({
        'track_id': track['id'],
        'download_allowed': bool(track['download_allowed']),
        'licence': track['licence_information'],
        'download_url': track['download_url'] if track['download_allowed'] else None
    }), 200

@downloads_bp.route('/register', methods=['POST'])
def register_download():
    """Register locally downloaded track metadata for user synchronization."""
    user_id = get_auth_user_id()
    if not user_id:
        return jsonify({'error': 'Please sign in or register to sync downloads'}), 401
    data = request.get_json() or {}
    track_id = data.get('track_id')
    file_size = data.get('file_size', 0)
    mime_type = data.get('mime_type', 'audio/mpeg')

    if not track_id:
        return jsonify({'error': 'track_id is required'}), 400

    execute_db("""
        INSERT OR REPLACE INTO downloaded_track_metadata (user_id, track_id, file_size, mime_type)
        VALUES (?, ?, ?, ?)
    """, (user_id, track_id, file_size, mime_type))

    return jsonify({'status': 'registered'}), 200
