@echo off
chcp 65001 >nul
title Reel Analyzer - פרסום לאינטרנט
cd /d "%~dp0"
color 0B

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║     פרסום Reel Analyzer לאינטרנט - מדריך       ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  אני אעשה את כל מה שאפשר אוטומטית.
echo  אתה רק תצטרך להתחבר פעם אחת עם GitHub ^(5 דקות^).
echo.
pause

:: ── בדיקות ──
where git >nul 2>&1
if errorlevel 1 (
    echo.
    echo  פותח התקנת Git...
    start https://git-scm.com/download/win
    echo  התקן Git, הפעל מחדש מחשב, והרץ שוב את הקובץ הזה.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  פותח התקנת Node.js...
    start https://nodejs.org
    echo  התקן Node, הפעל מחדש מחשב, והרץ שוב.
    pause
    exit /b 1
)

:: ── GitHub ──
echo.
echo  ─── שלב 1 מתוך 3: GitHub ───
echo.
echo  אם אין לך repository, פותח דף ליצירה...
echo  שם מומלץ: reel-analyzer
echo.
start https://github.com/new
echo.
set /p REPO_URL="  הדבק כאן את כתובת ה-repo (https://github.com/USER/reel-analyzer.git): "
if "%REPO_URL%"=="" (
    echo  בוטל - חובה כתובת GitHub
    pause
    exit /b 1
)

echo  מעלה קוד...
if not exist .git git init
git branch -M main 2>nul
git add .
git commit -m "Reel Analyzer" 2>nul
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main --force
if errorlevel 1 (
    echo.
    echo  [!] העלאה נכשלה. אולי צריך להתחבר ל-GitHub:
    start https://github.com/login
    echo  התחבר, ואז הרץ שוב את הקובץ.
    pause
    exit /b 1
)
echo  [OK] קוד הועלה ל-GitHub!

:: ── Render ──
echo.
echo  ─── שלב 2 מתוך 3: Render ^(השרת^) ───
echo.
echo  פותח Render. אם אין שירות - צור Web Service:
echo    Root Directory: server
echo    Build: npm install
echo    Start: node index.js
echo    Env: OPENAI_API_KEY = המפתח שלך
echo.
start https://dashboard.render.com/
echo.
set /p RENDER_URL="  הדבק כאן כתובת Render (https://xxx.onrender.com): "
if "%RENDER_URL%"=="" (
    echo  דלג - תוכל להוסיף אחר כך
    set RENDER_URL=https://YOUR-RENDER.onrender.com
)

:: ── Vercel ──
echo.
echo  ─── שלב 3 מתוך 3: Vercel ^(האתר^) ───
echo.
echo  פותח Vercel. Import את reel-analyzer.
echo.
echo  הגדרות חשובות:
echo    Root Directory:  ריק ^(אל תשנה^)
echo    Environment Variable:
echo      VITE_API_URL = %RENDER_URL%
echo.
start https://vercel.com/new
echo.
echo  מתקין Vercel CLI לפריסה אוטומטית...
call npm install -g vercel 2>nul
where vercel >nul 2>&1
if not errorlevel 1 (
    echo.
    echo  נפתח דפדפן להתחברות ל-Vercel - התחבר פעם אחת.
    cd client
  set VITE_API_URL=%RENDER_URL%
    vercel --prod --yes -e VITE_API_URL=%RENDER_URL%
    cd ..
) else (
    echo  פרוס ידנית ב-Vercel מהדפדפן שנפתח.
)

echo.
echo  ══════════════════════════════════════════════════
echo   כמעט סיימת!
echo.
echo   אחרי ש-Vercel עלה, חזור ל-Render ווסף:
echo   CLIENT_URL = כתובת האתר מ-Vercel
echo.
echo   בדיקה: פתח את האתר ^> נתח סרטון ^> העלה וידאו
echo  ══════════════════════════════════════════════════
echo.
pause
