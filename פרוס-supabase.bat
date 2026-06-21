@echo off
chcp 65001 >nul
echo ========================================
echo   פריסת Supabase Function - analyze
echo ========================================
echo.
echo דרוש: supabase login (פעם אחת)
echo.
npx supabase functions deploy analyze --project-ref hgfyokwxcvuufzskvloi
echo.
pause
