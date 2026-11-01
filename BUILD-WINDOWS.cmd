@echo off
cd /d "%~dp0"
call npm.cmd run dist:win
if errorlevel 1 goto failed
call npm.cmd run dist:zip
if errorlevel 1 goto failed
call npm.cmd run verify:package
if errorlevel 1 goto failed
exit /b 0
:failed
pause
exit /b 1
