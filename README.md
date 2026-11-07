# MusicWave – Free Online & Offline Music Streaming and Social Listening Platform

MusicWave is a free, modern music streaming web application built with Python Flask, Flask-SocketIO, and Vanilla JavaScript. It combines the sleek music discovery of Spotify & Apple Music, the synchronized social listening of Spotify Jam & Discord, and the offline resiliency of Progressive Web Apps.

---

## 🚀 Key Features

1. **Free Legal Music Discovery**
   - Stream legally licensed music from Jamendo, Internet Archive, and open public repositories.
   - Zero required paid subscriptions or locked DRM bypasses.

2. **Offline Download Manager**
   - Download legally authorized songs directly to browser storage via IndexedDB.
   - Complete offline playback without needing an active internet connection.

3. **Music Jam – Real-Time Group Listening**
   - Create public or private virtual Jam rooms.
   - Listen to synchronized music with friends via WebSockets (Flask-SocketIO).
   - Real-time live room chat, reactions, and shared queue voting.

4. **Progressive Web App (PWA)**
   - Service worker shell caching.
   - Installable on desktop, Android, and iOS devices.

5. **Audio Player Engine**
   - Persistent bottom player bar with seek bar, queue, volume, shuffle, repeat, and favorites.

---

## 🛠️ Technology Stack

- **Backend:** Python 3.12, Flask 3.x, Flask-SocketIO, RESTful API
- **Database:** SQLite with full normalized schema (migration-ready for PostgreSQL)
- **Real-Time:** WebSockets / Flask-SocketIO
- **Frontend:** Vanilla HTML5, CSS3, Modern JavaScript (Fetch API, HTML5 Audio, IndexedDB)
- **PWA:** Service Worker Cache API & Web App Manifest

---

## 📦 Installation & Setup

### 1. Clone & Enter Directory
```bash
cd "c:\Users\shaur\OneDrive\Desktop\music free"
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Initialize & Start the Server
```bash
python app.py
```
By default, the server will launch at:
👉 **`http://127.0.0.1:5000`**

### 4. Default Admin Credentials
- **Username:** `admin`
- **Email:** `admin@musicwave.io`
- **Password:** `admin123`

---

## 📁 Project Structure

```
musicwave/
├── app.py                      # Main application entry point
├── config.py                   # Configuration & environment loader
├── requirements.txt            # Python dependencies
├── .env.example                # Example environment variables
├── README.md                   # Project documentation
│
├── backend/
│   ├── __init__.py             # Flask App Factory & SocketIO init
│   ├── auth/                   # Authentication & Session endpoints
│   ├── music/                  # Music catalog, trending, search
│   ├── providers/              # Unified music provider adapters
│   ├── downloads/              # Download permissions & metadata sync
│   ├── playlists/              # Playlist CRUD & tracks management
│   ├── favourites/             # User favourite tracks
│   ├── jams/                   # Music Jam rooms & participant APIs
│   ├── friends/                # Social graph & friend requests
│   ├── notifications/          # In-app notifications
│   ├── admin/                  # Administrative tools & analytics
│   ├── database/               # SQLite connection & schema.sql
│   └── sockets/                # Real-time WebSocket event handlers
│
├── static/
│   ├── css/                    # Modular stylesheets (variables, layout, player)
│   ├── js/                     # API client, reactive state, UI views, app bootstrap
│   ├── images/                 # Artwork, icons, avatars
│   ├── manifest.json           # PWA Web App Manifest
│   ├── service-worker.js       # PWA Offline Shell Caching
│   └── offline.html            # Offline Fallback page
│
├── templates/
│   └── index.html              # Main application shell
└── instance/                   # Runtime SQLite database
```
