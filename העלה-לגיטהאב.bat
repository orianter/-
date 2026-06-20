@echo off
chcp 65001 >nul
echo ========================================
echo   Reel Analyzer - העלאה ל-GitHub
echo ========================================
echo.

cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
    echo [שגיאה] Git לא מותקן. התקן מ: https://git-scm.com/download/win
    pause
    exit /b 1
)

set /p REPO_URL="הדבק את כתובת ה-GitHub שלך (https://github.com/USER/reel-analyzer.git): "

if "%REPO_URL%"=="" (
    echo [שגיאה] חובה להזין כתובת
    pause
    exit /b 1
)

if not exist .git (
    git init
    git branch -M main
)

git add .
git commit -m "עדכון Reel Analyzer" 2>nul
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main --force

echo.
echo ========================================
echo   הועלה! עכשיו ב-Vercel:
echo   1. Deployments - Redeploy
echo   2. Settings - Root Directory: ריק או client
echo   3. VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
echo ========================================
pause
