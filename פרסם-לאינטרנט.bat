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

:: ── Supabase ──
echo.
echo  ─── שלב 2 מתוך 3: Supabase ^(API^) ───
echo.
echo  פותח Supabase. ודא שיש פונקציה analyze ו-Secret:
echo    OPENAI_API_KEY = המפתח שלך
echo.
start https://supabase.com/dashboard/projects
echo.
set /p SUPABASE_URL="  הדבק כאן Supabase Project URL (https://xxx.supabase.co): "
set /p SUPABASE_ANON_KEY="  הדבק כאן Supabase anon public key: "
if "%SUPABASE_URL%"=="" (
    echo  דלג - תוכל להוסיף אחר כך
    set SUPABASE_URL=https://YOUR-PROJECT.supabase.co
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
echo      VITE_SUPABASE_URL = %SUPABASE_URL%
echo      VITE_SUPABASE_ANON_KEY = הערך מ-Supabase
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
    set VITE_SUPABASE_URL=%SUPABASE_URL%
    set VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%
    vercel --prod --yes -e VITE_SUPABASE_URL=%SUPABASE_URL% -e VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%
    cd ..
) else (
    echo  פרוס ידנית ב-Vercel מהדפדפן שנפתח.
)

echo.
echo  ══════════════════════════════════════════════════
echo   כמעט סיימת!
echo.
echo   אחרי ש-Vercel עלה, ודא שב-Supabase קיים:
echo   OPENAI_API_KEY ב-Secrets
echo.
echo   בדיקה: פתח את האתר ^> נתח סרטון ^> העלה וידאו
echo  ══════════════════════════════════════════════════
echo.
pause
