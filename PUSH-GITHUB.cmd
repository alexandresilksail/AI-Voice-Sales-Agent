@echo off
cd /d "%~dp0"
echo Signing in through the official GitHub browser flow...
git credential-manager github login --username alexandresilksail --browser
if errorlevel 1 goto failed
git push -u origin main
if errorlevel 1 goto failed
echo Source uploaded. Enable the github-workflows template in GitHub to build releases automatically.
echo Or publish a version tag: git tag v0.1.0-local-preview
echo Then: git push origin v0.1.0-local-preview
pause
exit /b 0
:failed
echo GitHub upload did not finish. Check your account permission and network.
pause
exit /b 1
