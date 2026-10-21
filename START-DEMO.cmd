@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 20 or newer from https://nodejs.org then try again.
 pause
 exit /b 1
)
if not exist node_modules (
 call npm ci
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
if not exist .env copy .env.example .env >nul
set "DEMO_MODE=true"
echo Open http://127.0.0.1:3100/overlay in your browser or LIVE Studio.
echo Keep this window open. Press Ctrl+C to stop.
call npm start
pause
