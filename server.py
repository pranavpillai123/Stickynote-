"""
StickyBoard — Flask Backend with SQLite Database
========================================================
Stores users and notes in a local SQLite database.
Provides login, register, logout, and session-check endpoints.
Supports multi-channel verification (WhatsApp & Email).
Serves the React frontend build in production.
"""

import os
import sys

# Reconfigure stdout/stderr to replace unencodable characters (like emojis) on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(errors='replace')

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

from reminder_worker import send_whatsapp, send_email


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

    # Check if database migration is needed (presence of new columns)
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]
        if columns and ('is_email_verified' not in columns or 'reminder_method' not in columns):
            print("  [!] Outdated database schema (missing email verification columns). Wiping database...")
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
            email TEXT,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            phone_number TEXT,
            is_email_verified INTEGER DEFAULT 0,
            is_phone_verified INTEGER DEFAULT 0,
            reminder_method TEXT DEFAULT 'whatsapp',
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
    channel = data.get('channel', 'phone')  # 'phone' or 'email'

    if not username:
        return jsonify({'error': 'Username is required'}), 400

    # Validate based on channel
    if channel == 'phone':
        if not phone_number:
            return jsonify({'error': 'Phone number is required for WhatsApp verification'}), 400
        if not phone_number.startswith('+') or not phone_number[1:].isdigit() or len(phone_number) < 8:
            return jsonify({'error': 'Invalid phone number format. Must include country code (e.g. +91XXXXXXXXXX)'}), 400
    elif channel == 'email':
        if not email:
            return jsonify({'error': 'Email is required for email verification'}), 400
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Invalid email address'}), 400
    else:
        return jsonify({'error': 'Invalid channel. Must be "phone" or "email"'}), 400

    db = get_db()
    try:
        # Check duplicates (exclude current user only if they are logged in and updating their own account)
        logged_in_user = session.get('user')
        is_self = logged_in_user and logged_in_user.lower() == username.lower()

        conditions = []
        params = []

        if not is_self:
            conditions.append('LOWER(username) = LOWER(?)')
            params.append(username)

        if email:
            if is_self:
                conditions.append('LOWER(email) = LOWER(?) AND LOWER(username) != LOWER(?)')
                params.extend([email, username])
            else:
                conditions.append('LOWER(email) = LOWER(?)')
                params.append(email)

        if phone_number:
            if is_self:
                conditions.append('phone_number = ? AND LOWER(username) != LOWER(?)')
                params.extend([phone_number, username])
            else:
                conditions.append('phone_number = ?')
                params.append(phone_number)

        if conditions:
            existing = db.execute(
                f'SELECT username, email, phone_number FROM users WHERE {" OR ".join(conditions)}',
                tuple(params)
            ).fetchone()

            if existing:
                if not is_self and existing['username'].lower() == username.lower():
                    return jsonify({'error': 'Username already taken'}), 409
                if email and existing['email'] and existing['email'].lower() == email.lower():
                    return jsonify({'error': 'Email already registered'}), 409
                if phone_number and existing['phone_number'] and existing['phone_number'] == phone_number:
                    return jsonify({'error': 'Phone number already registered with another account'}), 409

        # Generate a 6-digit random OTP
        otp = str(random.randint(100000, 999999))

        if channel == 'phone':
            session['otp_phone_code'] = otp
            session['otp_phone_target'] = phone_number
            session['otp_phone_expiry'] = time.time() + 300  # 5 minutes

            otp_msg = (
                f"🔐 *StickyBoard Verification Code*\n\n"
                f"Hello! You are verifying your phone number on *StickyBoard*.\n\n"
                f"Your One-Time Password (OTP) is:\n"
                f"👉 *{otp}* 👈\n\n"
                f"This code will expire in *5 minutes*. Do not share it with anyone."
            )

            is_test = request.headers.get('X-Testing') == 'true'
            success = False if is_test else send_whatsapp(phone_number, otp_msg)
            if not success:
                print(f"\n[OTP Fallback] Twilio failed/not configured. Phone OTP for {phone_number} is: {otp}\n")
                return jsonify({'message': 'OTP generated (simulated in logs)', 'simulated': True, 'otp': otp}), 200

        elif channel == 'email':
            session['otp_email_code'] = otp
            session['otp_email_target'] = email
            session['otp_email_expiry'] = time.time() + 300  # 5 minutes

            email_subject = '🔐 StickyBoard Verification Code'
            email_body = f"""\
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="color: #7c3aed; margin-top: 12px; margin-bottom: 4px; font-weight: 700;">StickyBoard Verification</h2>
    <p style="color: #64748b; font-size: 14px; margin: 0;">Secure Your Account</p>
  </div>
  <div style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
    <p>Hello!</p>
    <p>You are verifying your email address on <strong>StickyBoard</strong>. Use the One-Time Password (OTP) below to complete this action:</p>
    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #7c3aed;">{otp}</span>
    </div>
    <p style="font-size: 14px; color: #ef4444; background-color: #fef2f2; padding: 10px 14px; border-radius: 6px; margin: 0;">
      <strong>Important:</strong> This verification code will expire in <strong>5 minutes</strong>. Please do not share this code with anyone.
    </p>
  </div>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <div style="text-align: center; font-size: 12px; color: #94a3b8;">
    <p>&copy; 2026 StickyBoard. All rights reserved.</p>
  </div>
</div>"""

            is_test = request.headers.get('X-Testing') == 'true'
            success = False if is_test else send_email(email, email_subject, email_body)
            if not success:
                print(f"\n[OTP Fallback] SMTP failed/not configured. Email OTP for {email} is: {otp}\n")
                return jsonify({'message': 'OTP generated (simulated in logs)', 'simulated': True, 'otp': otp}), 200

        resp_data = {'message': 'OTP sent successfully'}
        if app.debug:
            resp_data['otp'] = otp
            resp_data['simulated'] = True
        return jsonify(resp_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/otp/verify', methods=['POST'])
def verify_otp():
    """Verify an OTP for a given channel. Works for both registration and settings."""
    data = request.get_json(silent=True) or {}
    channel = data.get('channel', 'phone')  # 'phone' or 'email'
    otp = data.get('otp', '').strip()
    target = data.get('target', '').strip()  # phone number or email

    if not otp or len(otp) != 6:
        return jsonify({'error': 'Please enter a valid 6-digit OTP'}), 400

    if channel == 'phone':
        sess_otp = session.get('otp_phone_code')
        sess_target = session.get('otp_phone_target')
        sess_expiry = session.get('otp_phone_expiry', 0)
    elif channel == 'email':
        sess_otp = session.get('otp_email_code')
        sess_target = session.get('otp_email_target')
        sess_expiry = session.get('otp_email_expiry', 0)
    else:
        return jsonify({'error': 'Invalid channel'}), 400

    if not sess_otp or not sess_target:
        return jsonify({'error': 'No OTP requested for this channel. Please request a new OTP.'}), 400

    if time.time() > sess_expiry:
        return jsonify({'error': 'OTP has expired. Please request a new OTP.'}), 400

    if sess_otp != otp:
        return jsonify({'error': 'Invalid OTP code. Please check and try again.'}), 400

    if target and sess_target != target:
        return jsonify({'error': f'{"Phone number" if channel == "phone" else "Email"} does not match the one that requested the OTP.'}), 400

    # If user is logged in, update their record immediately
    logged_in_user = session.get('user')
    if logged_in_user:
        db = get_db()
        if channel == 'phone':
            db.execute(
                'UPDATE users SET phone_number = ?, is_phone_verified = 1 WHERE username = ?',
                (sess_target, logged_in_user)
            )
        elif channel == 'email':
            db.execute(
                'UPDATE users SET email = ?, is_email_verified = 1 WHERE username = ?',
                (sess_target, logged_in_user)
            )
        db.commit()

        # Clear OTP from session
        if channel == 'phone':
            session.pop('otp_phone_code', None)
            session.pop('otp_phone_target', None)
            session.pop('otp_phone_expiry', None)
        else:
            session.pop('otp_email_code', None)
            session.pop('otp_email_target', None)
            session.pop('otp_email_expiry', None)

        return jsonify({'message': f'{channel.title()} verified successfully', 'verified': True}), 200
    else:
        # For registration flow: mark verification in session
        if channel == 'phone':
            session['verified_phone'] = sess_target
        elif channel == 'email':
            session['verified_email'] = sess_target

        # Clear OTP from session
        if channel == 'phone':
            session.pop('otp_phone_code', None)
            session.pop('otp_phone_target', None)
            session.pop('otp_phone_expiry', None)
        else:
            session.pop('otp_email_code', None)
            session.pop('otp_email_target', None)
            session.pop('otp_email_expiry', None)

        return jsonify({'message': f'{channel.title()} verified successfully', 'verified': True}), 200


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower() or None
    password = data.get('password', '')
    phone_number = data.get('phone_number', '').strip() or None
    reminder_method = data.get('reminder_method', 'whatsapp')

    # Validation
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if not email and not phone_number:
        return jsonify({'error': 'At least one contact method (email or phone) is required'}), 400

    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if email and ('@' not in email or '.' not in email):
        return jsonify({'error': 'Invalid email address'}), 400

    if phone_number and (not phone_number.startswith('+') or not phone_number[1:].isdigit() or len(phone_number) < 8):
        return jsonify({'error': 'Invalid phone number format. Must include country code (e.g. +91XXXXXXXXXX)'}), 400

    # Check session verification
    is_phone_verified = 0
    is_email_verified = 0

    if reminder_method in ('whatsapp', 'both'):
        if not phone_number:
            return jsonify({'error': 'Phone number is required for WhatsApp reminders'}), 400
        verified_phone = session.get('verified_phone')
        if not verified_phone or verified_phone != phone_number:
            return jsonify({'error': 'Phone number not verified. Please verify your phone first.'}), 400
        is_phone_verified = 1

    if reminder_method in ('email', 'both'):
        if not email:
            return jsonify({'error': 'Email is required for email reminders'}), 400
        verified_email = session.get('verified_email')
        if not verified_email or verified_email != email:
            return jsonify({'error': 'Email not verified. Please verify your email first.'}), 400
        is_email_verified = 1

    db = get_db()

    try:
        # Check duplicates
        conditions = ['LOWER(username) = LOWER(?)']
        params = [username]
        if email:
            conditions.append('LOWER(email) = LOWER(?)')
            params.append(email)
        if phone_number:
            conditions.append('phone_number = ?')
            params.append(phone_number)

        existing = db.execute(
            f'SELECT username, email, phone_number FROM users WHERE {" OR ".join(conditions)}',
            tuple(params)
        ).fetchone()

        if existing:
            if existing['username'].lower() == username.lower():
                return jsonify({'error': 'Username already taken'}), 409
            if email and existing['email'] and existing['email'].lower() == email.lower():
                return jsonify({'error': 'Email already registered'}), 409
            if phone_number and existing['phone_number'] and existing['phone_number'] == phone_number:
                return jsonify({'error': 'Phone number already registered with another account'}), 409

        # Create user
        salt = secrets.token_hex(16)
        password_hash = _hash_password(password, salt)

        db.execute(
            'INSERT INTO users (username, email, password_hash, salt, phone_number, is_email_verified, is_phone_verified, reminder_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (username, email, password_hash, salt, phone_number, is_email_verified, is_phone_verified, reminder_method)
        )
        db.commit()

        # Clear verification session entries
        session.pop('verified_phone', None)
        session.pop('verified_email', None)
        session.pop('otp_phone_code', None)
        session.pop('otp_phone_target', None)
        session.pop('otp_phone_expiry', None)
        session.pop('otp_email_code', None)
        session.pop('otp_email_target', None)
        session.pop('otp_email_expiry', None)

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
        user = db.execute(
            'SELECT phone_number, email, is_email_verified, is_phone_verified, reminder_method FROM users WHERE username = ?',
            (session['user'],)
        ).fetchone()
        if user:
            return jsonify({
                'authenticated': True,
                'username': session['user'],
                'phone_number': user['phone_number'],
                'email': user['email'],
                'is_email_verified': bool(user['is_email_verified']),
                'is_phone_verified': bool(user['is_phone_verified']),
                'reminder_method': user['reminder_method'] or 'whatsapp',
            }), 200
        return jsonify({'authenticated': True, 'username': session['user']}), 200
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



@app.route('/api/reminder-settings', methods=['GET'])
@login_required
def get_reminder_settings():
    db = get_db()
    user = db.execute(
        'SELECT email, phone_number, is_email_verified, is_phone_verified, reminder_method FROM users WHERE username = ?',
        (session['user'],)
    ).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'email': user['email'],
        'phone_number': user['phone_number'],
        'is_email_verified': bool(user['is_email_verified']),
        'is_phone_verified': bool(user['is_phone_verified']),
        'reminder_method': user['reminder_method'] or 'whatsapp',
    }), 200


@app.route('/api/reminder-settings/toggle', methods=['POST'])
@login_required
def toggle_reminder_setting():
    data = request.get_json(silent=True) or {}
    new_method = data.get('reminder_method', '').strip().lower()

    if new_method not in ('whatsapp', 'email', 'both'):
        return jsonify({'error': 'Invalid reminder method. Must be "whatsapp", "email", or "both"'}), 400

    db = get_db()
    user = db.execute(
        'SELECT phone_number, email, is_phone_verified, is_email_verified FROM users WHERE username = ?',
        (session['user'],)
    ).fetchone()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Check that required channels are verified
    if new_method in ('whatsapp', 'both'):
        if not user['phone_number'] or not user['is_phone_verified']:
            return jsonify({'error': 'Phone number is not verified. Please verify your phone number first.', 'needs_verification': 'phone'}), 400

    if new_method in ('email', 'both'):
        if not user['email'] or not user['is_email_verified']:
            return jsonify({'error': 'Email is not verified. Please verify your email first.', 'needs_verification': 'email'}), 400

    db.execute(
        'UPDATE users SET reminder_method = ? WHERE username = ?',
        (new_method, session['user'])
    )
    db.commit()

    return jsonify({'message': f'Reminder method updated to {new_method}', 'reminder_method': new_method}), 200


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
