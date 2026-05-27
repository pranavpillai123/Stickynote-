<div align="center">

# 📝 StickyBoard

### A Beautiful, Modern Sticky Notes App

[![React](https://img.shields.io/badge/React-19+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.0+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)

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
| 👤 | **About Me** — Independent "About Me" modal with developer bio, GitHub, and LinkedIn links |
| 📱 | **Fully Responsive** — Mobile-optimized layout that works seamlessly on phones, tablets, and desktops |
| 🗑️ | **Delete Account** — Permanent account removal, cascade-deleting all notes and notifications |
| 🚀 | **Cloud Deployment** — Production-ready deployment on Render with Neon PostgreSQL |

---

## 🌐 Live Demo

The app is deployed on **Render** and available at:

> 🔗 [https://stickyboard.onrender.com](https://stickyboard.onrender.com)

---

## 🚀 Quick Start

### One-Click Launch (Local — Recommended)

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
│   │   ├── components/     # UI components
│   │   │   ├── Header.jsx          # App header with search, theme toggle, user menu
│   │   │   ├── NoteCard.jsx        # Individual sticky note card
│   │   │   ├── NoteModal.jsx       # Create/edit note modal
│   │   │   ├── SettingsModal.jsx   # Reminder & verification settings
│   │   │   ├── AboutModal.jsx      # About Me developer info modal
│   │   │   ├── ColorPicker.jsx     # Note color theme selector
│   │   │   ├── ConfirmDialog.jsx   # Confirmation dialog
│   │   │   ├── DateTimePicker.jsx  # Reminder date/time picker
│   │   │   └── Toast.jsx          # Toast notification
│   │   ├── pages/          # Pages (Dashboard, LoginPage, VerifyOtpPage)
│   │   ├── services/       # API fetch wrapper client
│   │   └── styles/         # Global & component stylesheet CSS files
│   └── dist/               # Built static production bundle (served by Flask)
│
├── ⚙️ Backend
│   ├── server.py           # Flask server with API routes
│   ├── reminder_worker.py  # Background worker for sending WhatsApp & email notifications
│   ├── requirements.txt    # Python dependencies list
│   └── .env                # Environment variables (database URL, API keys)
│
└── 🛠️ Deployment & Utilities
    ├── render.yaml         # Render deployment configuration
    ├── build.sh            # Production build script for Render
    ├── run.bat             # One-click local launcher script
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
| `GET` | `/api/reminder-settings` | Get email, phone, verification statuses, reminder method, and about text | ✅ |
| `POST` | `/api/reminder-settings/toggle` | Toggle the active reminder channel (`whatsapp`, `email`, or `both`) | ✅ |
| `POST` | `/api/reminder-settings/about` | Update the user's biography / about text | ✅ |
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
- **Fully Responsive** — Mobile-first design with adaptive layouts for all screen sizes

---

## 📱 Mobile Responsiveness

StickyBoard is fully optimized for mobile devices:

- **Responsive header** with collapsible search and touch-friendly controls
- **Adaptive note grid** that adjusts column count based on screen width
- **Touch-optimized modals** with full-screen layouts on smaller screens
- **Mobile-friendly navigation** with hamburger-style user menus
- **Fluid typography** that scales appropriately across breakpoints

---

## 🔒 Security & Verification

- **OTP Validation**: 6-digit numeric OTPs generated cryptographically with a 5-minute expiry, sent via Twilio WhatsApp or SMTP email.
- **Local Dev Fallback**: In case Twilio is not configured, the server logs the generated OTP to the terminal console so development and testing can proceed seamlessly.
- **Pass Hash**: Passwords are salted (16-byte cryptographically random salt) and hashed using SHA-256 before database insertion.
- **Cascading Deletes**: Foreign key cascading deletes ensure deleting an account automatically erases all note records and reminder notifications from the database.

---

## ☁️ Deployment

StickyBoard is deployed on **Render** with a **Neon PostgreSQL** database:

| Component | Service |
|---|---|
| **Web Server** | [Render](https://render.com) (Free Tier) |
| **Database** | [Neon](https://neon.tech) (Serverless PostgreSQL) |
| **WhatsApp OTP** | [Twilio](https://twilio.com) (WhatsApp API) |
| **Email OTP** | Gmail SMTP |

### Deploy Your Own

1. Fork this repository
2. Create a [Neon](https://neon.tech) database and copy the connection string
3. Create a [Render](https://render.com) web service pointing to your repo
4. Set the environment variables (`DATABASE_URL`, `TWILIO_*`, `SMTP_*`) in Render
5. Render will automatically run `build.sh` and start the app with `gunicorn`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7 |
| **Styling** | Vanilla CSS with CSS variables, glassmorphism, gradients |
| **Backend** | Python 3.10+, Flask 3 |
| **Database** | PostgreSQL (Neon — serverless) |
| **OTP & Notifications** | Twilio WhatsApp API, Gmail SMTP |
| **Deployment** | Render, Gunicorn |
| **Date Picker** | Flatpickr |

---

## 📋 Usage Guide

| Action | How |
|---|---|
| **Register** | Click "Create one" → Fill in details → Verify OTP sent to WhatsApp/Email |
| **Login** | Enter your username/email + password → Sign In |
| **Create Note** | Click the **"New Note"** button in the header |
| **Edit Note** | Hover a note → Click the ✏️ pencil icon (or double-click) |
| **Delete Note** | Hover a note → Click the 🗑️ trash icon → Confirm |
| **Change Color** | Hover a note → Click the 🎨 palette icon |
| **Set Reminder** | Edit a note → Use the date/time picker (gets sent to WhatsApp/Email) |
| **Search** | Type in the search bar at the top |
| **Dark Mode** | Click the ☀️/🌙 toggle in the header |
| **Reorder** | Drag and drop notes to rearrange them |
| **Settings** | Click profile icon → Settings to configure reminders & verification |
| **About Me** | Click profile icon → About Me to view developer info |
| **Delete Account** | Settings → "Delete Account" at the bottom → Confirm |
| **Logout** | Click the ↗️ logout icon in the header |

---

<div align="center">

Made with ❤️ by [Pranav](https://github.com/pranavpillai123)

[![GitHub](https://img.shields.io/badge/GitHub-pranavpillai123-181717?style=flat-square&logo=github)](https://github.com/pranavpillai123)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Pranav_Pillai-0077B5?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/pranav-pillai-b0a154328/)

</div>
