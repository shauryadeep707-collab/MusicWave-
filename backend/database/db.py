import sqlite3
import os
from pathlib import Path
from flask import g, current_app
from werkzeug.security import generate_password_hash

# Try importing psycopg2 for PostgreSQL / Supabase
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

def is_postgres():
    db_url = current_app.config.get('DATABASE_URL', '')
    return bool(db_url and (db_url.startswith('postgresql://') or db_url.startswith('postgres://')))

def get_db():
    """Retrieve or create a database connection for current request context."""
    if 'db' not in g:
        if is_postgres():
            if not PSYCOPG2_AVAILABLE:
                raise RuntimeError("psycopg2-binary is required for PostgreSQL/Supabase connections.")
            db_url = current_app.config['DATABASE_URL']
            # Supabase uses postgresql://, fix postgres:// if from legacy heroku/render format
            if db_url.startswith('postgres://'):
                db_url = db_url.replace('postgres://', 'postgresql://', 1)
            g.db = psycopg2.connect(db_url)
            g.is_pg = True
        else:
            db_path = current_app.config['DATABASE_PATH']
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            g.db = sqlite3.connect(
                db_path,
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA foreign_keys = ON;")
            g.is_pg = False
    return g.db

def close_db(e=None):
    """Close the database connection at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(app):
    """Initialize database tables and initial seed data."""
    with app.app_context():
        try:
            if is_postgres():
                init_postgres_db()
            else:
                init_sqlite_db()
        except Exception as e:
            print(f"[Database Error during init_db]: {e}")

def init_sqlite_db():
    db = get_db()
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        db.executescript(f.read())
    seed_common_data(db, is_pg=False)
    db.commit()

def init_postgres_db():
    db = get_db()
    cur = db.cursor()
    # Execute table definitions for PostgreSQL
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(120) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            display_name VARCHAR(100),
            bio TEXT,
            avatar_url TEXT DEFAULT '/static/images/default-avatar.png',
            banner_url TEXT,
            location VARCHAR(100),
            website VARCHAR(200),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            theme VARCHAR(20) DEFAULT 'dark',
            audio_quality VARCHAR(20) DEFAULT 'high',
            volume REAL DEFAULT 0.8,
            is_profile_public BOOLEAN DEFAULT TRUE,
            allow_friend_requests BOOLEAN DEFAULT TRUE,
            allow_jam_invites BOOLEAN DEFAULT TRUE,
            show_listening_activity BOOLEAN DEFAULT TRUE,
            allow_profile_discovery BOOLEAN DEFAULT TRUE,
            offline_auto_sync BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS music_providers (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            is_enabled BOOLEAN DEFAULT TRUE,
            supports_search BOOLEAN DEFAULT TRUE,
            supports_download BOOLEAN DEFAULT TRUE,
            supports_jams BOOLEAN DEFAULT TRUE,
            api_endpoint TEXT,
            website_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS genres (
            id SERIAL PRIMARY KEY,
            name VARCHAR(80) NOT NULL UNIQUE,
            slug VARCHAR(80) NOT NULL UNIQUE,
            color_accent VARCHAR(30) DEFAULT '#8b5cf6',
            image_url TEXT,
            is_active BOOLEAN DEFAULT TRUE
        );
        CREATE TABLE IF NOT EXISTS tracks (
            id SERIAL PRIMARY KEY,
            provider_id VARCHAR(50) REFERENCES music_providers(id),
            provider_track_id VARCHAR(200) NOT NULL,
            title VARCHAR(255) NOT NULL,
            artist_name VARCHAR(200) NOT NULL,
            artist_id INTEGER,
            album_name VARCHAR(200),
            album_id INTEGER,
            genre VARCHAR(100),
            duration INTEGER NOT NULL DEFAULT 0,
            artwork_url TEXT,
            stream_url TEXT NOT NULL,
            download_url TEXT,
            download_allowed BOOLEAN DEFAULT TRUE,
            streaming_allowed BOOLEAN DEFAULT TRUE,
            licence_information TEXT,
            licence_url TEXT,
            source_name VARCHAR(100),
            play_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(provider_id, provider_track_id)
        );
        CREATE TABLE IF NOT EXISTS playlists (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            cover_url TEXT DEFAULT '/static/images/default-playlist.png',
            is_public BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS playlist_tracks (
            id SERIAL PRIMARY KEY,
            playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
            position INTEGER DEFAULT 0,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(playlist_id, track_id)
        );
        CREATE TABLE IF NOT EXISTS favourites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, track_id)
        );
        CREATE TABLE IF NOT EXISTS jam_rooms (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            cover_url TEXT DEFAULT '/static/images/default-jam.png',
            is_public BOOLEAN DEFAULT TRUE,
            password_hash VARCHAR(255),
            max_participants INTEGER DEFAULT 20,
            allow_guest_queue BOOLEAN DEFAULT TRUE,
            allow_guest_vote BOOLEAN DEFAULT TRUE,
            current_track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
            playback_status VARCHAR(20) DEFAULT 'paused',
            playback_position REAL DEFAULT 0.0,
            playback_started_at TIMESTAMP,
            playback_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            playback_version INTEGER DEFAULT 1,
            repeat_mode VARCHAR(20) DEFAULT 'off',
            shuffle_enabled BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS jam_participants (
            id SERIAL PRIMARY KEY,
            room_id VARCHAR(64) NOT NULL REFERENCES jam_rooms(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            is_host BOOLEAN DEFAULT FALSE,
            is_muted BOOLEAN DEFAULT FALSE,
            listening_status VARCHAR(30) DEFAULT 'listening',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(room_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS jam_queue (
            id SERIAL PRIMARY KEY,
            room_id VARCHAR(64) NOT NULL REFERENCES jam_rooms(id) ON DELETE CASCADE,
            track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
            added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            position INTEGER DEFAULT 0,
            votes_count INTEGER DEFAULT 0,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS jam_messages (
            id SERIAL PRIMARY KEY,
            room_id VARCHAR(64) NOT NULL REFERENCES jam_rooms(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message_type VARCHAR(20) DEFAULT 'chat',
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_moderated BOOLEAN DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS friendships (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'accepted',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, friend_id)
        );
        CREATE TABLE IF NOT EXISTS friend_requests (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(sender_id, receiver_id)
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            reference_id VARCHAR(100),
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS downloaded_track_metadata (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
            file_size INTEGER DEFAULT 0,
            mime_type VARCHAR(50) DEFAULT 'audio/mpeg',
            downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, track_id)
        );
    """)
    db.commit()
    seed_common_data(db, is_pg=True)
    db.commit()

def seed_common_data(db, is_pg=False):
    cur = db.cursor()
    # Seed Providers
    providers = [
        ("jamendo", "Jamendo Music", "Free, legal CC-licensed music from independent artists worldwide.", True, True, True, True, "https://api.jamendo.com/v3.0", "https://www.jamendo.com"),
        ("internet_archive", "Internet Archive", "Non-profit library of millions of free books, movies, software, music, and audio.", True, True, True, True, "https://archive.org/advancedsearch.php", "https://archive.org"),
        ("freemusicarchive", "Free Music Archive", "Openly licensed independent music curation.", True, True, True, True, "https://freemusicarchive.org/api", "https://freemusicarchive.org"),
        ("local", "MusicWave Local Vault", "Platform-verified royalty-free & admin-uploaded high fidelity tracks.", True, True, True, True, "/api/music/local", "")
    ]
    
    if is_pg:
        cur.executemany("""
            INSERT INTO music_providers (id, name, description, is_enabled, supports_search, supports_download, supports_jams, api_endpoint, website_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, providers)
    else:
        cur.executemany("""
            INSERT OR IGNORE INTO music_providers (id, name, description, is_enabled, supports_search, supports_download, supports_jams, api_endpoint, website_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, providers)

    # Seed Genres
    genres = [
        ("Bollywood", "bollywood", "#f43f5e", "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80"),
        ("Hindi", "hindi", "#fb923c", "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80"),
        ("Punjabi", "punjabi", "#eab308", "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80"),
        ("Pop", "pop", "#ec4899", "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80"),
        ("Lo-fi", "lo-fi", "#8b5cf6", "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80"),
        ("Electronic", "electronic", "#06b6d4", "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80"),
        ("Rock", "rock", "#ef4444", "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80"),
        ("Hip-Hop", "hip-hop", "#f97316", "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&q=80"),
        ("Indie", "indie", "#10b981", "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&q=80"),
        ("Classical", "classical", "#3b82f6", "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&q=80"),
        ("Instrumental", "instrumental", "#6366f1", "https://images.unsplash.com/photo-1445985543469-7233886ff323?w=500&q=80"),
        ("Ambient", "ambient", "#14b8a6", "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=500&q=80")
    ]
    if is_pg:
        cur.executemany("""
            INSERT INTO genres (name, slug, color_accent, image_url, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
            ON CONFLICT (name) DO NOTHING
        """, genres)
    else:
        cur.executemany("""
            INSERT OR IGNORE INTO genres (name, slug, color_accent, image_url, is_active)
            VALUES (?, ?, ?, ?, 1)
        """, genres)

    # Seed Admin User
    admin_sql = "SELECT id FROM users WHERE username = %s" if is_pg else "SELECT id FROM users WHERE username = ?"
    cur.execute(admin_sql, ('admin',))
    admin = cur.fetchone()
    if not admin:
        admin_pwd = generate_password_hash("admin123", method="pbkdf2:sha256")
        if is_pg:
            cur.execute("""
                INSERT INTO users (username, email, password_hash, role)
                VALUES (%s, %s, %s, %s) RETURNING id
            """, ('admin', 'admin@musicwave.io', admin_pwd, 'admin'))
            admin_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO user_profiles (user_id, display_name, bio, avatar_url)
                VALUES (%s, 'System Administrator', 'MusicWave Core Platform Administrator', '/static/images/default-avatar.png')
                ON CONFLICT (user_id) DO NOTHING
            """, (admin_id,))
            cur.execute("INSERT INTO user_settings (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING", (admin_id,))
        else:
            cur.execute("""
                INSERT INTO users (username, email, password_hash, role)
                VALUES (?, ?, ?, ?)
            """, ('admin', 'admin@musicwave.io', admin_pwd, 'admin'))
            admin_id = cur.lastrowid
            cur.execute("""
                INSERT INTO user_profiles (user_id, display_name, bio, avatar_url)
                VALUES (?, 'System Administrator', 'MusicWave Core Platform Administrator', '/static/images/default-avatar.png')
            """, (admin_id,))
            cur.execute("INSERT INTO user_settings (user_id) VALUES (?)", (admin_id,))

def query_db(query, args=(), one=False):
    """Query database safely across SQLite and PostgreSQL."""
    db = get_db()
    if is_postgres():
        cur = db.cursor(cursor_factory=RealDictCursor)
        # Adapt placeholders and functions for Postgres
        pg_query = query.replace('?', '%s').replace('RANDOM()', 'RANDOM()')
        cur.execute(pg_query, args)
        rv = cur.fetchall()
        cur.close()
        return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]
    else:
        cur = db.execute(query, args)
        rv = cur.fetchall()
        cur.close()
        return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]

def execute_db(query, args=(), commit=True):
    """Execute insert, update, delete safely across SQLite and PostgreSQL."""
    db = get_db()
    if is_postgres():
        cur = db.cursor()
        pg_query = query.replace('?', '%s')
        # If insert, append RETURNING id to get lastrowid
        is_insert = pg_query.strip().upper().startswith('INSERT')
        if is_insert and 'RETURNING' not in pg_query.upper():
            pg_query = pg_query.rstrip(';') + ' RETURNING id;'
            cur.execute(pg_query, args)
            last_id = cur.fetchone()[0]
        else:
            cur.execute(pg_query, args)
            last_id = None
        row_count = cur.rowcount
        if commit:
            db.commit()
        cur.close()
        return last_id, row_count
    else:
        cur = db.execute(query, args)
        if commit:
            db.commit()
        last_id = cur.lastrowid
        row_count = cur.rowcount
        cur.close()
        return last_id, row_count
