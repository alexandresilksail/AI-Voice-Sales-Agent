# 本地离线语音安装说明

项目目录：`C:\Users\Administrator\Documents\ChatGPT\AI VOICE SALES AGENT 2`。

本版本不使用任何云端 API Key。首次安装本地程序与模型需要下载资源；全部安装成功后，应用的设计运行路径只访问本机 Ollama。**本机尚未通过断网语音验收。**

## 1. 准备运行时

0.1.1 安装版和绿色版可直接进入 **Settings → Open setup folder**，双击 `INSTALL-LOCAL-RUNTIME.cmd` 查看下载步骤及进度。该入口只打开文件夹，不会静默联网安装。完整安装仍需要模型下载成功，并启动 Ollama、安装 Qwen 模型。

截图中的 `ERR_CONNECTION_REFUSED` 表示本机 11434 端口没有运行 Ollama；`Executable unavailable` 和 `Missing or empty` 分别表示程序路径与模型文件尚未配置。它们是依赖未就绪的真实提示。旧版把 Gemini 设置迁移误报为订单损坏，0.1.1 已修复，不需要删除订单。

在项目目录打开 PowerShell：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local-runtime.ps1 -Directory "D:\AI-Voice-Runtime" -IncludeOllama
```

已有 Ollama 时可以省略 `-IncludeOllama`。下载较大，状态显示在终端，同时保存在目标目录的 `download-status.json`。已完成文件的版本、来源和 SHA-256 写入 `runtime-manifest.json`；模型元数据可访问时会验证 Hugging Face 提供的 LFS SHA-256。Piper 的旧版发布没有提供上游摘要，记录的是本地文件摘要，不能当成上游签名验证。

当前机器已下载 `local-runtime\whisper\Release\whisper-cli.exe` 及 `local-runtime\piper\piper\piper.exe`。Whisper 发布摘要核验通过。官方 Hugging Face 连接被重置，模型未下载完成；不要把下载状态误认为安装完成。可在能直连官方资源的电脑下载后，以移动硬盘复制整个运行目录，无须 VPN 或代理。

本机还拒绝启动下载的 Whisper EXE，沙箱外执行也相同。需要在目标 Windows 环境排查该文件的访问/安全策略，并先确认 `whisper-cli.exe --help` 能运行。Piper 的 `--help` 已运行成功；没有声音模型时仍不能合成。

手动准备时需要：

- [whisper.cpp 官方发布](https://github.com/ggml-org/whisper.cpp/releases)：x64 CPU 版本，保留全部 DLL。
- [Whisper 多语言模型](https://huggingface.co/ggerganov/whisper.cpp)：`ggml-base.bin`；中文不要选择 `.en` 模型。
- [Piper Windows 官方发布](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2)：保留整个目录及 DLL。
- [Piper 英语声音](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac/medium)：`en_US-lessac-medium.onnx` 和同名 `.onnx.json`，两个文件放在同一目录。
- [Ollama 官方安装](https://ollama.com/download/windows)，或安装脚本提供的独立目录版本。

Silero v5 ONNX 模型和 WASM 已随应用打包，无须另配 whisper.cpp 的 Silero GGML 文件。

## 2. 启动本机 Ollama 并安装模型

独立运行时版本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-ollama.ps1 -Directory "D:\AI-Voice-Runtime"
$env:OLLAMA_HOST="127.0.0.1:11434"
$env:OLLAMA_NO_CLOUD="1"
$env:OLLAMA_MODELS="D:\AI-Voice-Runtime\ollama-models"
& "D:\AI-Voice-Runtime\ollama\ollama.exe" pull qwen2.5:3b
```

如果解压后的 `ollama.exe` 在子目录，使用其实际路径。使用系统安装的 Ollama 时运行 `ollama pull qwen2.5:3b`。`pull` 只属于安装步骤；运行期间不会自动拉取模型，也不会调用 Ollama Cloud。

内存不足时先安装 `qwen2.5:1.5b` 或 `qwen2.5:0.5b`，然后在设置中更换模型。当前版本**没有自动降级模型**；服务失败会显示错误，不会自动联网替代。

## 3. 设置应用

1. 安装或启动绿色版 EXE，进入 Settings。
2. 点击 **Choose runtime folder**，或填写 Runtime directory 后点击 **Load runtime directory**，选择包含 `runtime-config.json` 的目录。0.1.1 支持相对路径及旧清单路径迁移；导入后仍需检查是否缺少模型文件。
3. 手动安装时直接填写 whisper.cpp executable、Whisper model file、Piper executable、Piper voice model 的绝对路径。
4. 点击 **Verify file hashes** 校验安装清单；手动文件没有清单时该项会说明缺失，仍可使用单独路径检测。
5. 选择麦克风、扬声器和识别语言；点击 **Check local runtime**。麦克风检查会申请真实权限；设备存在不代表已验证可听到声音。
6. 全部运行时检查通过后，返回 Conversation 并点击 **Start Conversation**。后续重启会自动尝试欢迎语。

建议使用耳机。应用请求 Chromium 的 echoCancellation、noiseSuppression 和 autoGainControl，但本机回声消除效果没有实测。拔掉麦克风会结束当前会话；重新连接后再次点击 Start Conversation。

中文识别使用多语言 Whisper；中文语音输出还需要自行安装中文 Piper ONNX/config 并更换声音路径。英语声音不会自动变成中文声音。

## 4. 断网验收

先确认所有运行时/模型在本机，再断开互联网、重启 Ollama 和应用。测试欢迎、英语提问、三轮对话和播放中插话，接着询价 `$85`、拒绝 `$65`、明确说 “Deal! I'll take it.”，核对 PENDING/UNPAID 订单及重启后的历史。使用本机防火墙日志或抓包核查外部连接。

本次没有执行该完整验收；没有将静音帧测试或取消单测作为真实麦克风测试。

## 5. 卸载与绿色版

安装版通过 Windows“设置 → 应用”中的 AI Voice Sales Agent 卸载，也可运行安装目录的卸载程序。普通卸载/更新保留订单与设置。模型目录独立保留。

绿色 ZIP 版解压后直接运行 `AI Voice Sales Agent.exe`，保留同目录的 `portable.flag`。关闭后可删除解压目录；订单和设置在其中的 `AI Voice Sales Agent Data`，删除前请备份。先前单文件便携 EXE 外壳启动返回 -4058，不作为推荐交付文件。独立运行的 Ollama 需要单独停止。
