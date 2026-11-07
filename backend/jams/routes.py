import uuid
import random
from typing import Optional
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db, execute_db, is_postgres, get_auth_user_id

jams_bp = Blueprint('jams', __name__, url_prefix='/api/jams')

def generate_join_code() -> str:
    """Generate a random 4-digit numerical join code."""
    return f"{random.randint(1000, 9999)}"

def parse_expiry(exp_val) -> Optional[datetime]:
    if not exp_val:
        return None
    if isinstance(exp_val, datetime):
        return exp_val.replace(tzinfo=None) if exp_val.tzinfo else exp_val
    if isinstance(exp_val, str):
        try:
            dt = datetime.fromisoformat(exp_val.replace('Z', ''))
            return dt.replace(tzinfo=None) if dt.tzinfo else dt
        except Exception:
            try:
                return datetime.strptime(exp_val[:19], '%Y-%m-%d %H:%M:%S')
            except Exception:
                return None
    return None

@jams_bp.route('', methods=['GET'], strict_slashes=False)
@jams_bp.route('/', methods=['GET'], strict_slashes=False)
def list_public_jams():
    """List currently active public Jam rooms with live participant counts."""
    rooms = query_db("""
        SELECT r.*, u.username as host_name, p.avatar_url as host_avatar,
               (SELECT COUNT(*) FROM jam_participants WHERE room_id = r.id) as participant_count,
               t.title as current_track_title, t.artist_name as current_track_artist, t.artwork_url as current_track_artwork
        FROM jam_rooms r
        JOIN users u ON r.host_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        LEFT JOIN tracks t ON r.current_track_id = t.id
        WHERE r.is_active AND r.is_public
        ORDER BY participant_count DESC, r.created_at DESC
    """)
    return jsonify({'jams': rooms}), 200

@jams_bp.route('', methods=['POST'], strict_slashes=False)
@jams_bp.route('/', methods=['POST'], strict_slashes=False)
def create_jam():
    """Create a new Jam room with a 4-digit join code valid for 10 minutes."""
    user_id = get_auth_user_id(auto_create_guest=True)
    if not user_id:
        return jsonify({'error': 'Could not initialize session to create Jam room. Please try again.'}), 500

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    is_public = bool(data.get('is_public', True))
    max_participants = int(data.get('max_participants', 20))

    if not name:
        return jsonify({'error': 'Room name is required'}), 400

    room_id = str(uuid.uuid4())[:8]
    join_code = generate_join_code()
    code_expires_at = datetime.utcnow() + timedelta(minutes=10)

    execute_db("""
        INSERT INTO jam_rooms (id, name, description, host_id, is_public, max_participants, join_code, code_expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    """, (room_id, name, description, user_id, is_public, max_participants, join_code, code_expires_at))

    is_pg = is_postgres()
    if is_pg:
        execute_db("""
            INSERT INTO jam_participants (room_id, user_id, is_host)
            VALUES (?, ?, TRUE)
            ON CONFLICT (room_id, user_id) DO UPDATE SET is_host = TRUE
        """, (room_id, user_id))
    else:
        execute_db("""
            INSERT INTO jam_participants (room_id, user_id, is_host)
            VALUES (?, ?, 1)
            ON CONFLICT(room_id, user_id) DO UPDATE SET is_host = 1
        """, (room_id, user_id))

    return jsonify({
        'message': 'Jam room created successfully',
        'room': {
            'id': room_id,
            'name': name,
            'description': description,
            'join_code': join_code,
            'code_expires_at': code_expires_at.isoformat(),
            'remaining_seconds': 600,
            'is_public': bool(is_public),
            'host_id': user_id
        },
        'user_id': user_id
    }), 201

@jams_bp.route('/<room_id>', methods=['GET'], strict_slashes=False)
def get_jam_room(room_id):
    """Retrieve Jam room details, code expiration countdown, current track, and participants."""
    user_id = get_auth_user_id(auto_create_guest=True)
    room = query_db("""
        SELECT r.*, u.username as host_name, p.avatar_url as host_avatar
        FROM jam_rooms r
        JOIN users u ON r.host_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE r.id = ? AND r.is_active
    """, (room_id,), one=True)

    if not room:
        return jsonify({'error': 'Jam room not found or inactive'}), 404

    # Calculate remaining seconds for the 4-digit code (10-minute expiry)
    exp = parse_expiry(room.get('code_expires_at'))
    if exp:
        rem = int((exp - datetime.utcnow()).total_seconds())
        remaining_seconds = max(0, rem)
    else:
        remaining_seconds = 0
    is_expired = remaining_seconds <= 0

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

    is_host = (user_id is not None) and (room['host_id'] == user_id)

    return jsonify({
        'room': room,
        'join_code': room.get('join_code'),
        'remaining_seconds': remaining_seconds,
        'is_code_expired': is_expired,
        'is_host': is_host,
        'current_track': current_track,
        'participants': participants,
        'queue': queue
    }), 200

@jams_bp.route('/join', methods=['POST'], strict_slashes=False)
def join_jam():
    """
    Join a Jam room using either:
    1. A 4-digit join code (valid for 10 minutes)
    2. An 8-character Room ID
    """
    user_id = get_auth_user_id(auto_create_guest=True)
    if not user_id:
        return jsonify({'error': 'Could not initialize session to join Jam room.'}), 500

    data = request.get_json() or {}
    code_or_id = str(data.get('code_or_id') or data.get('join_code') or data.get('room_id') or '').strip()

    if not code_or_id:
        return jsonify({'error': 'Please provide a 4-digit Join Code or Room ID'}), 400

    room = None
    # Check if input is a 4-digit numeric code
    if code_or_id.isdigit() and len(code_or_id) == 4:
        room = query_db("SELECT * FROM jam_rooms WHERE join_code = ? AND is_active", (code_or_id,), one=True)
        if not room:
            return jsonify({'error': f'No active Jam room found with 4-digit code "{code_or_id}". Please check the code.'}), 404

        # Check 10-minute expiry
        exp = parse_expiry(room.get('code_expires_at'))
        if exp and datetime.utcnow() > exp:
            return jsonify({
                'error': f'This 4-digit code ({code_or_id}) has expired (codes expire every 10 minutes). Ask the host for a new code.',
                'expired': True
            }), 410
    else:
        # Otherwise search by room_id
        room = query_db("SELECT * FROM jam_rooms WHERE id = ? AND is_active", (code_or_id,), one=True)
        if not room:
            return jsonify({'error': f'No active Jam room found with ID "{code_or_id}".'}), 404

    # Add user to participants
    is_host = (room['host_id'] == user_id)
    is_pg = is_postgres()
    if is_pg:
        execute_db("""
            INSERT INTO jam_participants (room_id, user_id, is_host)
            VALUES (?, ?, ?)
            ON CONFLICT (room_id, user_id) DO NOTHING
        """, (room['id'], user_id, is_host))
    else:
        execute_db("""
            INSERT INTO jam_participants (room_id, user_id, is_host)
            VALUES (?, ?, ?)
            ON CONFLICT(room_id, user_id) DO NOTHING
        """, (room['id'], user_id, 1 if is_host else 0))

    return jsonify({
        'status': 'joined',
        'message': f'Successfully joined "{room["name"]}"',
        'room_id': room['id'],
        'room_name': room['name'],
        'is_host': is_host
    }), 200

@jams_bp.route('/<room_id>/regenerate-code', methods=['POST'], strict_slashes=False)
def regenerate_join_code(room_id):
    """
    Jam Host action: Generate a fresh 4-digit code and reset the 10-minute expiry timer.
    """
    user_id = get_auth_user_id()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401

    room = query_db("SELECT * FROM jam_rooms WHERE id = ?", (room_id,), one=True)
    if not room:
        return jsonify({'error': 'Jam room not found'}), 404

    if room['host_id'] != user_id:
        return jsonify({'error': 'Only the Jam host can generate a new join code in Jam Settings'}), 403

    new_code = generate_join_code()
    new_expiry = datetime.utcnow() + timedelta(minutes=10)

    execute_db("""
        UPDATE jam_rooms
        SET join_code = ?, code_expires_at = ?
        WHERE id = ?
    """, (new_code, new_expiry, room_id))

    return jsonify({
        'status': 'code_regenerated',
        'message': f'New 4-digit code generated: {new_code} (valid for 10 minutes)',
        'join_code': new_code,
        'code_expires_at': new_expiry.isoformat(),
        'remaining_seconds': 600
    }), 200

@jams_bp.route('/<room_id>/sync', methods=['POST'], strict_slashes=False)
def sync_playback(room_id):
    """Host action: Sync currently playing track & playback position to all listeners."""
    user_id = get_auth_user_id(auto_create_guest=True)
    room = query_db("SELECT * FROM jam_rooms WHERE id = ?", (room_id,), one=True)
    if not room:
        return jsonify({'error': 'Room not found'}), 404

    if room['host_id'] != user_id:
        return jsonify({'error': 'Only host can broadcast playback state'}), 403

    data = request.get_json() or {}
    track_id = data.get('track_id')
    status = data.get('playback_status', 'playing')
    pos = float(data.get('playback_position', 0.0))

    execute_db("""
        UPDATE jam_rooms
        SET current_track_id = ?, playback_status = ?, playback_position = ?, playback_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (track_id, status, pos, room_id))

    return jsonify({'status': 'synced'}), 200

@jams_bp.route('/<room_id>/leave', methods=['POST'], strict_slashes=False)
def leave_jam(room_id):
    """
    Leave the Jam room.
    Note: The Jam room itself remains alive and active until explicitly ended by its host/owner.
    """
    user_id = get_auth_user_id()
    if user_id:
        execute_db("DELETE FROM jam_participants WHERE room_id = ? AND user_id = ?", (room_id, user_id))
    return jsonify({'status': 'left'}), 200

@jams_bp.route('/<room_id>/end', methods=['POST'], strict_slashes=False)
def end_jam(room_id):
    """
    Owner/Host action: Permanently end and close the Jam room.
    The room stays active indefinitely until the owner explicitly ends it here.
    """
    user_id = get_auth_user_id()
    if not user_id:
        return jsonify({'error': 'Authentication required to end this Jam room'}), 401

    room = query_db("SELECT * FROM jam_rooms WHERE id = ?", (room_id,), one=True)
    if not room:
        return jsonify({'error': 'Jam room not found'}), 404

    if room['host_id'] != user_id:
        return jsonify({'error': 'Only the Jam room host/owner can end this room'}), 403

    # Mark room inactive - it stays alive until the owner takes this explicit action
    execute_db("UPDATE jam_rooms SET is_active = ? WHERE id = ?", (False, room_id))
    # Disconnect all participants
    execute_db("DELETE FROM jam_participants WHERE room_id = ?", (room_id,))

    return jsonify({
        'status': 'ended',
        'message': f'Jam room "{room["name"]}" has been ended by the owner.'
    }), 200

