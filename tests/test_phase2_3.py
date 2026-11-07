import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from backend import create_app
from backend.providers import music_service

def test_phase2_3():
    app = create_app()
    client = app.test_client()

    with app.app_context():
        print("[TEST] Testing Local Vault Provider...")
        local_tracks = music_service.providers['local'].get_trending(5)
        assert len(local_tracks) >= 5, "Expected at least 5 local vault tracks"
        print(f"[PASS] Local Vault returned {len(local_tracks)} tracks:")
        for t in local_tracks[:3]:
            print(f"  - {t.title} ({t.genre}) | Artist: {t.artist_name}")

        print("\n[TEST] Testing Unified Music Service Trending...")
        trending = music_service.get_trending(limit=10)
        assert len(trending) > 0, "Trending should return tracks"
        print(f"[PASS] MusicService returned {len(trending)} trending tracks")
        sample = trending[0]
        required_keys = ['title', 'artist_name', 'stream_url', 'artwork_url', 'download_allowed', 'licence_information']
        for k in required_keys:
            assert k in sample, f"Missing required key '{k}' in unified track object"
        print(f"  Sample Track: {sample['title']} | Stream URL: {sample['stream_url'][:60]}...")

        print("\n[TEST] Testing API Endpoints...")
        # 1. API Trending
        res = client.get('/api/music/trending?limit=10')
        assert res.status_code == 200
        tracks = res.get_json().get('tracks', [])
        assert len(tracks) > 0
        print(f"[PASS] /api/music/trending returned {len(tracks)} tracks")

        # 2. API Search
        res = client.get('/api/music/search?q=chill')
        assert res.status_code == 200
        search_results = res.get_json().get('results', [])
        assert len(search_results) > 0
        print(f"[PASS] /api/music/search?q=chill returned {len(search_results)} tracks")

        # 3. API Genre
        res = client.get('/api/music/genre/Bollywood')
        assert res.status_code == 200
        bollywood = res.get_json().get('tracks', [])
        assert len(bollywood) > 0
        print(f"[PASS] /api/music/genre/Bollywood returned {len(bollywood)} tracks")

if __name__ == '__main__':
    test_phase2_3()
    print("\n🎉 ALL PHASE 2 & 3 MUSIC PROVIDER TESTS PASSED SUCCESSFULLY!")
