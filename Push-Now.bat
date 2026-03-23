@echo off
cd /d "%~dp0"
echo.
echo === Push to GitHub (runs outside Cursor to avoid .git lock) ===
echo Commit: Fix Forgot Password + auth improvements
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { Set-Location '%~dp0'; git add . 2>$null; git status --short; git commit -m 'Fix Forgot Password: PKCE-compatible reset, confirm-reset route, cookie-based auth'; git push -u origin main }"
echo.
pause
