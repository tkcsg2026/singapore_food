@echo off
cd /d "%~dp0"
echo.
echo === Push to GitHub ===
echo Running outside Cursor - avoids file lock!
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-full-push.ps1" %*
echo.
