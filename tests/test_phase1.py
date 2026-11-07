import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from backend import create_app
from backend.database.db import query_db

def test_phase1():
    app = create_app()
    client = app.test_client()

    # 1. Health check
    res = client.get('/api/health')
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    health_data = res.get_json()
    assert health_data.get('status') == 'healthy'
    print("[PASS] Health check passed:", health_data)

    # 2. Genres check
    res = client.get('/api/music/genres')
    assert res.status_code == 200
    genres = res.get_json().get('genres', [])
    assert len(genres) >= 10, f"Expected at least 10 seeded genres, got {len(genres)}"
    print(f"[PASS] Genres check passed: Found {len(genres)} seeded genres")

    # 3. Static/Template check
    res = client.get('/')
    assert res.status_code == 200
    assert b"MusicWave" in res.data
    print("[PASS] Index HTML shell served successfully")

    # 4. Database tables check
    with app.app_context():
        admin = query_db("SELECT username, email, role FROM users WHERE username = 'admin'", one=True)
        assert admin is not None
        assert admin['role'] == 'admin'
        print("[PASS] Default admin verified in DB:", dict(admin))

        providers = query_db("SELECT id, name FROM music_providers")
        assert len(providers) >= 4
        print("[PASS] Music providers verified:", [p['id'] for p in providers])

if __name__ == '__main__':
    test_phase1()
    print("\n🎉 ALL PHASE 1 FOUNDATION TESTS PASSED SUCCESSFULLY!")
