<div align="center">

# 📝 StickyBoard

### A Beautiful, Modern Sticky Notes App

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

*Capture ideas. Organize thoughts. Stay brilliant.*

---

</div>

## ✨ Features

| Feature | Description |
|:---:|---|
| 🔐 | **User Authentication** — Secure login & registration with hashed passwords |
| 📝 | **Create, Edit & Delete Notes** — Full CRUD with a beautiful modal editor |
| 🎨 | **8 Color Themes** — Yellow, Pink, Blue, Green, Purple, Orange, Teal, Rose |
| 🌙 | **Dark & Light Mode** — Toggle between themes, preference saved locally |
| 🔍 | **Instant Search** — Filter notes in real-time as you type |
| ⏰ | **Reminders** — Set date/time reminders on notes with visual indicators |
| 🖱️ | **Drag & Drop** — Reorder notes by dragging them around the board |
| 📱 | **Responsive Design** — Works on desktop, tablet, and mobile |
| 💾 | **SQLite Database** — All data persisted server-side per user |
| 🚀 | **One-Click Launch** — `run.bat` handles everything automatically |

---

## 🚀 Quick Start

### One-Click Launch (Recommended)

```
Double-click  run.bat
```

That's it! The script will automatically:
1. ✅ Check if Python is installed
2. ✅ Create a virtual environment (first run only)
3. ✅ Install dependencies (first run only)
4. ✅ Start the server
5. ✅ Open your browser to `http://localhost:5000`

### Manual Setup

```bash
# 1. Create virtual environment
python -m venv venv

# 2. Activate it
venv\Scripts\activate        # Windows CMD
.\venv\Scripts\Activate.ps1  # Windows PowerShell

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the server
python server.py
```

Then open **http://localhost:5000** in your browser.

---

## 📁 Project Structure

```
StickyBoard/
│
├── 🌐 Frontend
│   ├── index.html          # Main app page (notes board)
│   ├── login.html          # Login & registration page
│   ├── style.css           # App styles (glassmorphism, animations)
│   ├── login.css           # Auth page styles (floating orbs, forms)
│   ├── app.js              # Notes logic (CRUD, drag & drop, search)
│   └── auth.js             # Auth logic (login, register, validation)
│
├── ⚙️ Backend
│   ├── server.py           # Flask server with API routes
│   ├── requirements.txt    # Python dependencies
│   └── stickyboard.db      # SQLite database (auto-created)
│
├── 🛠️ Utilities
│   ├── run.bat             # One-click launcher script
│   ├── .gitignore          # Git ignore rules
│   └── README.md           # This file
│
└── venv/                   # Virtual environment (auto-created)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `POST` | `/api/register` | Create a new account | ❌ |
| `POST` | `/api/login` | Sign in | ❌ |
| `POST` | `/api/logout` | Sign out | ✅ |
| `GET` | `/api/me` | Check auth status | ❌ |
| `GET` | `/api/notes` | Get user's notes | ✅ |
| `POST` | `/api/notes` | Save/sync all notes | ✅ |

---

## 🎨 Design Highlights

- **Glassmorphism UI** — Frosted glass header with backdrop blur
- **Gradient Note Cards** — Each color has a beautiful gradient
- **Floating Orb Animations** — Animated background on the login page
- **Micro-Animations** — Hover effects, card appear/delete transitions
- **Handwritten Font** — Notes use the Caveat font for a natural feel
- **Premium Typography** — Inter font family for clean UI text

---

## 🔒 Security

- Passwords are **salted + SHA-256 hashed** — never stored in plain text
- Server-side **session management** with Flask sessions
- **CSRF-safe** JSON API design
- Each user can only access their **own notes**

---

## 🛠️ Tech Stack

```
Frontend:    HTML5 · CSS3 · Vanilla JavaScript
Backend:     Python · Flask
Database:    SQLite3
Fonts:       Google Fonts (Inter, Caveat)
Date Picker: Flatpickr
```

---

## 📋 Usage Guide

| Action | How |
|---|---|
| **Register** | Open the app → Click "Create one" → Fill the form |
| **Login** | Enter your username/email + password → Sign In |
| **Create Note** | Click the purple **"New Note"** button |
| **Edit Note** | Hover a note → Click ✏️ pencil icon (or double-click) |
| **Delete Note** | Hover a note → Click 🗑️ trash icon → Confirm |
| **Change Color** | Hover a note → Click 🎨 palette icon |
| **Set Reminder** | Edit a note → Use the date/time picker |
| **Search** | Type in the search bar at the top |
| **Dark Mode** | Click the ☀️/🌙 toggle in the header |
| **Reorder** | Drag and drop notes to rearrange |
| **Logout** | Click the ↗️ logout icon in the header |

---

<div align="center">

Made with ❤️ by Pranav

</div>
