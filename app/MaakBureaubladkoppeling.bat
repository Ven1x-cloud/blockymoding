@echo off
title BlockyMod Studio - bureaubladkoppeling maken
cd /d "%~dp0"

set "DESKTOP="
for /f "delims=" %%D in ('powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"') do set "DESKTOP=%%D"

if not defined DEKSTOP if not defined DESKTOP (
  echo Kon de bureaubladmap niet vinden.
  pause
  exit /b 1
)

set "ICO=%~dp0icon.ico"
if not exist "%ICO%" set "ICO="

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut('%DESKTOP%\BlockyMod Studio.lnk');" ^
  "$lnk.TargetPath = '%~dp0Start.bat';" ^
  "$lnk.WorkingDirectory = '%~dp0';" ^
  "$lnk.Description = 'BlockyMod Studio - maak simpel Minecraft mods';" ^
  "if ('%ICO%' -ne '') { $lnk.IconLocation = '%ICO%,0' };" ^
  "$lnk.Save();"

if exist "%DESKTOP%\BlockyMod Studio.lnk" (
  echo.
  echo  Klaar! Er staat nu een koppeling "[BlockyMod Studio]" op je bureaublad.
  echo.
) else (
  echo  Maken van de koppeling is mislukt.
  echo  Je kunt de app ook starten met Start.bat
)
pause
