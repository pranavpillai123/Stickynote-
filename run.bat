@echo off
title StickyBoard - Starting...
color 0B

echo.
echo  ======================================================
echo          StickyBoard - Launcher
echo          Beautiful Sticky Notes App
echo  ======================================================
echo.

:: ── Step 1: Check if Python is installed ──
echo  [1/4] Checking Python installation...
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
echo  [2/4] Checking virtual environment...
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

:: ── Step 3: Activate venv and install dependencies ──
echo  [3/4] Activating venv and installing dependencies...
call venv\Scripts\activate.bat

:: Check if Flask is installed in venv
python -c "import flask" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo         Installing dependencies - first run...
    pip install -r requirements.txt --quiet
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    echo         Dependencies installed successfully.
) else (
    echo         All dependencies already installed.
)
echo.

:: ── Step 4: Launch the server ──
echo  [4/4] Starting StickyBoard server...
echo.
echo  ======================================================
echo.
echo    StickyBoard is running!
echo.
echo    Open in browser:  http://localhost:5000
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
