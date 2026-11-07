import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from backend import create_app, socketio
from config import Config

app = create_app()

if __name__ == '__main__':
    port = Config.PORT
    debug = Config.DEBUG
    print(f"[MusicWave] Server booting on http://127.0.0.1:{port} (Debug={debug})")
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
