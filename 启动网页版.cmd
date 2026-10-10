@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" -Mode Web
set "result=%errorlevel%"
if not "%result%"=="0" pause
exit /b %result%
