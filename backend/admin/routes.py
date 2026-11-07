from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db, execute_db

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def is_admin():
    return session.get('role') == 'admin'

@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    if not is_admin():
        return jsonify({'error': 'Unauthorized - Admin privileges required'}), 403

    user_count = query_db("SELECT COUNT(*) as count FROM users", one=True)['count']
    track_count = query_db("SELECT COUNT(*) as count FROM tracks", one=True)['count']
    jam_count = query_db("SELECT COUNT(*) as count FROM jam_rooms WHERE is_active", one=True)['count']
    download_count = query_db("SELECT COUNT(*) as count FROM downloaded_track_metadata", one=True)['count']

    return jsonify({
        'stats': {
            'users': user_count,
            'tracks': track_count,
            'active_jams': jam_count,
            'downloads': download_count
        }
    }), 200

@admin_bp.route('/providers', methods=['GET'])
def list_providers():
    if not is_admin():
        return jsonify({'error': 'Unauthorized - Admin privileges required'}), 403
    providers = query_db("SELECT * FROM music_providers")
    return jsonify({'providers': providers}), 200
