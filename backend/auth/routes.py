from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database.db import query_db, execute_db

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/me', methods=['GET'], strict_slashes=False)
def get_current_user():
    user_id = session.get('user_id')
    # Optional header fallback for strict cookie policies
    if not user_id:
        fallback_id = request.headers.get('X-User-Id')
        if fallback_id and fallback_id.isdigit():
            user_id = int(fallback_id)
            session['user_id'] = user_id
            session.permanent = True

    if not user_id:
        return jsonify({'authenticated': False, 'user': None}), 200
    
    user = query_db("""
        SELECT u.id, u.username, u.email, u.role, u.created_at,
               p.display_name, p.bio, p.avatar_url, p.banner_url
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = ? AND u.is_active
    """, (user_id,), one=True)
    
    if not user:
        session.clear()
        return jsonify({'authenticated': False, 'user': None}), 200
        
    return jsonify({
        'authenticated': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
            'display_name': user.get('display_name') or user['username'],
            'avatar_url': user.get('avatar_url') or '/static/images/default-avatar.png',
            'is_guest': user['username'].startswith('Guest_')
        }
    }), 200

@auth_bp.route('/guest', methods=['POST'], strict_slashes=False)
def create_guest():
    """Create a persistent guest user identity so visitors can use all features seamlessly."""
    from backend.database.db import create_guest_user
    user_id = create_guest_user()
    if not user_id:
        return jsonify({'error': 'Failed to create guest session'}), 500
    user = query_db("""
        SELECT u.id, u.username, u.email, u.role,
               p.display_name, p.avatar_url
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = ?
    """, (user_id,), one=True)
    return jsonify({
        'authenticated': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
            'display_name': user.get('display_name') or user['username'],
            'avatar_url': user.get('avatar_url') or '/static/images/default-avatar.png',
            'is_guest': True
        },
        'token': f"mw_token_{user_id}"
    }), 201

@auth_bp.route('/register', methods=['POST'], strict_slashes=False)
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    display_name = data.get('display_name', '').strip() or username

    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if not email or '@' not in email:
        return jsonify({'error': 'A valid email address is required'}), 400
    if not password:
        return jsonify({'error': 'Password is required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    existing_user = query_db("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,), one=True)
    if existing_user:
        return jsonify({'error': f'Username "@{username}" is already taken. Please choose another username.'}), 409

    existing_email = query_db("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (email,), one=True)
    if existing_email:
        return jsonify({'error': f'An account with email "{email}" already exists. Please sign in instead.'}), 409

    # Store plain password directly as requested (no hashing overhead)
    pwd_to_store = password
    try:
        user_id, _ = execute_db(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'user')",
            (username, email, pwd_to_store)
        )
        if not user_id:
            user_row = query_db("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,), one=True)
            if user_row:
                user_id = user_row['id']

        if not user_id:
            raise Exception("Unable to finalize user creation in database.")

        try:
            execute_db(
                "INSERT INTO user_profiles (user_id, display_name, avatar_url) VALUES (?, ?, '/static/images/default-avatar.png')",
                (user_id, display_name)
            )
        except Exception:
            pass

        try:
            execute_db("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
        except Exception:
            pass
        
        # Set permanent session for lifetime login
        session.permanent = True
        session['user_id'] = user_id
        session['username'] = username
        session['role'] = 'user'
        
        user_obj = {
            'id': user_id,
            'username': username,
            'email': email,
            'role': 'user',
            'display_name': display_name,
            'avatar_url': '/static/images/default-avatar.png',
            'is_guest': False
        }

        return jsonify({
            'message': f'Welcome to MusicWave, {display_name}!',
            'user': user_obj,
            'token': f"mw_token_{user_id}"
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create account: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'], strict_slashes=False)
def login():
    data = request.get_json() or {}
    identifier = (data.get('identifier') or data.get('email') or data.get('username') or '').strip()
    password = data.get('password', '')

    if not identifier:
        return jsonify({'error': 'Please enter your username or email address'}), 400
    if not password:
        return jsonify({'error': 'Please enter your password'}), 400

    user = query_db("""
        SELECT u.id, u.username, u.email, u.password_hash, u.role, u.is_active,
               p.display_name, p.avatar_url
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)
    """, (identifier, identifier), one=True)

    if not user:
        return jsonify({'error': f'No account found matching "{identifier}". Please check for typos or click "Create One".'}), 401

    stored_pwd = user.get('password_hash', '')
    is_match = (stored_pwd == password) or (
        stored_pwd.startswith('pbkdf2:') and check_password_hash(stored_pwd, password)
    )
    if not is_match:
        return jsonify({'error': 'Incorrect password. Please try again.'}), 401

    if not user.get('is_active', True):
        return jsonify({'error': 'This account has been disabled. Please contact support.'}), 403

    # Set permanent session for lifetime login
    session.permanent = True
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']

    user_obj = {
        'id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'role': user['role'],
        'display_name': user.get('display_name') or user['username'],
        'avatar_url': user.get('avatar_url') or '/static/images/default-avatar.png',
        'is_guest': user['username'].startswith('Guest_')
    }

    return jsonify({
        'message': f'Welcome back, {user_obj["display_name"]}!',
        'user': user_obj,
        'token': f"mw_token_{user['id']}"
    }), 200

@auth_bp.route('/logout', methods=['POST'], strict_slashes=False)
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200
