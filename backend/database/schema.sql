-- ====================================================================
-- MusicWave Database Schema (SQLite Compatible with PostgreSQL migration path)
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK(role IN ('user', 'guest', 'moderator', 'admin')),
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT DEFAULT '/static/images/default-avatar.png',
    banner_url TEXT,
    location VARCHAR(100),
    website VARCHAR(200),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. User Settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    theme VARCHAR(20) DEFAULT 'dark',
    audio_quality VARCHAR(20) DEFAULT 'high',
    volume REAL DEFAULT 0.8,
    is_profile_public BOOLEAN DEFAULT 1,
    allow_friend_requests BOOLEAN DEFAULT 1,
    allow_jam_invites BOOLEAN DEFAULT 1,
    show_listening_activity BOOLEAN DEFAULT 1,
    allow_profile_discovery BOOLEAN DEFAULT 1,
    offline_auto_sync BOOLEAN DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Friendships
CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'accepted' CHECK(status IN ('accepted', 'blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, friend_id)
);

-- 5. Friend Requests
CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(sender_id, receiver_id)
);

-- 6. Music Providers
CREATE TABLE IF NOT EXISTS music_providers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT 1,
    supports_search BOOLEAN DEFAULT 1,
    supports_download BOOLEAN DEFAULT 1,
    supports_jams BOOLEAN DEFAULT 1,
    api_endpoint TEXT,
    website_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Artists
CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(150) NOT NULL,
    provider_id VARCHAR(50) DEFAULT 'local',
    provider_artist_id VARCHAR(150),
    image_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES music_providers(id)
);

-- 8. Albums
CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    artist_id INTEGER,
    provider_id VARCHAR(50) DEFAULT 'local',
    provider_album_id VARCHAR(150),
    cover_url TEXT,
    release_date VARCHAR(50),
    genre VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
    FOREIGN KEY (provider_id) REFERENCES music_providers(id)
);

-- 9. Genres
CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(80) NOT NULL UNIQUE,
    slug VARCHAR(80) NOT NULL UNIQUE,
    color_accent VARCHAR(30) DEFAULT '#8b5cf6',
    image_url TEXT,
    is_active BOOLEAN DEFAULT 1
);

-- 10. Tracks (Unified internal music storage & cache)
CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id VARCHAR(50) NOT NULL,
    provider_track_id VARCHAR(200) NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(200) NOT NULL,
    artist_id INTEGER,
    album_name VARCHAR(200),
    album_id INTEGER,
    genre VARCHAR(100),
    duration INTEGER NOT NULL DEFAULT 0, -- in seconds
    artwork_url TEXT,
    stream_url TEXT NOT NULL,
    download_url TEXT,
    download_allowed BOOLEAN DEFAULT 1,
    streaming_allowed BOOLEAN DEFAULT 1,
    licence_information TEXT,
    licence_url TEXT,
    source_name VARCHAR(100),
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES music_providers(id),
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
    UNIQUE(provider_id, provider_track_id)
);

-- 11. Playlists
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    cover_url TEXT DEFAULT '/static/images/default-playlist.png',
    is_public BOOLEAN DEFAULT 1,
    is_auto_generated BOOLEAN DEFAULT 0,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. Playlist Tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, track_id)
);

-- 13. Favourites
CREATE TABLE IF NOT EXISTS favourites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE(user_id, track_id)
);

-- 14. Listening History
CREATE TABLE IF NOT EXISTS listening_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    listened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_played INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- 15. Jam Rooms
CREATE TABLE IF NOT EXISTS jam_rooms (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    host_id INTEGER NOT NULL,
    cover_url TEXT DEFAULT '/static/images/default-jam.png',
    is_public BOOLEAN DEFAULT 1,
    password_hash VARCHAR(255),
    join_code VARCHAR(10),
    code_expires_at TIMESTAMP,
    max_participants INTEGER DEFAULT 20,
    allow_guest_queue BOOLEAN DEFAULT 1,
    allow_guest_vote BOOLEAN DEFAULT 1,
    current_track_id INTEGER,
    playback_status VARCHAR(20) DEFAULT 'paused' CHECK(playback_status IN ('playing', 'paused', 'stopped')),
    playback_position REAL DEFAULT 0.0,
    playback_started_at TIMESTAMP,
    playback_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    playback_version INTEGER DEFAULT 1,
    repeat_mode VARCHAR(20) DEFAULT 'off' CHECK(repeat_mode IN ('off', 'all', 'one')),
    shuffle_enabled BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

-- 16. Jam Participants
CREATE TABLE IF NOT EXISTS jam_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id VARCHAR(64) NOT NULL,
    user_id INTEGER NOT NULL,
    is_host BOOLEAN DEFAULT 0,
    is_muted BOOLEAN DEFAULT 0,
    listening_status VARCHAR(30) DEFAULT 'listening',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES jam_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(room_id, user_id)
);

-- 17. Jam Queue
CREATE TABLE IF NOT EXISTS jam_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id VARCHAR(64) NOT NULL,
    track_id INTEGER NOT NULL,
    added_by INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    votes_count INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES jam_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 18. Jam Messages (Live Chat)
CREATE TABLE IF NOT EXISTS jam_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id VARCHAR(64) NOT NULL,
    user_id INTEGER NOT NULL,
    message_type VARCHAR(20) DEFAULT 'chat' CHECK(message_type IN ('chat', 'system', 'suggestion', 'reaction')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_moderated BOOLEAN DEFAULT 0,
    FOREIGN KEY (room_id) REFERENCES jam_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 19. Jam Invitations
CREATE TABLE IF NOT EXISTS jam_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id VARCHAR(64) NOT NULL,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES jam_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 20. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sender_id INTEGER,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    reference_id VARCHAR(100),
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 21. Downloaded Track Metadata (Local sync registry)
CREATE TABLE IF NOT EXISTS downloaded_track_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type VARCHAR(50) DEFAULT 'audio/mpeg',
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE(user_id, track_id)
);

-- 22. Reports
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    reported_user_id INTEGER,
    reported_room_id VARCHAR(64),
    reported_message_id INTEGER,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 23. Admin Logs
CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create Essential Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tracks_provider ON tracks(provider_id, provider_track_id);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_history_user ON listening_history(user_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS idx_favourites_user ON favourites(user_id);
CREATE INDEX IF NOT EXISTS idx_jam_active ON jam_rooms(is_active, is_public);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- Recommendation Engine: Markov Song-to-Song Transition Matrix
CREATE TABLE IF NOT EXISTS song_transitions (
    from_track_id INTEGER NOT NULL,
    to_track_id INTEGER NOT NULL,
    transition_count INTEGER DEFAULT 1,
    last_transition_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (from_track_id, to_track_id)
);

-- Recommendation Engine: User Taste & Affinity Profiles
CREATE TABLE IF NOT EXISTS user_taste_profiles (
    user_id INTEGER NOT NULL,
    genre VARCHAR(60) NOT NULL,
    affinity_score REAL DEFAULT 1.0,
    play_count INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, genre)
);
