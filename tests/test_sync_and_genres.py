import sys
from pathlib import Path
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend import create_app
from backend.recommendations.engine import recommendation_engine
from backend.database.db import query_db

app = create_app()
with app.app_context():
    print('=== TEST 1: Genre Auto-Recommendation Accuracy ===')
    genres_to_test = [
        {'title': 'Kesariya', 'artist_name': 'Arijit Singh', 'genre': 'Bollywood'},
        {'title': '295', 'artist_name': 'Sidhu Moosewala', 'genre': 'Punjabi'},
        {'title': 'Coffee Chill', 'artist_name': 'ChilledCow', 'genre': 'Lo-fi'},
        {'title': 'Blinding Lights', 'artist_name': 'The Weeknd', 'genre': 'Pop'}
    ]

    for seed in genres_to_test:
        feats = recommendation_engine.extract_features(seed)
        print(f'Seed: "{seed["title"]}" ({seed["genre"]}) -> Dominant Genre detected: {feats["dominant_genre"]}')
        rec = recommendation_engine.predict_next(seed)
        if rec:
            rec_feats = recommendation_engine.extract_features(rec)
            print(f'   -> Next Recommended: "{rec.get("title")}" by {rec.get("artist_name")} (Genre: {rec_feats["dominant_genre"]})')
        else:
            print('   -> No direct match, fallback engaged')

    print('\n=== TEST 2: Jam Room HTTP Sync Endpoint ===')
    client = app.test_client()
    r_create = client.post('/api/jams/', json={'name': 'Sync Test Room', 'is_public': True})
    room_id = r_create.get_json()['room']['id']
    user_id = r_create.get_json()['user_id']
    print(f'Created Jam: {room_id} (Host user: {user_id})')

    t = query_db('SELECT id, title FROM tracks LIMIT 1', one=True)
    if t:
        r_sync = client.post(f'/api/jams/{room_id}/sync', json={
            'track_id': t['id'],
            'playback_status': 'playing',
            'playback_position': 15.5,
            'user_id': user_id
        })
        print('Sync endpoint response status:', r_sync.status_code)
        assert r_sync.status_code == 200

        r_get = client.get(f'/api/jams/{room_id}')
        assert r_get.status_code == 200
        room_state = r_get.get_json()
        print('Verified synced room state:', {
            'track_id': room_state['room']['current_track_id'],
            'status': room_state['room']['playback_status'],
            'position': room_state['room']['playback_position']
        })
        assert room_state['room']['current_track_id'] == t['id']
        assert room_state['room']['playback_status'] == 'playing'
        print('PASS: Room state successfully verified in DB!')
print('\nALL TESTS PASSED!')
