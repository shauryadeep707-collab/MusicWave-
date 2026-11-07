from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db, execute_db

favourites_bp = Blueprint('favourites', __name__, url_prefix='/api/favourites')

@favourites_bp.route('/', methods=['GET'])
def get_favourites():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'favourites': []}), 200
    
    tracks = query_db("""
        SELECT t.*, f.created_at as favourited_at
        FROM favourites f
        JOIN tracks t ON f.track_id = t.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
    """, (user_id,))
    return jsonify({'favourites': tracks}), 200

@favourites_bp.route('/toggle', methods=['POST'])
def toggle_favourite():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    
    data = request.get_json() or {}
    track_id = data.get('track_id')
    if not track_id:
        return jsonify({'error': 'track_id is required'}), 400

    existing = query_db("SELECT id FROM favourites WHERE user_id = ? AND track_id = ?", (user_id, track_id), one=True)
    if existing:
        execute_db("DELETE FROM favourites WHERE user_id = ? AND track_id = ?", (user_id, track_id))
        return jsonify({'status': 'removed', 'is_favourite': False}), 200
    else:
        execute_db("INSERT INTO favourites (user_id, track_id) VALUES (?, ?)", (user_id, track_id))
        return jsonify({'status': 'added', 'is_favourite': True}), 200
