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
echo  חסר רק השרת (Render) - עכשיו נחבר אותו.
echo.
echo  ─────────────────────────────────────────
echo  שלב 1: ייפתח Render - לחץ "Sign in with GitHub"
echo  שלב 2: ב-GitHub לחץ "Authorize Render"
echo  שלב 3: בשדה OPENAI_API_KEY - הדבק את המפתח
echo         (נמצא בקובץ server\.env)
echo  שלב 4: לחץ "Apply" או "Create Blueprint"
echo  ─────────────────────────────────────────
echo.
echo  פותח Render...
start https://render.com/deploy?repo=https://github.com/orianter/reel-analyzer
timeout /t 2 >nul
echo  פותח את קובץ המפתח (server\.env)...
start notepad "server\.env"
echo.
echo  אחרי ש-Render מראה LIVE (3-5 דקות):
echo  שלח לי את הכתובת שמופיעה למעלה, למשל:
echo  https://reel-analyzer-xxxx.onrender.com
echo.
pause
