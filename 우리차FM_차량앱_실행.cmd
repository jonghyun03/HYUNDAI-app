@echo off
setlocal
cd /d "%~dp0"
py -3 scripts\build-vehicle.py
if errorlevel 1 goto failed
py -3 scripts\run-vehicle.py %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo See WINDOWS.md for setup instructions.
pause
exit /b 1
