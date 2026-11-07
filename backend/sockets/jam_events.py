from datetime import datetime
from flask_socketio import emit, join_room, leave_room
from flask import request
from backend.database.db import query_db, execute_db

def register_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        pass

    @socketio.on('disconnect')
    def handle_disconnect():
        pass

    @socketio.on('join_jam')
    def on_join(data):
        room_id = data.get('room_id')
        user = data.get('user')
        if not room_id:
            return

        join_room(room_id)

        # Notify other participants that a new listener joined
        emit('user_joined', {
            'sid': request.sid,
            'room_id': room_id,
            'user': user
        }, to=room_id, include_self=False)

        # Retrieve current room state from database to sync this new listener immediately
        try:
            room = query_db("SELECT * FROM jam_rooms WHERE id = ? AND is_active", (room_id,), one=True)
            if room and room.get('current_track_id'):
                track = query_db("SELECT * FROM tracks WHERE id = ?", (room['current_track_id'],), one=True)
                if track:
                    pos = float(room.get('playback_position') or 0.0)
                    status = room.get('playback_status', 'paused')
                    if status == 'playing' and room.get('playback_updated_at'):
                        up_at = room['playback_updated_at']
                        if isinstance(up_at, str):
                            try:
                                up_at = datetime.fromisoformat(up_at.replace('Z', ''))
                            except Exception:
                                up_at = None
                        if up_at:
                            elapsed = (datetime.utcnow() - up_at).total_seconds()
                            dur = float(track.get('duration') or 300)
                            if 0 < elapsed < dur:
                                pos += elapsed

                    # Send synchronized current track & timestamp directly to newly joined client
                    emit('jam_sync_state', {
                        'room_id': room_id,
                        'track': track,
                        'position': pos,
                        'status': status,
                        'is_host': bool(user and user.get('id') == room['host_id'])
                    }, room=request.sid)
        except Exception as e:
            print(f"[Jam Socket Sync Warning]: {e}")

    @socketio.on('leave_jam')
    def on_leave(data):
        room_id = data.get('room_id')
        user = data.get('user')
        if room_id:
            leave_room(room_id)
            emit('user_left', {
                'sid': request.sid,
                'room_id': room_id,
                'user': user
            }, to=room_id, include_self=False)

    @socketio.on('jam_play_track')
    def on_play_track(data):
        """Host action: broadcast played song to all listeners in the Jam room."""
        room_id = data.get('room_id')
        track = data.get('track')
        position = float(data.get('position', 0.0))
        if not room_id or not track:
            return

        track_id = track.get('id')
        from backend.providers import music_service
        if not track_id:
            try:
                persisted = music_service._persist_tracks([track])
                if persisted:
                    track = persisted[0]
                    track_id = track.get('id')
            except Exception as e:
                print(f"[Socket track persist notice]: {e}")

        try:
            execute_db("""
                UPDATE jam_rooms
                SET current_track_id = ?, playback_status = 'playing', playback_position = ?, playback_updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (track_id, position, room_id))
        except Exception as e:
            print(f"[Jam Play DB Error]: {e}")

        # Broadcast to all listeners in the Jam room
        emit('jam_track_changed', {
            'room_id': room_id,
            'track': track,
            'position': position,
            'status': 'playing'
        }, to=room_id, include_self=False)

    @socketio.on('jam_playback_control')
    def on_playback_control(data):
        """Host action: play, pause, or seek broadcast in real time."""
        room_id = data.get('room_id')
        action = data.get('action')  # 'play', 'pause', 'seek'
        position = float(data.get('position', 0.0))
        if not room_id or not action:
            return

        status = 'playing' if action in ['play', 'seek'] else 'paused'
        try:
            execute_db("""
                UPDATE jam_rooms
                SET playback_status = ?, playback_position = ?, playback_updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (status, position, room_id))
        except Exception as e:
            print(f"[Jam Control DB Error]: {e}")

        emit('jam_playback_synced', {
            'room_id': room_id,
            'action': action,
            'position': position,
            'status': status
        }, to=room_id, include_self=False)
