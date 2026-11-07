import unittest
from app import create_app
from backend.database.db import get_db, query_db, execute_db

class TestJamChatAndMobile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_01_mobile_nav_and_overlay_rendered(self):
        """Verify templates/index.html renders mobile bottom navigation and drawer overlay."""
        resp = self.client.get('/')
        self.assertEqual(resp.status_code, 200)
        html = resp.data.decode('utf-8')
        self.assertIn('mobile-bottom-nav', html)
        self.assertIn('mobile-menu-btn', html)
        self.assertIn('mobile-drawer-overlay', html)
        self.assertIn('data-page="jams"', html)

    def test_02_jam_chat_post_and_retrieve(self):
        """Verify sending and fetching live chat messages in Jam rooms."""
        # 1. Create a Jam room
        create_res = self.client.post('/api/jams', json={
            'name': 'Chat Test Party',
            'description': 'Testing live messages and reactions'
        })
        self.assertEqual(create_res.status_code, 201)
        room_data = create_res.get_json()
        room_id = room_data['room']['id']

        # 2. Post a chat message
        msg_res = self.client.post(f'/api/jams/{room_id}/messages', json={
            'content': 'Hello party listeners! 🔥',
            'message_type': 'chat'
        })
        self.assertEqual(msg_res.status_code, 201)
        msg_json = msg_res.get_json()
        self.assertEqual(msg_json['status'], 'sent')
        self.assertEqual(msg_json['message']['content'], 'Hello party listeners! 🔥')

        # 3. Retrieve messages
        get_res = self.client.get(f'/api/jams/{room_id}/messages')
        self.assertEqual(get_res.status_code, 200)
        get_json = get_res.get_json()
        self.assertIn('messages', get_json)
        self.assertTrue(len(get_json['messages']) >= 1)
        last_msg = get_json['messages'][-1]
        self.assertEqual(last_msg['content'], 'Hello party listeners! 🔥')

if __name__ == '__main__':
    unittest.main()
