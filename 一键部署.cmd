@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set "result=%errorlevel%"
echo.
if "%result%"=="0" (echo Deployment completed.) else (echo Deployment failed. See the step and log above.)
pause
exit /b %result%
