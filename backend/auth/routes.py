from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database.db import query_db, execute_db

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/me', methods=['GET'])
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
        
    return jsonify({'authenticated': True, 'user': user}), 200

@auth_bp.route('/guest', methods=['POST'])
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
        'user': user,
        'token': f"mw_token_{user_id}"
    }), 201

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    display_name = data.get('display_name', '').strip() or username

    if not username or not email or not password:
        return jsonify({'error': 'Username, email and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    existing = query_db("SELECT id FROM users WHERE username = ? OR email = ?", (username, email), one=True)
    if existing:
        return jsonify({'error': 'Username or email is already registered'}), 409

    pwd_hash = generate_password_hash(password, method='pbkdf2:sha256')
    try:
        user_id, _ = execute_db(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, pwd_hash)
        )
        execute_db(
            "INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)",
            (user_id, display_name)
        )
        execute_db("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
        
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
            'avatar_url': '/static/images/default-avatar.png'
        }

        return jsonify({
            'message': 'Registration successful',
            'user': user_obj,
            'token': f"mw_token_{user_id}"
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create account: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    identifier = data.get('identifier', '').strip()
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'error': 'Identifier and password are required'}), 400

    user = query_db("""
        SELECT u.id, u.username, u.email, u.password_hash, u.role, u.is_active,
               p.display_name, p.avatar_url
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.username = ? OR u.email = ?
    """, (identifier, identifier.lower()), one=True)

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid credentials'}), 401
    if not user['is_active']:
        return jsonify({'error': 'Account has been disabled'}), 403

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
        'display_name': user['display_name'] or user['username'],
        'avatar_url': user['avatar_url'] or '/static/images/default-avatar.png'
    }

    return jsonify({
        'message': 'Login successful',
        'user': user_obj,
        'token': f"mw_token_{user['id']}"
    }), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200
