# Test report — LOCAL_OFFLINE — 2026-11-01

Environment: actual Windows 10 build 19045, Electron 45.2.1, x64. Tests ran in this project directory. Windows 11 was not tested.

## Executed checks

| Check | Status | Evidence / boundary |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` |
| Business/runtime unit suite | PASS | 44 tests; prices, order validation/persistence, loopback restrictions, checksum corruption/path traversal, controlled asynchronous turn cancellation |
| Electron sales desktop | PASS | Actual window; five catalog images; $85 approval; $65 rejection; saved PENDING/UNPAID order reloaded after process restart |
| Silero ONNX/WASM | PASS | Actual Electron/Web Audio inference on at least 15 locally generated silent frames; no speech onset on silence |
| Four interruption controls | PASS, controlled tests | Stop active source; discard late Piper result; discard late Whisper result; discard late LLM result. Mocks/deferred tasks, not spoken barge-in |
| Runtime provisioning | BLOCKED | Official Whisper/Piper ZIPs downloaded; Whisper archive SHA-256 matched GitHub release. Hugging Face TLS connection reset prevented model download |
| Windows NSIS setup | PASS | Actual install into isolated `work/installer-smoke`, exit code 0; app EXE and uninstaller present |
| Installed application | PASS | Two desktop tests also passed against the actual installed EXE, including process restart/order persistence and Silero inference |
| Windows uninstall | PASS | Generated uninstaller exit code 0; installed app EXE removed. Evidence: `outputs/install-smoke.json` |
| Setup and portable build | PASS | Both build commands executed; EXE headers, sizes, SHA-256 and current-build asset equality passed `verify:package` |
| Single-file portable launcher | FAIL | Both Electron launch injection and normal launcher returned -4058. Replaced recommended portable distribution with a ZIP of the unpacked app and `portable.flag` |

Raw desktop results: `outputs/desktop-test-results.json`. UI capture: `outputs/desktop-orders.png`. Build/package evidence is recorded in `outputs/package-audit.json` after the final audit.

## Requested real voice acceptance

| Test | Status | Reason |
|---|---|---|
| 1. Automatic audible English welcome | BLOCKED | Piper voice / complete runtime absent |
| 2. Customer real microphone English speech | NOT TESTED | No completed hardware voice session |
| 3. Local Whisper speech recognition | BLOCKED | Whisper model unavailable |
| 4. Local Ollama English answer | BLOCKED | Ollama/Qwen not provisioned locally |
| 5. Piper English voice synthesis | BLOCKED | Voice model/config unavailable |
| 6. Audible AI speaker playback | NOT TESTED | No complete TTS output |
| 7. Spoken interruption immediately stops playback | BLOCKED | Controlled cancellation tests passed; real audio test unavailable |
| 8. Recognize/respond to the new question | BLOCKED | Full ASR/LLM/TTS loop unavailable |
| 9. Spoken negotiation protects floor | BLOCKED for voice; PASS locally | Engine/UI verified $85 accepted, $65 rejected |
| 10. Spoken acceptance creates order | BLOCKED for voice; PASS locally | Engine/UI verified PENDING/UNPAID and acceptance validation |
| 11. Disconnect internet, restart and converse | NOT TESTED | Models absent; no offline acceptance claim |
| 12. No external API requests during complete conversation | NOT TESTED | Main request restrictions/CSP/model guards implemented; no complete conversation or packet capture |

## Build and uninstall

NSIS setup and portable builds executed successfully. The single-file portable EXE failed launch and is superseded by a portable ZIP containing the unpacked app and adjacent-data marker. Final `verify:package` checks the setup EXE and portable ZIP: 28 packaged files; current dist assets match app.asar; required local Silero/WASM files exist; no source/test/env/source-map files or permanent-key patterns detected. Current sizes and SHA-256 values are in `outputs/package-audit.json`. The ZIP is a distribution format change; no additional full audio test was performed.

The setup was installed into the isolated project test directory, the installed EXE passed the desktop suite, and the generated uninstaller removed it successfully. Orders were tested with an isolated test profile; retention of a populated normal user profile across uninstall/update was not separately tested. No audible operation follows from these installation tests.

## Failures fixed

- Vitest initially loaded Playwright specs. Separate `vitest.config.mts` now limits unit discovery.
- Sandboxed command execution triggered Electron AppContainer startup failure; desktop tests passed outside the command sandbox while retaining the application renderer sandbox.
- The page CSP initially blocked Silero WASM despite the main response CSP allowing it. Both now permit `wasm-unsafe-eval`; Silero inference passed afterward.

## Remaining limitations

- No true-microphone or audible barge-in acceptance. AEC effectiveness/latency not measured; use headphones when needed.
- Missing-model guidance is available; automatic resource-based model downgrade is not implemented. Choose a smaller installed Qwen model manually.
- A disconnected microphone ends the session; reconnection requires Start Conversation. Model service failures show errors and can be retried; no cloud fallback occurs.
- Whisper uses short segments; LLM text streams, but current Piper speech starts after full response text. Sentence boundaries may introduce gaps.
- English sales-intent phrases are deterministic patterns, not comprehensive natural-language intent parsing. Chinese voice/catalog/order scenarios need further tests.
- Setup downloads, manifest hash validation and import exist; download progress is in the setup terminal/status file rather than an in-app download bar. Fully successful model provisioning has not been tested on this network.
- Installer signing certificate is not configured. Windows 11 install/audio verification remains outstanding.
- The downloaded Whisper executable was denied execution on this machine even outside the command sandbox. The ZIP passed its official hash check, but no successful Whisper process startup or inference is claimed. Piper `--help` ran successfully; synthesis still requires missing voice files.
