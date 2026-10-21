@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 20 or newer from https://nodejs.org
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
set "TIKTOK_USERNAME=familydramaaf"
set "DEMO_MODE=false"
set "EXTENDED_GIFT_INFO=false"
node direct-link.js
pause
