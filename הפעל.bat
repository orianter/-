@echo off
chcp 65001 >nul
title Reel Analyzer
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       Reel Analyzer - מפעיל          ║
echo  ╚══════════════════════════════════════╝
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js לא מותקן.
    echo      הורד מ: https://nodejs.org
    echo      התקן, הפעל מחדש את המחשב, והרץ שוב.
    pause
    exit /b 1
)

if not exist "server\.env" (
    echo  [!] יוצר קובץ הגדרות...
    copy "server\.env.example" "server\.env" >nul
    echo.
    echo  ══════════════════════════════════════
    echo   חובה: פתח את הקובץ server\.env
    echo   והדבק את מפתח OpenAI שלך בשורה:
    echo   OPENAI_API_KEY=sk-...
    echo.
    echo   קבל מפתח מ: platform.openai.com/api-keys
    echo  ══════════════════════════════════════
    echo.
    notepad "server\.env"
    echo  שמור את הקובץ ב-Notepad וסגור אותו.
    pause
)

if not exist "node_modules\" (
    echo  מתקין... ^(פעם ראשונה, דקה-שתיים^)
    call npm install
    if not exist "client\node_modules\" (
        cd client && call npm install && cd ..
    )
    if not exist "server\node_modules\" (
        cd server && call npm install && cd ..
    )
)

echo  מפעיל את האתר...
echo  הדפדפן ייפתח אוטומטית.
echo  לעצירה: סגור את החלון הזה או Ctrl+C
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"
call npm run dev
