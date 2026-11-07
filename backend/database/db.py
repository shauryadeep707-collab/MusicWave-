import sqlite3
import os
from pathlib import Path
from flask import g, current_app
from werkzeug.security import generate_password_hash

def get_db():
    """Retrieve or create an SQLite database connection for the current Flask request context."""
    if 'db' not in g:
        db_path = current_app.config['DATABASE_PATH']
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        g.db = sqlite3.connect(
            db_path,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db

def close_db(e=None):
    """Close the database connection at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(app):
    """Initialize database tables and initial seed data."""
    with app.app_context():
        db = get_db()
        schema_path = Path(__file__).parent / "schema.sql"
        with open(schema_path, "r", encoding="utf-8") as f:
            db.executescript(f.read())
        
        # Seed Music Providers
        providers = [
            ("jamendo", "Jamendo Music", "Free, legal CC-licensed music from independent artists worldwide.", 1, 1, 1, 1, "https://api.jamendo.com/v3.0", "https://www.jamendo.com"),
            ("internet_archive", "Internet Archive", "Non-profit library of millions of free books, movies, software, music, and audio.", 1, 1, 1, 1, "https://archive.org/advancedsearch.php", "https://archive.org"),
            ("freemusicarchive", "Free Music Archive", "Openly licensed independent music curation.", 1, 1, 1, 1, "https://freemusicarchive.org/api", "https://freemusicarchive.org"),
            ("local", "MusicWave Local Vault", "Platform-verified royalty-free & admin-uploaded high fidelity tracks.", 1, 1, 1, 1, "/api/music/local", "")
        ]
        db.executemany("""
            INSERT OR IGNORE INTO music_providers (id, name, description, is_enabled, supports_search, supports_download, supports_jams, api_endpoint, website_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, providers)

        # Seed Genres with vibrant colors matching design system
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
        db.executemany("""
            INSERT OR IGNORE INTO genres (name, slug, color_accent, image_url, is_active)
            VALUES (?, ?, ?, ?, 1)
        """, genres)

        # Seed Default Admin Account if not exists
        admin = db.execute("SELECT id FROM users WHERE username = 'admin'").fetchone()
        if not admin:
            admin_pwd = generate_password_hash("admin123", method="pbkdf2:sha256")
            cursor = db.execute("""
                INSERT INTO users (username, email, password_hash, role)
                VALUES ('admin', 'admin@musicwave.io', ?, 'admin')
            """, (admin_pwd,))
            admin_id = cursor.lastrowid
            
            db.execute("""
                INSERT INTO user_profiles (user_id, display_name, bio, avatar_url)
                VALUES (?, 'System Administrator', 'MusicWave Core Platform Administrator', '/static/images/default-avatar.png')
            """, (admin_id,))
            
            db.execute("""
                INSERT INTO user_settings (user_id)
                VALUES (?)
            """, (admin_id,))

        db.commit()

def query_db(query, args=(), one=False):
    """Convenience helper to query database and return dictionary objects."""
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]

def execute_db(query, args=(), commit=True):
    """Convenience helper to execute an insert, update or delete."""
    db = get_db()
    cur = db.execute(query, args)
    if commit:
        db.commit()
    last_id = cur.lastrowid
    row_count = cur.rowcount
    cur.close()
    return last_id, row_count
