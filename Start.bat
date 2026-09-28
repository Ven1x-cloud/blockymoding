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

if not exist "app\node_modules" (
  echo.
  echo  Eerste keer? Even dependencies installeren, dit kan een paar minuten duren...
  echo.
  pushd app
  call npm install --no-audit --no-fund
  set INSTALL_RC=%ERRORLEVEL%
  popd
  if not "%INSTALL_RC%"=="0" (
    echo.
    echo  npm install is mislukt.
    echo   - Controleer je internetverbinding en probeer opnieuw.
    echo   - Blijft EPERM/vergrendeld? Doe in de app-map:
    echo       rmdir /s /q node_modules   en start opnieuw.
    echo   - Lukt het niet, bijv. door een bedrijfsnetwerk? Gebruik dan
    echo     OpenInBrowser.bat - de app werkt ook in je browser.
    echo.
    pause
    exit /b 1
  )
)

call npm --prefix app start
if errorlevel 1 (
  echo.
  echo  Starten mislukt. Alternatief: dubbelklik op OpenInBrowser.bat
  echo.
  pause
)
