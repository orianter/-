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
echo  חשוב: צריך גם Render פעיל (השרת).
echo  כתובת Render נראית כך:
echo  https://reel-analyzer-api.onrender.com
echo.
set /p RENDER_URL="  הדבק כאן כתובת Render (או Enter לדלג): "

if "%RENDER_URL%"=="" (
    echo.
    echo  [!] בלי Render הניתוח לא יעבוד באינטרנט.
    echo      קודם הגדר Render, אחר כך הרץ שוב.
    pause
    exit /b 1
)

:: הסר / בסוף אם יש
if "%RENDER_URL:~-1%"=="/" set RENDER_URL=%RENDER_URL:~0,-1%

echo.
echo  בודק ש-Render עובד...
curl -s "%RENDER_URL%/api/health" 2>nul | findstr "hasApiKey" >nul
if errorlevel 1 (
    echo  [!] Render לא מגיב. וודא שהשרת רץ ב-render.com
    echo      נסה לפתוח: %RENDER_URL%/api/health
    pause
)

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
set VITE_API_URL=%RENDER_URL%
call vercel --prod --yes -e VITE_API_URL=%RENDER_URL%

echo.
echo  ══════════════════════════════════════════════════
if errorlevel 1 (
    echo   משהו נכשל. נסה דרך האתר:
    echo   1. vercel.com - Import project
    echo   2. Root Directory: client
    echo   3. VITE_API_URL = %RENDER_URL%
) else (
    echo   הצלחה! הקישור מופיע למעלה.
    echo.
    echo   עכשיו ב-Render הוסף:
    echo   CLIENT_URL = כתובת Vercel שקיבלת
)
echo  ══════════════════════════════════════════════════
echo.
pause
