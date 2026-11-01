# Changelog

## 0.1.0 — LOCAL_OFFLINE emergency update (2026-11-01)

- Replaced default cloud voice connection with local Whisper/Ollama/Piper orchestration.
- Bundled Silero v5 ONNX and local WASM inference assets; enabled the narrowly required WASM CSP permission.
- Added PCM16 segmentation, sentence WAV playback, continuous microphone listening, and cancellation/late-result protection by turn ID.
- Kept local product illustrations, deterministic negotiation and pending/unpaid orders; registered customer turns at speech onset.
- Removed renderer cloud providers and API-key settings; restricted Ollama to loopback and rejected remote models.
- Added runtime checks, directory import, checksum verification and explicit setup/download scripts.
- Retained NSIS uninstall/data preservation and a portable build with adjacent data storage.
- Separated Playwright and Vitest discovery; added real desktop/Silero tests and controlled interruption tests.

Full real-audio and disconnected-internet acceptance is pending local model provisioning. No simulated result is described as a passed microphone test.
