# Project status — 2026-11-01

0.1.1 fixes legacy Gemini settings being incorrectly reported as damaged order data and adds packaged setup helpers, a native runtime folder picker and relocatable manifests. Targeted verification: TypeScript, 6 focused tests and one Electron migration/setup-screen test passed. The startup setup prompt remains intentional when local voice programs/models are missing.

Mode: LOCAL_OFFLINE. This is an incremental provider replacement of the existing Electron application.

Implemented: local Silero frame inference, Whisper subprocess ASR, loopback Ollama streaming, Piper sentence synthesis and playback, turn cancellation, device selection/checks, five products, local floor-protected pricing, pending/unpaid orders, runtime directory import and hash verification, NSIS and portable build targets.

Executed: TypeScript checks; 44 unit tests, including controlled cancellation and checksum corruption; two Windows Electron desktop tests covering catalog/pricing/order restart and actual local Silero/WASM inference on silent audio, also passed against the installed application. NSIS and portable builds passed; actual test installation/uninstallation returned exit code 0; final package audit passed. These are not full microphone conversation tests.

Blocking external conditions: Hugging Face official model connections reset; the downloaded Whisper EXE is denied execution on this machine. Whisper/Piper Windows binaries were downloaded, but their models and local Ollama/Qwen installation remain incomplete. The full voice loop, automatic audible welcome, spoken interruption, and disconnected-internet conversation remain BLOCKED/NOT TESTED. Full acceptance has not been achieved.

See TEST_REPORT.md for evidence and LOCAL_OFFLINE_SETUP_CN.md for provisioning. There is no cloud fallback or API key requirement.
