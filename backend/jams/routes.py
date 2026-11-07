from flask import Blueprint, jsonify, request, session
import uuid
from backend.database.db import query_db, execute_db

jams_bp = Blueprint('jams', __name__, url_prefix='/api/jams')

@jams_bp.route('/', methods=['GET'])
def list_public_jams():
    """List currently active public Jam rooms."""
    rooms = query_db("""
        SELECT r.*, u.username as host_name, p.avatar_url as host_avatar,
               (SELECT COUNT(*) FROM jam_participants WHERE room_id = r.id) as participant_count,
               t.title as current_track_title, t.artist_name as current_track_artist, t.artwork_url as current_track_artwork
        FROM jam_rooms r
        JOIN users u ON r.host_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        LEFT JOIN tracks t ON r.current_track_id = t.id
        WHERE r.is_active = 1 AND r.is_public = 1
        ORDER BY participant_count DESC, r.created_at DESC
    """)
    return jsonify({'jams': rooms}), 200

@jams_bp.route('/', methods=['POST'])
def create_jam():
    """Create a new Jam room."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    is_public = 1 if data.get('is_public', True) else 0
    max_participants = int(data.get('max_participants', 20))

    if not name:
        return jsonify({'error': 'Room name is required'}), 400

    room_id = str(uuid.uuid4())[:8]
    execute_db("""
        INSERT INTO jam_rooms (id, name, description, host_id, is_public, max_participants)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (room_id, name, description, user_id, is_public, max_participants))

    execute_db("""
        INSERT INTO jam_participants (room_id, user_id, is_host)
        VALUES (?, ?, 1)
    """, (room_id, user_id))

    return jsonify({
        'message': 'Jam room created',
        'room': {
            'id': room_id,
            'name': name,
            'description': description,
            'is_public': bool(is_public),
            'host_id': user_id
        }
    }), 201

@jams_bp.route('/<room_id>', methods=['GET'])
def get_jam_room(room_id):
    """Retrieve Jam room details, current track, queue, and participants."""
    room = query_db("""
        SELECT r.*, u.username as host_name, p.avatar_url as host_avatar
        FROM jam_rooms r
        JOIN users u ON r.host_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE r.id = ? AND r.is_active = 1
    """, (room_id,), one=True)

    if not room:
        return jsonify({'error': 'Jam room not found or inactive'}), 404

    participants = query_db("""
        SELECT jp.*, u.username, p.display_name, p.avatar_url
        FROM jam_participants jp
        JOIN users u ON jp.user_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE jp.room_id = ?
        ORDER BY jp.is_host DESC, jp.joined_at ASC
    """, (room_id,))

    queue = query_db("""
        SELECT jq.*, t.title, t.artist_name, t.album_name, t.duration, t.artwork_url,
               u.username as added_by_username
        FROM jam_queue jq
        JOIN tracks t ON jq.track_id = t.id
        JOIN users u ON jq.added_by = u.id
        WHERE jq.room_id = ?
        ORDER BY jq.position ASC, jq.votes_count DESC
    """, (room_id,))

    current_track = None
    if room['current_track_id']:
        current_track = query_db("SELECT * FROM tracks WHERE id = ?", (room['current_track_id'],), one=True)

    return jsonify({
        'room': room,
        'current_track': current_track,
        'participants': participants,
        'queue': queue
    }), 200
