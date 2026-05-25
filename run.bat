@echo off
title StickyBoard - Starting...
color 0B

echo.
echo  ======================================================
echo          StickyBoard - Launcher
echo          React + Flask + SQLite
echo  ======================================================
echo.

:: ── Step 1: Check if Python is installed ──
echo  [1/5] Checking Python installation...
python --version >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ERROR: Python is not installed or not in PATH!
    echo  Please install Python from https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>nul') do echo         Found %%i
echo.

:: ── Step 2: Check if venv exists, create if not ──
echo  [2/5] Checking virtual environment...
if not exist "venv\Scripts\activate.bat" (
    echo         First run detected! Creating virtual environment...
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ERROR: Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo         Virtual environment created successfully.
    echo.
) else (
    echo         Virtual environment found.
    echo.
)

:: ── Step 3: Activate venv and install Python dependencies ──
echo  [3/5] Activating venv and installing Python dependencies...
call venv\Scripts\activate.bat

:: Check if Flask is installed in venv
python -c "import flask; import flask_cors; import nodeenv" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo         Installing/Updating Python dependencies including nodeenv...
    pip install -r requirements.txt nodeenv --quiet
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ERROR: Failed to install Python dependencies!
        echo  Make sure you have internet access and pip is working.
        pause
        exit /b 1
    )
    echo         Python dependencies installed successfully.
) else (
    echo         Python dependencies already installed.
)
echo.

:: ── Step 4: Check Node.js and Install in Venv if missing ──
echo  [4/5] Checking Node.js and building frontend...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo         Node.js not found! Installing locally in virtual environment via nodeenv...
    call nodeenv -p
    call venv\Scripts\activate.bat
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ERROR: Failed to install Node.js locally via nodeenv!
        pause
        exit /b 1
    )
    echo         Node.js installed successfully.
    echo.
)
for /f "tokens=*" %%i in ('node --version 2^>nul') do echo         Found Node.js %%i

:: Build React frontend if needed
if not exist "frontend\node_modules" (
    echo         Installing frontend dependencies...
    pushd frontend
    call npm install --silent
    popd
)
if not exist "frontend\dist\index.html" (
    echo         Building production bundle...
    pushd frontend
    call npm run build
    popd
    if not exist "frontend\dist\index.html" (
        echo.
        echo  ERROR: Frontend build failed!
        pause
        exit /b 1
    )
    echo         Frontend built successfully.
) else (
    echo         Frontend already built.
    echo         (Delete frontend\dist to force rebuild)
)
echo.

:: ── Step 5: Launch the server ──
echo  [5/5] Starting StickyBoard server...
echo.
echo  ======================================================
echo.
echo    StickyBoard is running!
echo.
echo    Open in browser:  http://localhost:5000
echo.
echo    For development (hot reload):
echo      Terminal 1: venv\Scripts\activate ^& python server.py
echo      Terminal 2: cd frontend ^& npm run dev
echo      Then open http://localhost:3000
echo.
echo    Database: SQLite (stickyboard.db)
echo.
echo    Press Ctrl+C to stop the server
echo.
echo  ======================================================
echo.

:: Open browser automatically
start "" http://localhost:5000

:: Run the Flask server
python server.py

:: When server stops
echo.
echo  Server stopped. Goodbye!
pause
