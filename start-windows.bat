@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or newer from https://nodejs.org/
  pause
  exit /b 1
)

echo Starting Appliance Innovation Keyword Tool...
echo Open http://localhost:3000/ in your browser.
node server.js
pause
