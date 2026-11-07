from flask import Blueprint, jsonify, request, session
from backend.database.db import query_db
from .engine import recommendation_engine

recommendations_bp = Blueprint('recommendations', __name__, url_prefix='/api/recommendations')

@recommendations_bp.route('/next', methods=['GET'])
def get_next_recommended():
    """
    Get the next song to auto-play based on the current/previous song.
    """
    track_id = request.args.get('current_track_id')
    title = request.args.get('title')
    artist = request.args.get('artist')
    genre = request.args.get('genre', '')

    if not track_id and not title:
        return jsonify({'error': 'current_track_id or title is required'}), 400

    user_id = session.get('user_id')
    if not user_id:
        fallback_id = request.headers.get('X-User-Id')
        if fallback_id and fallback_id.isdigit():
            user_id = int(fallback_id)

    # Get current track details
    current_track = None
    if track_id and str(track_id).isdigit():
        current_track = query_db("SELECT * FROM tracks WHERE id = ?", (int(track_id),), one=True)

    if not current_track:
        if title:
            current_track = {
                'id': int(track_id) if track_id and str(track_id).isdigit() else None,
                'title': title,
                'artist_name': artist or 'Artist',
                'genre': genre
            }
        else:
            return jsonify({'error': 'Track not found'}), 404

    # Extract excluded track ids from params (e.g. recent history)
    exclude_param = request.args.get('exclude', '')
    exclude_ids = [int(x) for x in exclude_param.split(',') if x.isdigit()]

    next_track = recommendation_engine.predict_next(
        current_track=current_track,
        user_id=user_id,
        exclude_ids=exclude_ids
    )

    if not next_track:
        return jsonify({'error': 'No matching recommendation found'}), 404

    return jsonify({
        'status': 'success',
        'seed_track_title': current_track.get('title'),
        'next_track': next_track
    }), 200

@recommendations_bp.route('/transition', methods=['POST'])
def train_transition():
    """
    Train model on actual song transition (song A finished -> song B started).
    """
    data = request.get_json() or {}
    from_id = data.get('from_track_id')
    to_id = data.get('to_track_id')

    user_id = session.get('user_id')
    if not user_id:
        fallback_id = request.headers.get('X-User-Id')
        if fallback_id and fallback_id.isdigit():
            user_id = int(fallback_id)

    if from_id and to_id:
        recommendation_engine.train_transition(from_id, to_id, user_id=user_id)
        return jsonify({'status': 'transition_trained'}), 200

    return jsonify({'error': 'Missing from_track_id or to_track_id'}), 400
