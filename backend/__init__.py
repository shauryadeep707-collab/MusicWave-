import os
from flask import Flask, render_template, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

from config import Config
from backend.database.db import close_db, init_db
from backend.sockets import register_socket_events

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading')

def create_app(config_class=Config):
    app = Flask(
        __name__,
        static_folder='../static',
        template_folder='../templates'
    )
    app.config.from_object(config_class)
    
    # Initialize runtime folders
    config_class.init_folders()

    # Enable CORS
    CORS(app)

    # Database teardown registration
    app.teardown_appcontext(close_db)

    # Initialize Database Schema & Seed Data
    init_db(app)

    # Register Blueprints
    from backend.auth import auth_bp
    from backend.music import music_bp
    from backend.playlists import playlists_bp
    from backend.favourites import favourites_bp
    from backend.downloads import downloads_bp
    from backend.jams import jams_bp
    from backend.friends import friends_bp
    from backend.notifications import notifications_bp
    from backend.admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(music_bp)
    app.register_blueprint(playlists_bp)
    app.register_blueprint(favourites_bp)
    app.register_blueprint(downloads_bp)
    app.register_blueprint(jams_bp)
    app.register_blueprint(friends_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(admin_bp)

    # Health Check API
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': 'MusicWave',
            'version': '1.0.0',
            'online_mode': True
        })

    # Serve Main Application Shell
    @app.route('/')
    @app.route('/explore')
    @app.route('/search')
    @app.route('/library')
    @app.route('/downloads')
    @app.route('/favourites')
    @app.route('/jams')
    @app.route('/jams/<room_id>')
    @app.route('/friends')
    @app.route('/profile')
    @app.route('/settings')
    @app.route('/admin')
    def index(room_id=None):
        return render_template('index.html')

    # Initialize WebSockets
    socketio.init_app(app)
    register_socket_events(socketio)

    return app
