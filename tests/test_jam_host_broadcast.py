import sys
import unittest
sys.stdout.reconfigure(encoding='utf-8')

from backend import create_app
from backend.database.db import query_db, execute_db

class TestJamHostBroadcast(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_01_host_creation_and_sync(self):
        # 1. Create a guest host session
        guest_res = self.client.post('/api/auth/guest')
        self.assertEqual(guest_res.status_code, 201)
        host_user = guest_res.get_json()['user']
        host_id = host_user['id']

        # 2. Create a Jam room
        create_res = self.client.post('/api/jams/', json={
            'name': 'Test Host Party',
            'description': 'Testing auto broadcast when playing normally',
            'is_public': True
        }, headers={'X-User-Id': str(host_id)})
        self.assertEqual(create_res.status_code, 201)
        room_data = create_res.get_json()['room']
        room_id = room_data['id']
        self.assertEqual(room_data['host_id'], host_id)

        # 3. Simulate host playing a YouTube song normally (no pre-existing track.id in DB)
        external_youtube_track = {
            'provider_id': 'youtube',
            'provider_track_id': 'test_yt_vid_123',
            'title': 'Kesariya - Official Audio',
            'artist_name': 'Arijit Singh',
            'album_name': 'Brahmāstra',
            'genre': 'Bollywood',
            'duration': 268,
            'artwork_url': 'https://i.ytimg.com/vi/test_yt_vid_123/hqdefault.jpg',
            'stream_url': 'test_yt_vid_123'
        }

        sync_res = self.client.post(f'/api/jams/{room_id}/sync', json={
            'track': external_youtube_track,
            'playback_status': 'playing',
            'playback_position': 0.0,
            'host_id': host_id
        }, headers={'X-User-Id': str(host_id)})

        self.assertEqual(sync_res.status_code, 200)
        sync_json = sync_res.get_json()
        self.assertEqual(sync_json['status'], 'synced')
        self.assertIsNotNone(sync_json['track'])
        self.assertEqual(sync_json['track']['title'], 'Kesariya - Official Audio')

        # 4. Verify listener fetching the room receives the exact track played by host
        guest2_res = self.client.post('/api/auth/guest')
        listener_id = guest2_res.get_json()['user']['id']

        join_res = self.client.post('/api/jams/join', json={
            'code_or_id': room_id
        }, headers={'X-User-Id': str(listener_id)})
        self.assertEqual(join_res.status_code, 200)

        get_room_res = self.client.get(f'/api/jams/{room_id}', headers={'X-User-Id': str(listener_id)})
        self.assertEqual(get_room_res.status_code, 200)
        room_details = get_room_res.get_json()
        self.assertIsNotNone(room_details['current_track'])
        self.assertEqual(room_details['current_track']['title'], 'Kesariya - Official Audio')
        self.assertEqual(room_details['room']['playback_status'], 'playing')

if __name__ == '__main__':
    unittest.main()
