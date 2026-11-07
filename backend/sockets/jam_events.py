from flask_socketio import emit, join_room, leave_room
from flask import request

def register_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        pass

    @socketio.on('disconnect')
    def handle_disconnect():
        pass

    @socketio.on('join_jam')
    def on_join(data):
        room = data.get('room_id')
        if room:
            join_room(room)
            emit('user_joined', {'sid': request.sid, 'room_id': room}, to=room)

    @socketio.on('leave_jam')
    def on_leave(data):
        room = data.get('room_id')
        if room:
            leave_room(room)
            emit('user_left', {'sid': request.sid, 'room_id': room}, to=room)
