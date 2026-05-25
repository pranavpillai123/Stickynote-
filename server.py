"""
StickyBoard — Flask Backend with SQLite Database
========================================================
Stores users and notes in a local SQLite database.
Provides login, register, logout, and session-check endpoints.
Serves the React frontend build in production.
"""

import os
import hashlib
import secrets
import sqlite3
import threading
import random
import time
from datetime import datetime, date
from functools import wraps

from flask import Flask, request, jsonify, session, send_from_directory, redirect, g
from flask_cors import CORS

from reminder_worker import send_whatsapp


# ── App Setup ───────────────────────────────────────────────────────────────

# In production, serve from the React build folder
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')

app = Flask(__name__, static_folder=None)
app.secret_key = secrets.token_hex(32)

# Session cookie settings for cross-origin dev mode
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True

# Allow CORS for the React dev server (both localhost and 127.0.0.1)
CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
])

# ── SQLite Configuration ────────────────────────────────────────────────────

DATABASE = os.path.join(os.path.dirname(__file__), 'stickyboard.db')


def get_db():
    """Get a database connection for the current request."""
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Close the database connection at the end of each request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Create tables if they don't exist, wiping and recreating them if schema updates are needed."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # Check if database migration is needed (presence of phone_number in users table)
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]
        if columns and 'phone_number' not in columns:
            print("  [!] Outdated database schema (missing phone_number). Wiping database...")
            cursor.execute("DROP TABLE IF EXISTS reminder_notifications")
            cursor.execute("DROP TABLE IF EXISTS notes")
            cursor.execute("DROP TABLE IF EXISTS users")
            conn.commit()
    except Exception as e:
        print(f"  [!] Error checking users schema: {e}")

    # Check if reminder_notifications table needs migration (presence of reminder_at column)
    try:
        cursor.execute("PRAGMA table_info(reminder_notifications)")
        columns = [row[1] for row in cursor.fetchall()]
        if columns and 'reminder_at' not in columns:
            print("  [!] Outdated reminder_notifications schema (missing reminder_at). Migrating...")
            cursor.execute("DROP TABLE IF EXISTS reminder_notifications")
            conn.commit()
    except Exception as e:
        print(f"  [!] Error checking reminder_notifications schema: {e}")

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            title TEXT,
            content TEXT,
            color TEXT DEFAULT 'yellow',
            font TEXT DEFAULT 'Caveat',
            created_at TEXT,
            updated_at TEXT,
            reminder_at TEXT,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminder_notifications (
            note_id TEXT,
            threshold TEXT,
            reminder_at TEXT,
            sent_at TEXT,
            PRIMARY KEY (note_id, threshold, reminder_at)
        )
    ''')

    conn.commit()
    conn.close()
    print(f"  [+] Database initialized: {DATABASE}")


# ── Initialize ──
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

@app.route('/api/otp/send', methods=['POST'])
def send_otp():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    phone_number = data.get('phone_number', '').strip()

    if not username or not email or not phone_number:
        return jsonify({'error': 'Username, email, and phone number are required'}), 400

    if '@' not in email or '.' not in email:
        return jsonify({'error': 'Invalid email address'}), 400

    if not phone_number.startswith('+') or not phone_number[1:].isdigit() or len(phone_number) < 8:
        return jsonify({'error': 'Invalid phone number format. Must include country code (e.g. +91XXXXXXXXXX)'}), 400

    db = get_db()
    try:
        # Check duplicates
        existing = db.execute(
            'SELECT username, email, phone_number FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR phone_number = ?',
            (username, email, phone_number)
        ).fetchone()

        if existing:
            if existing['username'].lower() == username.lower():
                return jsonify({'error': 'Username already taken'}), 409
            if existing['email'].lower() == email.lower():
                return jsonify({'error': 'Email already registered'}), 409
            if existing['phone_number'] == phone_number:
                return jsonify({'error': 'Phone number already registered with another account'}), 409

        # Generate a 6-digit random OTP
        otp = str(random.randint(100000, 999999))
        
        session['otp'] = otp
        session['otp_phone'] = phone_number
        session['otp_expiry'] = time.time() + 300  # 5 minutes
        
        otp_msg = (
            f"🔐 *StickyBoard Verification Code*\n\n"
            f"Hello! You are registering a new account on *StickyBoard*.\n\n"
            f"Your One-Time Password (OTP) is:\n"
            f"👉 *{otp}* 👈\n\n"
            f"This code will expire in *5 minutes*. Do not share it with anyone."
        )
        
        is_test = request.headers.get('X-Testing') == 'true'
        success = False if is_test else send_whatsapp(phone_number, otp_msg)
        if not success:
            print(f"\n[OTP Fallback] Twilio failed/not configured. OTP for {phone_number} is: {otp}\n")
            return jsonify({'message': 'OTP generated (simulated in logs)', 'simulated': True, 'otp': otp}), 200

        return jsonify({'message': 'OTP sent successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    phone_number = data.get('phone_number', '').strip()
    otp = data.get('otp', '').strip()

    # Validation
    if not username or not email or not password or not phone_number or not otp:
        return jsonify({'error': 'All fields are required, including the OTP'}), 400

    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if '@' not in email or '.' not in email:
        return jsonify({'error': 'Invalid email address'}), 400

    if not phone_number.startswith('+') or not phone_number[1:].isdigit() or len(phone_number) < 8:
        return jsonify({'error': 'Invalid phone number format. Must include country code (e.g. +91XXXXXXXXXX)'}), 400

    # Verify OTP
    sess_otp = session.get('otp')
    sess_phone = session.get('otp_phone')
    sess_expiry = session.get('otp_expiry', 0)

    if not sess_otp or not sess_phone:
        return jsonify({'error': 'No OTP requested for this session. Please request a new OTP.'}), 400

    if time.time() > sess_expiry:
        return jsonify({'error': 'OTP has expired. Please request a new OTP.'}), 400

    if sess_otp != otp:
        return jsonify({'error': 'Invalid OTP code. Please check and try again.'}), 400

    if sess_phone != phone_number:
        return jsonify({'error': 'Phone number does not match the one that requested the OTP.'}), 400

    db = get_db()

    try:
        # Check duplicates again to avoid race conditions
        existing = db.execute(
            'SELECT username, email, phone_number FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR phone_number = ?',
            (username, email, phone_number)
        ).fetchone()

        if existing:
            if existing['username'].lower() == username.lower():
                return jsonify({'error': 'Username already taken'}), 409
            if existing['email'].lower() == email.lower():
                return jsonify({'error': 'Email already registered'}), 409
            if existing['phone_number'] == phone_number:
                return jsonify({'error': 'Phone number already registered with another account'}), 409

        # Create user
        salt = secrets.token_hex(16)
        password_hash = _hash_password(password, salt)

        db.execute(
            'INSERT INTO users (username, email, password_hash, salt, phone_number) VALUES (?, ?, ?, ?, ?)',
            (username, email, password_hash, salt, phone_number)
        )
        db.commit()

        # Clear OTP from session
        session.pop('otp', None)
        session.pop('otp_phone', None)
        session.pop('otp_expiry', None)

        # Auto-login after registration
        session['user'] = username
        return jsonify({'message': 'Account created successfully', 'username': username}), 201

    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username, Email, or Phone number already taken'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    identifier = data.get('username', '').strip()   # can be username or email
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'error': 'Username/email and password are required'}), 400

    db = get_db()

    user = db.execute(
        'SELECT username, password_hash, salt FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
        (identifier, identifier)
    ).fetchone()

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
        db = get_db()
        user = db.execute('SELECT phone_number FROM users WHERE username = ?', (session['user'],)).fetchone()
        phone = user['phone_number'] if user else None
        return jsonify({'authenticated': True, 'username': session['user'], 'phone_number': phone}), 200
    return jsonify({'authenticated': False}), 200


@app.route('/api/account', methods=['DELETE'])
@login_required
def delete_account():
    username = session['user']
    db = get_db()
    try:
        # Delete reminder notifications first (no foreign key cascade there)
        db.execute(
            'DELETE FROM reminder_notifications WHERE note_id IN (SELECT id FROM notes WHERE username = ?)',
            (username,)
        )
        # Delete user (cascades to notes due to foreign key constraint)
        db.execute('DELETE FROM users WHERE username = ?', (username,))
        db.commit()

        # Log out
        session.pop('user', None)
        return jsonify({'message': 'Account deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500



# ── Notes Data & Routes (SQLite) ───────────────────────────────────────────

@app.route('/api/notes', methods=['GET'])
@login_required
def get_notes():
    db = get_db()
    rows = db.execute(
        'SELECT id, title, content, color, font, created_at as createdAt, updated_at as updatedAt, reminder_at as reminderAt FROM notes WHERE username = ?',
        (session['user'],)
    ).fetchall()
    notes = [dict(row) for row in rows]
    return jsonify(notes)


@app.route('/api/notes', methods=['POST'])
@login_required
def save_notes():
    notes_data = request.get_json(silent=True) or []

    db = get_db()

    # Remove old notes for this user
    db.execute('DELETE FROM notes WHERE username = ?', (session['user'],))

    # Add new notes
    if notes_data:
        notes_to_insert = [
            (
                n.get('id'),
                session['user'],
                n.get('title', ''),
                n.get('content', ''),
                n.get('color', 'yellow'),
                n.get('font', 'Caveat'),
                n.get('createdAt'),
                n.get('updatedAt'),
                n.get('reminderAt')
            )
            for n in notes_data
        ]
        db.executemany(
            'INSERT INTO notes (id, username, title, content, color, font, created_at, updated_at, reminder_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            notes_to_insert
        )

    db.commit()
    return jsonify({'message': 'Notes saved successfully'})


# ── Serve React Frontend ────────────────────────────────────────────────────

@app.route('/')
def index():
    """Serve the React app."""
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({'error': 'Frontend not built. Run: cd frontend && npm run build'}), 404


@app.route('/<path:path>')
def serve_frontend(path):
    """Serve static files or fall back to index.html for client-side routing."""
    file_path = os.path.join(FRONTEND_BUILD, path)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_BUILD, path)
    # Fall back to index.html for React Router
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({'error': 'Frontend not built. Run: cd frontend && npm run build'}), 404


# ── Run ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    # Start Background Worker
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        from reminder_worker import worker_loop
        t = threading.Thread(target=worker_loop, daemon=True)
        t.start()
        print("  [+] Background reminder worker thread started.")

    print("\n  StickyBoard Server running at http://localhost:5000\n")
    app.run(debug=True, port=5000)
