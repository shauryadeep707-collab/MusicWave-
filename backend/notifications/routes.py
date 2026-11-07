from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db, execute_db

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

@notifications_bp.route('/', methods=['GET'])
def get_notifications():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'notifications': []}), 200

    notifications = query_db("""
        SELECT n.*, u.username as sender_username, p.avatar_url as sender_avatar
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 30
    """, (user_id,))
    return jsonify({'notifications': notifications}), 200

@notifications_bp.route('/read-all', methods=['POST'])
def mark_all_read():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'status': 'marked_read'}), 200
    execute_db("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user_id,))
    return jsonify({'status': 'marked_read'}), 200
