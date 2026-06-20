@echo off
chcp 65001 >nul
title Reel Analyzer - חיבור לאינטרנט
color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   חיבור הניתוח לאינטרנט - 4 לחיצות     ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  האתר כבר באוויר: https://reelzanalyze1.vercel.app
echo  חסר רק Supabase + OpenAI - עכשיו נחבר אותם.
echo.
echo  ─────────────────────────────────────────
echo  שלב 1: ייפתח Supabase
echo  שלב 2: בפרויקט שלך פתח Edge Functions / Secrets
echo  שלב 3: הוסף OPENAI_API_KEY והדבק את המפתח
echo  שלב 4: פרוס את הפונקציה analyze
echo  ─────────────────────────────────────────
echo.
echo  פותח Supabase...
start https://supabase.com/dashboard/projects
timeout /t 2 >nul
echo  פותח את קובץ ההגדרות לדוגמה...
start notepad "client\.env.example"
echo.
echo  אחרי הפריסה:
echo  הגדר ב-Vercel את VITE_SUPABASE_URL ואת VITE_SUPABASE_ANON_KEY.
echo.
pause
