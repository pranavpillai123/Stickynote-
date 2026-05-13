"""
StickyBoard — Flask Backend with SQLite Database
========================================================
Stores users and notes in a SQLite database.
Provides login, register, logout, and session-check endpoints.
"""

import os
import csv
import hashlib
import secrets
import sqlite3
from functools import wraps

from flask import Flask, request, jsonify, session, send_from_directory, redirect

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = secrets.token_hex(32)

# ── Database Setup ──────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), 'stickyboard.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                title TEXT,
                content TEXT,
                color TEXT,
                created_at DATETIME,
                updated_at DATETIME,
                reminder_at DATETIME,
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
            )
        ''')
        conn.commit()

        try:
            conn.execute('ALTER TABLE notes ADD COLUMN reminder_at DATETIME')
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Simple migration from CSV if DB is empty
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM users")
        if cursor.fetchone()['count'] == 0:
            users_csv = os.path.join(os.path.dirname(__file__), 'users.csv')
            if os.path.exists(users_csv):
                with open(users_csv, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        try:
                            cursor.execute(
                                'INSERT INTO users (username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
                                (row.get('username'), row.get('email'), row.get('password_hash'), row.get('salt'), row.get('created_at'))
                            )
                        except Exception:
                            pass

            notes_csv = os.path.join(os.path.dirname(__file__), 'notes.csv')
            if os.path.exists(notes_csv):
                with open(notes_csv, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        try:
                            cursor.execute(
                                'INSERT INTO notes (id, username, title, content, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                (row.get('id'), row.get('username'), row.get('title'), row.get('content'), row.get('color'), row.get('created_at'), row.get('updated_at'))
                            )
                        except Exception:
                            pass
            conn.commit()

init_db()

def _hash_password(password: str, salt: str) -> str:
    """SHA-256 hash with salt."""
    return hashlib.sha256((salt + password).encode()).hexdigest()


# ── Auth Decorator ──────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


# ── API Routes ──────────────────────────────────────────────────────────────

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    # Validation
    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400

    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if '@' not in email or '.' not in email:
        return jsonify({'error': 'Invalid email address'}), 400

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check duplicates
            cursor.execute('SELECT username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', (username, email))
            existing_user = cursor.fetchone()
            
            if existing_user:
                if existing_user['username'].lower() == username.lower():
                    return jsonify({'error': 'Username already taken'}), 409
                if existing_user['email'].lower() == email.lower():
                    return jsonify({'error': 'Email already registered'}), 409

            # Create user
            salt = secrets.token_hex(16)
            password_hash = _hash_password(password, salt)
            
            cursor.execute(
                'INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)',
                (username, email, password_hash, salt)
            )
            conn.commit()

            # Auto-login after registration
            session['user'] = username
            return jsonify({'message': 'Account created successfully', 'username': username}), 201
            
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or Email already taken'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    identifier = data.get('username', '').strip()   # can be username or email
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'error': 'Username/email and password are required'}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT username, password_hash, salt FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
            (identifier, identifier)
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401

        if _hash_password(password, user['salt']) != user['password_hash']:
            return jsonify({'error': 'Invalid credentials'}), 401

        session['user'] = user['username']
        return jsonify({'message': 'Login successful', 'username': user['username']}), 200


@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'message': 'Logged out'}), 200


@app.route('/api/me')
def me():
    if 'user' in session:
        return jsonify({'authenticated': True, 'username': session['user']}), 200
    return jsonify({'authenticated': False}), 200


# ── Notes Data & Routes (SQLite) ────────────────────────────────────────────

@app.route('/api/notes', methods=['GET'])
@login_required
def get_notes():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id, title, content, color, created_at as createdAt, updated_at as updatedAt, reminder_at as reminderAt FROM notes WHERE username = ?',
            (session['user'],)
        )
        notes = [dict(row) for row in cursor.fetchall()]
        return jsonify(notes)


@app.route('/api/notes', methods=['POST'])
@login_required
def save_notes():
    notes_data = request.get_json(silent=True) or []
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Remove old notes for this user
        cursor.execute('DELETE FROM notes WHERE username = ?', (session['user'],))
        
        # Add new notes
        if notes_data:
            notes_to_insert = [
                (
                    n.get('id'),
                    session['user'],
                    n.get('title', ''),
                    n.get('content', ''),
                    n.get('color', 'yellow'),
                    n.get('createdAt'),
                    n.get('updatedAt'),
                    n.get('reminderAt')
                )
                for n in notes_data
            ]
            cursor.executemany(
                'INSERT INTO notes (id, username, title, content, color, created_at, updated_at, reminder_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                notes_to_insert
            )
        
        conn.commit()
        
    return jsonify({'message': 'Notes saved successfully'})


# ── Page Routes ─────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """Redirect to login if not authenticated, otherwise serve the app."""
    if 'user' not in session:
        return send_from_directory('.', 'login.html')
    return send_from_directory('.', 'index.html')


@app.route('/login')
def login_page():
    return send_from_directory('.', 'login.html')


@app.route('/app')
def app_page():
    if 'user' not in session:
        return redirect('/login')
    return send_from_directory('.', 'index.html')


# ── Serve Static Assets ────────────────────────────────────────────────────

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)


# ── Run ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("\n  StickyBoard Server running at http://localhost:5000\n")
    app.run(debug=True, port=5000)
