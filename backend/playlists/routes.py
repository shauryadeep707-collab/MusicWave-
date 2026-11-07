from flask import Blueprint, jsonify, request, session
import re
from backend.database.db import query_db, execute_db, is_postgres, get_auth_user_id

playlists_bp = Blueprint('playlists', __name__, url_prefix='/api/playlists')

CATEGORY_MAPPINGS = [
    {
        'category': 'retro',
        'title': 'Your Retro Classics',
        'cover': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
        'keywords': ['retro', '70s', '80s', '90s', 'kishore', 'lata', 'rafi', 'mukesh', 'purane', 'classic', 'old', 'evergreen', 'mohammed rafi', 'asha bhosle', 'rd burman']
    },
    {
        'category': 'punjabi',
        'title': 'Your Punjabi Mix',
        'cover': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80',
        'keywords': ['punjabi', 'moosewala', 'diljit', 'aujla', 'dhillon', 'dhol', 'bhangra', 'shubh', 'sidhu', 'karan aujla', 'ammy virk', 'gurdas', 'ap dhillon']
    },
    {
        'category': 'sad',
        'title': 'Your Sad & Melancholic Vibes',
        'cover': 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80',
        'keywords': ['sad', 'dard', 'judai', 'heartbreak', 'alone', 'broken', 'cry', 'emotional', 'slow', 'breakup', 'tanhai', 'gham']
    },
    {
        'category': 'lo-fi',
        'title': 'Your Lo-fi Chill Lounge',
        'cover': 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&q=80',
        'keywords': ['lofi', 'lo-fi', 'chill', 'study', 'relax', 'sleep', 'mellow', 'rain', 'coffee', 'ambient']
    },
    {
        'category': 'romantic',
        'title': 'Your Romantic Love Hits',
        'cover': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
        'keywords': ['love', 'romantic', 'romance', 'ishq', 'mohabbat', 'dil', 'pyaar', 'humsafar', 'sweetheart']
    },
    {
        'category': 'bollywood',
        'title': 'Your Bollywood Melodies',
        'cover': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
        'keywords': ['bollywood', 'hindi', 'arijit', 'shreya', 'pritam', 'atif', 'jubin', 'darshan', 'neha', 'mohit', 'badshah', 'ar rahman', 'sonu nigam']
    },
    {
        'category': 'pop',
        'title': 'Your Pop & Global Hits',
        'cover': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
        'keywords': ['pop', 'taylor swift', 'weeknd', 'ed sheeran', 'drake', 'billie eilish', 'dance', 'chart', 'billboard', 'dua lipa', 'bruno mars']
    },
    {
        'category': 'rock',
        'title': 'Your Rock & Energy Drive',
        'cover': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80',
        'keywords': ['rock', 'metal', 'guitar', 'drums', 'energetic', 'workout', 'gym', 'drive']
    }
]

def detect_category(text: str) -> dict:
    """Classify track metadata or search query into a musical genre/mood."""
    lower = text.lower()
    for cat in CATEGORY_MAPPINGS:
        for kw in cat['keywords']:
            if kw in lower:
                return cat
    # Default fallback
    return {
        'category': 'favorites_mix',
        'title': 'Your Daily Discovered Hits',
        'cover': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'
    }

@playlists_bp.route('/', methods=['GET'])
def get_user_playlists():
    user_id = get_auth_user_id()
    if not user_id:
        return jsonify({'playlists': [], 'smart_playlists': [], 'custom_playlists': []}), 200

    all_playlists = query_db("""
        SELECT p.*, COUNT(pt.track_id) as track_count
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY p.is_auto_generated ASC, p.updated_at DESC
    """, (user_id,))

    custom = [p for p in all_playlists if not p.get('is_auto_generated')]
    smart = [p for p in all_playlists if p.get('is_auto_generated')]

    return jsonify({
        'playlists': all_playlists,
        'custom_playlists': custom,
        'smart_playlists': smart
    }), 200

@playlists_bp.route('/<int:playlist_id>/tracks', methods=['GET'])
def get_playlist_tracks(playlist_id):
    playlist = query_db("SELECT * FROM playlists WHERE id = ?", (playlist_id,), one=True)
    if not playlist:
        return jsonify({'error': 'Playlist not found'}), 404

    tracks = query_db("""
        SELECT t.*, pt.position, pt.added_at
        FROM playlist_tracks pt
        JOIN tracks t ON pt.track_id = t.id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC, pt.added_at DESC
    """, (playlist_id,))

    return jsonify({'playlist': playlist, 'tracks': tracks}), 200

@playlists_bp.route('/', methods=['POST'])
def create_playlist():
    user_id = get_auth_user_id()
    if not user_id:
        return jsonify({'error': 'Please sign in or register to create custom playlists'}), 401

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    is_public = bool(data.get('is_public', True))

    if not title:
        return jsonify({'error': 'Playlist title is required'}), 400

    playlist_id, _ = execute_db("""
        INSERT INTO playlists (user_id, title, description, is_public, is_auto_generated)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, title, description, is_public, False))

    return jsonify({
        'message': 'Playlist created successfully',
        'playlist': {
            'id': playlist_id,
            'title': title,
            'description': description,
            'is_public': is_public,
            'is_auto_generated': False,
            'track_count': 0
        }
    }), 201

@playlists_bp.route('/<int:playlist_id>/tracks', methods=['POST'])
def add_track_to_playlist(playlist_id):
    user_id = get_auth_user_id()
    if not user_id:
        return jsonify({'error': 'Please sign in or register to add tracks to playlists'}), 401

    data = request.get_json() or {}
    track_id = data.get('track_id')
    if not track_id:
        return jsonify({'error': 'track_id is required'}), 400

    is_pg = is_postgres()
    if is_pg:
        execute_db("""
            INSERT INTO playlist_tracks (playlist_id, track_id)
            VALUES (?, ?)
            ON CONFLICT (playlist_id, track_id) DO NOTHING
        """, (playlist_id, track_id))
    else:
        execute_db("""
            INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id)
            VALUES (?, ?)
        """, (playlist_id, track_id))

    return jsonify({'status': 'added'}), 200

@playlists_bp.route('/auto-sort', methods=['POST'])
def auto_sort_track():
    """
    Automatically sorts searched/played tracks into designated Smart Playlists
    (e.g., 'Your Punjabi Mix', 'Your Retro Classics', 'Your Sad Vibes', etc.).
    Completely separate from user-created custom playlists.
    """
    user_id = get_auth_user_id()
    if not user_id:
        return jsonify({'status': 'guest_skipped'}), 200

    data = request.get_json() or {}
    track_id = data.get('track_id')
    query_hint = data.get('query', '')
    title_hint = data.get('title', '')
    artist_hint = data.get('artist', '')

    combined_text = f"{query_hint} {title_hint} {artist_hint}"
    category_info = detect_category(combined_text)

    # Check if this user already has this smart playlist
    smart_playlist = query_db("""
        SELECT * FROM playlists 
        WHERE user_id = ? AND is_auto_generated = ? AND category = ?
    """, (user_id, True, category_info['category']), one=True)

    if not smart_playlist:
        # Create the smart playlist
        pl_id, _ = execute_db("""
            INSERT INTO playlists (user_id, title, description, cover_url, is_public, is_auto_generated, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            category_info['title'],
            f"Automatically curated from your {category_info['category'].title()} listening history.",
            category_info['cover'],
            True,
            True,
            category_info['category']
        ))
        playlist_id = pl_id
    else:
        playlist_id = smart_playlist['id']

    # Insert track into the smart playlist
    if track_id:
        is_pg = is_postgres()
        if is_pg:
            execute_db("""
                INSERT INTO playlist_tracks (playlist_id, track_id)
                VALUES (?, ?)
                ON CONFLICT (playlist_id, track_id) DO NOTHING
            """, (playlist_id, track_id))
        else:
            execute_db("""
                INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id)
                VALUES (?, ?)
            """, (playlist_id, track_id))

    return jsonify({
        'status': 'auto_sorted',
        'category': category_info['category'],
        'playlist_title': category_info['title'],
        'playlist_id': playlist_id
    }), 200
