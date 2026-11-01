@echo off
cd /d "%~dp0"
echo Local voice needs Ollama, Whisper and Piper with their model files.
echo This SETUP step downloads official resources. Conversations use local files afterward.
echo Model downloads can be large. Keep this window open to see progress or failures.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-local-runtime.ps1" -IncludeOllama
if errorlevel 1 goto failed
echo.
echo Files downloaded. Start Ollama and pull the Qwen model as shown above.
echo Then choose the runtime folder in the app Settings and run Check local runtime.
pause
exit /b 0
:failed
echo.
echo Setup is incomplete. Read the error above. No online service will replace missing files.
echo You can copy local model files from another computer; see LOCAL_OFFLINE_SETUP_CN.md.
pause
exit /b 1
