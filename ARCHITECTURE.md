# LOCAL_OFFLINE architecture

Electron main retains the original local sales and JSON persistence services. The preload exposes validated IPC operations; renderer Node integration is disabled and context isolation/sandbox remain enabled. Cloud provider modules and API-key configuration have been removed.

`src/main/local-runtime.ts` manages whisper.cpp/Piper child processes and Ollama loopback requests. Only `http://127.0.0.1:11434` is allowed, redirects are rejected, and installed model metadata is checked for remote models before chat. Chat is NDJSON streamed and capped at a small context/output budget. Abort signals cancel active subprocesses/HTTP requests; temporary audio files are removed after child exit.

`src/renderer/services/local-offline.ts` keeps the microphone open during playback. Bundled Silero v5 ONNX/WASM runs in real time through AudioWorklet and segments 16 kHz mono audio. Segments become PCM16 WAV input to whisper.cpp; no ASR HTTP service is used. The maximum segment is approximately 15 seconds. Piper sentences are synthesized locally into WAV, decoded by Web Audio, and played in sequence. Ollama text streams into subtitles; speech currently starts after a complete model response, with sentence synthesis/playback afterward.

Each speech onset assigns a new turn, stops the current AudioBufferSourceNode and cancels the old main-process AbortController. All asynchronous results check the active turn before playback. The sales service starts the new turn at speech onset so late acceptance cannot create an order. Numeric price offers use local negotiation tools; orders validate floor price and customer acceptance in main.

`src/main/runtime-manager.ts` imports a selected local runtime directory and streams SHA-256 checks over manifest files, rejecting paths outside that directory. `scripts/install-local-runtime.ps1` downloads official files only during explicit setup and records status, source revision and checksums. Models are not bundled into the installer, except the small Silero detector required for capture.

Installed/source data uses `%APPDATA%/AI Voice Sales Agent`; the portable launcher uses an adjacent `AI Voice Sales Agent Data` folder. NSIS preserves application data on uninstall. Model files are independent of application updates.

Known gaps: no automatic model downgrade, no automatic microphone reconnection, no measured AEC/barge-in performance, no completed full offline hardware acceptance. Chinese ASR/LLM configuration is available but Chinese sales-intent parsing and voice output are not end-to-end verified.
