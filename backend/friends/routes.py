from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db, execute_db

friends_bp = Blueprint('friends', __name__, url_prefix='/api/friends')

@friends_bp.route('/', methods=['GET'])
def list_friends():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'friends': []}), 200

    friends = query_db("""
        SELECT u.id, u.username, p.display_name, p.avatar_url, p.bio,
               s.show_listening_activity
        FROM friendships f
        JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
        LEFT JOIN user_profiles p ON u.id = p.user_id
        LEFT JOIN user_settings s ON u.id = s.user_id
        WHERE f.status = 'accepted'
    """, (user_id, user_id))
    return jsonify({'friends': friends}), 200

@friends_bp.route('/requests', methods=['GET'])
def list_requests():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'incoming': [], 'outgoing': []}), 200

    incoming = query_db("""
        SELECT fr.id, fr.sender_id, fr.created_at, u.username, p.display_name, p.avatar_url
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE fr.receiver_id = ? AND fr.status = 'pending'
    """, (user_id,))

    return jsonify({'incoming': incoming}), 200
