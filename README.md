<div align="center">

# 📝 StickyBoard

### A Beautiful, Modern Sticky Notes App

[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)

*Capture ideas. Organize thoughts. Stay brilliant.*

---

</div>

## ✨ Features

| Feature | Description |
|:---:|---|
| 🔐 | **User Authentication** — Secure login and registration with salted SHA-256 hashed passwords |
| 📲 | **Multi-Channel Verification** — Verify phone numbers (WhatsApp) and emails via cryptographically secure 6-digit OTPs |
| 🛡️ | **Double Verification Flow** — Option to enforce verification of both phone and email channels during registration |
| 📝 | **Create, Edit & Delete Notes** — Full CRUD note management with a modern modal editor |
| 🎨 | **8 Color Themes** — Yellow, Pink, Blue, Green, Purple, Orange, Teal, Rose |
| 🌙 | **Dark & Light Mode** — Premium togglable themes, persisting user color preferences locally |
| 🔍 | **Instant Search** — Real-time searching and filtering of notes as you type |
| ⏰ | **Multi-Channel Reminders** — Schedule reminders sent directly to your WhatsApp, Email, or both channels |
| ⚙️ | **Reminder Settings** — Configure your reminder channels and verify new email/phone inline from the Settings modal |
| 🖱️ | **Drag & Drop** — Sort and reorder notes on the board by dragging them |
| 🗑️ | **Delete Account** — Permanent account removal, cascade-deleting all notes and notifications |
| 🚀 | **One-Click Launch** — Launcher script handles backend venv and frontend compilation |

---

## 🚀 Quick Start

### One-Click Launch (Recommended)

```
Double-click  run.bat
```

The script will automatically:
1. ✅ Check if Python and Node.js are installed
2. ✅ Create a virtual environment (`venv`) and install Python packages (first run only)
3. ✅ Install npm packages and build the frontend bundle (first run only)
4. ✅ Start the Flask backend server
5. ✅ Launch the app in your default browser at `http://localhost:5000`

### Manual Setup

```bash
# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# 2. Install backend dependencies
pip install -r requirements.txt

# 3. Install frontend dependencies and build production assets
cd frontend
npm install
npm run build
cd ..

# 4. Run the server
python server.py
```

Then open **http://localhost:5000** in your browser.

---

## 📁 Project Structure

```
StickyBoard/
│
├── 🌐 frontend/            # React + Vite Frontend
│   ├── package.json        # Frontend configuration and scripts
│   ├── vite.config.js      # Vite build configuration
│   ├── src/
│   │   ├── main.jsx        # Frontend entry point
│   │   ├── App.jsx         # Client-side routing configuration
│   │   ├── components/     # UI components (Header, Toast, NoteCard, ConfirmDialog)
│   │   ├── pages/          # Pages (Dashboard, LoginPage, VerifyOtpPage)
│   │   ├── services/       # API fetch wrapper client
│   │   └── styles/         # Global & component stylesheet CSS files
│   └── dist/               # Built static production bundle (served by Flask)
│
├── ⚙️ Backend
│   ├── server.py           # Flask server with API routes
│   ├── reminder_worker.py  # Background worker for sending WhatsApp notifications
│   ├── requirements.txt    # Python dependencies list
│   └── stickyboard.db      # SQLite database (auto-created on startup)
│
└── 🛠️ Utilities
    ├── run.bat             # One-click launcher script
    └── README.md           # This file
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `POST` | `/api/otp/send` | Request a 6-digit OTP via WhatsApp (`phone`) or `email` | ❌ |
| `POST` | `/api/otp/verify` | Verify an OTP for a given channel (`phone` or `email`) | ❌ |
| `POST` | `/api/register` | Create a new account (requires verified contact info) | ❌ |
| `POST` | `/api/login` | Sign in with username/email and password | ❌ |
| `POST` | `/api/logout` | Sign out | ✅ |
| `GET` | `/api/me` | Retrieve active user authentication status and settings | ❌ |
| `GET` | `/api/reminder-settings` | Get email, phone, verification statuses, and reminder method | ✅ |
| `POST` | `/api/reminder-settings/toggle` | Toggle the active reminder channel (`whatsapp`, `email`, or `both`) | ✅ |
| `GET` | `/api/notes` | Get all notes for the authenticated user | ✅ |
| `POST` | `/api/notes` | Save/sync all notes to the database | ✅ |
| `DELETE` | `/api/account` | Delete the authenticated user, notes, and session | ✅ |

---

## 🎨 Design Highlights

- **Glassmorphism UI** — Frosted glass components with backdrop filters and saturate boosts
- **Gradient Note Cards** — Multi-tone soft gradients mapped onto note card themes
- **Floating Orb Animations** — Animated gradient background on the auth page
- **Micro-Animations** — Spring-like hover transforms and smooth transition effects
- **Digital Clock** — Digital clock face for scheduling reminders inside the datetime picker
- **Handwritten Font** — Handwritten typography for note cards using Google Font Caveat
- **OTP Input Fields** — Auto-tabbing, individual digit box layout for verification codes

---

## 🔒 Security & Verification

- **OTP Validation**: 6-digit numeric OTPs generated cryptographically with a 5-minute expiry, sent via Twilio WhatsApp.
- **Local Dev Fallback**: In case Twilio is not configured, the server logs the generated OTP to the terminal console so development and testing can proceed seamlessly.
- **Pass Hash**: Passwords are salted (16-byte cryptographically random salt) and hashed using SHA-256 before database insertion.
- **Cascading Deletes**: Foreign key cascading deletes ensure deleting an account automatically erases all note records and reminder notifications from the database.

---

## 📋 Usage Guide

| Action | How |
|---|---|
| **Register** | Click "Create one" → Fill in details → Verify OTP sent to WhatsApp |
| **Login** | Enter your username/email + password → Sign In |
| **Create Note** | Click the **"New Note"** button in the header |
| **Edit Note** | Hover a note → Click the ✏️ pencil icon (or double-click) |
| **Delete Note** | Hover a note → Click the 🗑️ trash icon → Confirm |
| **Change Color** | Hover a note → Click the 🎨 palette icon |
| **Set Reminder** | Edit a note → Use the date/time picker (gets sent to WhatsApp) |
| **Search** | Type in the search bar at the top |
| **Dark Mode** | Click the ☀️/🌙 toggle in the header |
| **Reorder** | Drag and drop notes to rearrange them |
| **Delete Account** | Click **"Delete Account"** at the bottom of the sidebar → Confirm |
| **Logout** | Click the ↗️ logout icon in the header |

---

<div align="center">

Made with ❤️ by Pranav

</div>
