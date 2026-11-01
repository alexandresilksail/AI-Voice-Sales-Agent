# AI Voice Sales Agent — LOCAL_OFFLINE

Windows Electron + React desktop demonstration. No Gemini/OpenAI account or API key is used. Local sales pricing and PENDING/UNPAID orders remain available when voice dependencies are missing.

**Current acceptance:** desktop sales and bundled Silero inference have passed automated Windows tests. The full microphone → Whisper → Ollama → Piper → speaker conversation has **not** passed: this machine has no Ollama model and official Whisper/Piper model downloads were blocked by a network reset. See [TEST_REPORT.md](TEST_REPORT.md). Do not treat the installer as an already provisioned offline voice system.

## Launch

- Installer: `outputs/AI-Voice-Sales-Agent-Setup-0.1.0-x64.exe`.
- Portable edition: extract `outputs/AI-Voice-Sales-Agent-Portable-0.1.0-x64.zip`, then run `AI Voice Sales Agent.exe`. Keep `portable.flag` beside it to store data locally. The earlier single-file portable wrapper failed its launch check and is not the recommended deliverable.
- Source: Node.js/npm, then `npm ci`, `npm run build`, `npm start`. `START.cmd` starts development mode.
- Local runtime setup: follow [LOCAL_OFFLINE_SETUP_CN.md](LOCAL_OFFLINE_SETUP_CN.md), load the runtime directory in Settings, then choose **Check local runtime** and **Start Conversation**.

## Local voice design

Microphone/AEC → continuously running Silero v5 ONNX/WASM → 16 kHz mono PCM16 speech segments → whisper.cpp child process → local Ollama streaming `/api/chat` → Piper sentence WAV synthesis → Web Audio playback. Silero assets are bundled; neither inference nor missing dependencies use a cloud fallback. The app only permits Ollama at `http://127.0.0.1:11434`, rejects remote model metadata, and blocks external session requests.

New speech stops the active audio source, aborts Whisper/Piper/Ollama work and changes the turn ID. Late results cannot resume playback. This cancellation logic has controlled asynchronous tests; actual spoken interruption still requires hardware/model acceptance.

Five fictional catalog products and local illustrations are included. Numeric/spoken-dollar counteroffers and English acceptance phrases use the deterministic local sales engine. The model cannot supply the order price. Orders are simulated, pending, and unpaid.

## Persistence and removal

Installed/source mode stores settings/orders under `%APPDATA%\AI Voice Sales Agent`. The portable EXE stores them in `AI Voice Sales Agent Data` alongside the EXE. NSIS supplies a standard Windows uninstaller and retains application data during uninstall/update. A portable copy needs no installation: close it and delete the EXE; delete its adjacent data directory only if you intend to remove your orders. Model files live in the separately selected runtime directory.

## Checks and builds

```powershell
npm run typecheck
npm run test:unit
npm run test:desktop
npm run dist:win
npm run dist:zip
npm run verify:package
```

Windows 10 was used for automated desktop checks. Windows 11 and real audio acceptance remain to be performed. Remaining limitations are listed in the test report.

## GitHub distribution

Repository: https://github.com/alexandresilksail/AI-Voice-Sales-Agent . Source is committed without dependencies, model files, user orders or secrets. Windows binaries exceed GitHub's ordinary 100 MB file limit and belong in Releases. A Windows build workflow template is provided in `github-workflows/windows-build.yml`. It is not active because the upload credential does not grant workflow permission. A repository owner can copy it to `.github/workflows/windows-build.yml` through GitHub to enable manual builds and tag prereleases. A first voice run still requires locally installed runtime/model files.

For future upload steps, see [GITHUB_UPLOAD_CN.md](GITHUB_UPLOAD_CN.md) or run `PUSH-GITHUB.cmd` after signing in to your GitHub account. Download the current preview from [GitHub Releases](https://github.com/alexandresilksail/AI-Voice-Sales-Agent/releases/tag/local-offline-preview-20261101).
