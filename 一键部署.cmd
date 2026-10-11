@echo off
setlocal
rem Single installation entry. Double-click for full deployment.
rem Maintenance: run this same file with -Mode Build, Check, Bootstrap or Tools.
rem Build rebuilds plugins; Check validates installation without reinstalling.
rem Bootstrap fills missing portable Node; Tools installs shared external tools.
rem Daily use: open the desktop launcher. No standalone Web launcher.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set "result=%errorlevel%"
echo.
if "%result%"=="0" (echo Deployment completed.) else (echo Deployment failed. See the step and log above.)
pause
exit /b %result%
