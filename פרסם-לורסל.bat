@echo off
chcp 65001 >nul
title פריסה ל-Vercel
cd /d "%~dp0"
color 0E

echo.
echo  ╔════════════════════════════════════════╗
echo  ║   פריסת Reel Analyzer ל-Vercel        ║
echo  ╚════════════════════════════════════════╝
echo.
echo  האתר עובד אצלך במחשב - מעולה!
echo  עכשיו מעלים לאינטרנט.
echo.
echo  חשוב: צריך Supabase פעיל עם פונקציה analyze.
echo  כתובת Supabase נראית כך:
echo  https://your-project.supabase.co
echo.
set /p SUPABASE_URL="  הדבק כאן Project URL של Supabase: "
set /p SUPABASE_ANON_KEY="  הדבק כאן anon public key של Supabase: "

if "%SUPABASE_URL%"=="" (
    echo.
    echo  [!] בלי Supabase הניתוח לא יעבוד באינטרנט.
    echo      קודם הגדר Supabase, אחר כך הרץ שוב.
    pause
    exit /b 1
)

:: הסר / בסוף אם יש
if "%SUPABASE_URL:~-1%"=="/" set SUPABASE_URL=%SUPABASE_URL:~0,-1%

echo.
echo  מתקין Vercel CLI...
call npm install -g vercel 2>nul

echo.
echo  ══════════════════════════════════════════════════
echo   עכשיו ייפתח דפדפן - התחבר ל-Vercel פעם אחת.
echo   אחרי ההתחברות הפריסה תמשיך אוטומטית.
echo  ══════════════════════════════════════════════════
echo.
pause

cd client
set VITE_SUPABASE_URL=%SUPABASE_URL%
set VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%
call vercel --prod --yes -e VITE_SUPABASE_URL=%SUPABASE_URL% -e VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%

echo.
echo  ══════════════════════════════════════════════════
if errorlevel 1 (
    echo   משהו נכשל. נסה דרך האתר:
    echo   1. vercel.com - Import project
    echo   2. Root Directory: client
    echo   3. VITE_SUPABASE_URL = %SUPABASE_URL%
    echo   4. VITE_SUPABASE_ANON_KEY = הערך שקיבלת מ-Supabase
) else (
    echo   הצלחה! הקישור מופיע למעלה.
    echo.
    echo   ודא שב-Supabase קיים Secret בשם OPENAI_API_KEY.
)
echo  ══════════════════════════════════════════════════
echo.
pause
