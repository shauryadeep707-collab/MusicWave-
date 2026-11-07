import sys
import unittest
sys.stdout.reconfigure(encoding='utf-8')

from backend import create_app
from backend.providers.base import is_single_track, COMPILATION_KEYWORDS
from backend.recommendations.engine import recommendation_engine
from backend.database.db import query_db

class TestSingleTrackRecommendation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_01_single_track_filter(self):
        # Must reject compilations and radio programs
        self.assertFalse(is_single_track('Carvaan/Weekend Classic Radio Show', 'Saregama Music', 4100))
        self.assertFalse(is_single_track('Full Album | 50 Super Hit Songs | 3+ Hours Non-Stop', 'Venus', 13314))
        self.assertFalse(is_single_track('Best Of Arijit Singh 2024 | Arijit Singh Jukebox', 'T-Series', 3652))
        self.assertFalse(is_single_track('Top Hits Non Stop Mix', 'DJ', 1800))
        self.assertFalse(is_single_track('Weekend Classic Radio', 'Radio', 210))

        # Must accept true singles
        self.assertTrue(is_single_track('Kesariya | Brahmastra', 'Arijit Singh', 268))
        self.assertTrue(is_single_track('Roop Tera Mastana', 'Kishore Kumar', 215))
        self.assertTrue(is_single_track('O Mere Dil Ke Chain', 'Kishore Kumar', 270))
        self.assertTrue(is_single_track('295', 'Sidhu Moose Wala', 270))
        self.assertTrue(is_single_track('Starboy', 'The Weeknd', 230))

    def test_02_database_has_no_compilations(self):
        tracks = query_db('SELECT id, title, artist_name, duration FROM tracks')
        for t in tracks:
            dur = t.get('duration') or 0
            title = (t.get('title') or '').lower()
            self.assertLessEqual(dur, 390, f"Track {t['id']} '{t['title']}' has excessive duration {dur}s")
            for kw in ['carvaan', 'jukebox', 'full album', 'non stop', 'all songs']:
                self.assertNotIn(kw, title, f"Track {t['id']} '{t['title']}' matches blacklisted keyword '{kw}'")

    def test_03_recommendation_from_carvaan_returns_single(self):
        seed_carvaan = {
            'id': 99999,
            'title': 'Carvaan/Weekend Classic Radio Show',
            'artist_name': 'Saregama Music',
            'genre': 'Retro'
        }
        res = recommendation_engine.predict_next(seed_carvaan)
        self.assertIsNotNone(res)
        dur = res.get('duration', 0)
        self.assertLessEqual(dur, 380, f"Recommended track duration {dur} exceeds single song threshold")
        self.assertTrue(is_single_track(res.get('title'), res.get('artist_name'), dur))

    def test_04_auth_register_and_login(self):
        import time
        unique_id = int(time.time())
        username = f"user_{unique_id}"
        email = f"user_{unique_id}@musicwave.test"
        password = "SecurePassword123"

        reg_res = self.client.post('/api/auth/register', json={
            'username': username,
            'email': email,
            'password': password,
            'display_name': 'Test User'
        })
        self.assertEqual(reg_res.status_code, 201)
        reg_json = reg_res.get_json()
        self.assertIn('token', reg_json)
        self.assertEqual(reg_json['user']['username'], username)

        login_res = self.client.post('/api/auth/login', json={
            'identifier': username,
            'password': password
        })
        self.assertEqual(login_res.status_code, 200)
        login_json = login_res.get_json()
        self.assertIn('token', login_json)
        self.assertEqual(login_json['user']['email'], email)

if __name__ == '__main__':
    unittest.main()
