@echo off
setlocal
cd /d "%~dp0"
title Discord Bot

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed yet.
  echo.
  echo Download the LTS version from: https://nodejs.org/
  echo Install it, then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\discord.js\package.json" (
  echo Installing the bot packages for the first time...
  call npm install --omit=dev
  if errorlevel 1 (
    echo.
    echo Package installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo Starting the Discord bot...
echo Close this window or press Ctrl+C to stop it.
echo.
node index.js

echo.
echo The bot stopped. Read any error shown above before closing this window.
pause
