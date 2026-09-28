@echo off
title BlockyMod Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is niet gevonden.
  echo  Installeer eerst Node.js van https://nodejs.org  en probeer het opnieuw.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  Eerste keer? Even dependencies installeren, dit kan een paar minuten duren...
  echo.
  call npm install || (
    echo  npm install mislukt.
    pause
    exit /b 1
  )
)

call npm start
if errorlevel 1 pause
