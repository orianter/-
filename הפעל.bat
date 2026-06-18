@echo off
chcp 65001 >nul
title Reel Analyzer
cd /d "%~dp0"

echo.
echo  Reel Analyzer - מפעיל...
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js לא מותקן - הורד מ nodejs.org
    pause
    exit /b 1
)

:: סוגר עותקים ישנים שחוסמים את הפורטים
echo  סוגר עותקים ישנים...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

if not exist "server\.env" (
    copy "server\.env.example" "server\.env" >nul
    echo.
    echo  [!] פתח את server\.env והדבק מפתח OpenAI
    echo      קבל מ: platform.openai.com/api-keys
    notepad "server\.env"
    pause
)

findstr /C:"sk-" "server\.env" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [X] חסר מפתח OpenAI ב-server\.env
    echo      פתח את הקובץ והדבק: OPENAI_API_KEY=sk-...
    notepad "server\.env"
    pause
    exit /b 1
)

if not exist "server\node_modules\" (
    echo  מתקין בפעם הראשונה - דקה...
    call npm install
    cd client && call npm install && cd ..
    cd server && call npm install && cd ..
)

echo.
echo  ========================================
echo   האתר עולה על: http://localhost:5173
echo   לעצירה: סגור את החלון הזה
echo  ========================================
echo.

start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"
call npm run dev
