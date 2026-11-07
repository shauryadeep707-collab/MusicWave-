import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "musicwave_default_secure_secret_key_2026")
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    PORT = int(os.getenv("PORT", 5000))

    # Permanent Lifetime Session (10 Years)
    PERMANENT_SESSION_LIFETIME = timedelta(days=3650)
    SESSION_COOKIE_NAME = "musicwave_permanent_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    
    # Database (Supabase PostgreSQL or fallback to local SQLite)
    DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
    DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "instance" / "musicwave.db"))
    
    # Upload Directories
    UPLOAD_FOLDER = BASE_DIR / os.getenv("UPLOAD_FOLDER", "uploads")
    AUDIO_UPLOAD_FOLDER = UPLOAD_FOLDER / "audio"
    COVERS_UPLOAD_FOLDER = UPLOAD_FOLDER / "covers"
    AVATARS_UPLOAD_FOLDER = UPLOAD_FOLDER / "avatars"
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 32 * 1024 * 1024))
    
    # Allowed Extensions
    ALLOWED_AUDIO_EXTENSIONS = {"mp3", "wav", "ogg", "flac"}
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
    
    # Music Provider Credentials & Switches
    JAMENDO_CLIENT_ID = os.getenv("JAMENDO_CLIENT_ID", "").strip()
    JAMENDO_CLIENT_SECRET = os.getenv("JAMENDO_CLIENT_SECRET", "").strip()
    
    INTERNET_ARCHIVE_ENABLED = os.getenv("INTERNET_ARCHIVE_ENABLED", "true").lower() in ("true", "1", "yes")
    
    FREE_MUSIC_ARCHIVE_ENABLED = os.getenv("FREE_MUSIC_ARCHIVE_ENABLED", "true").lower() in ("true", "1", "yes")
    FREE_MUSIC_ARCHIVE_API_KEY = os.getenv("FREE_MUSIC_ARCHIVE_API_KEY", "").strip()
    
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "").strip()
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "").strip()
    
    LASTFM_API_KEY = os.getenv("LASTFM_API_KEY", "").strip()

    @classmethod
    def init_folders(cls):
        """Ensure all required runtime directories exist."""
        (BASE_DIR / "instance").mkdir(parents=True, exist_ok=True)
        cls.AUDIO_UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
        cls.COVERS_UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
        cls.AVATARS_UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
