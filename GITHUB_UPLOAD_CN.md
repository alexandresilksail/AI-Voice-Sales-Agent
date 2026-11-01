# GitHub 提交与程序发布

目标仓库：https://github.com/alexandresilksail/AI-Voice-Sales-Agent

本地目录已初始化 Git，main 分支已创建源码提交并绑定 origin。源码不包含 API Key、模型、依赖、订单或大型 EXE。本次发布使用经验证具有仓库写权限的临时认证，凭证不写入仓库；以后更新请使用下面的官方登录流程。

预发布地址：https://github.com/alexandresilksail/AI-Voice-Sales-Agent/releases/tag/local-offline-preview-0.1.1 。源码提交和附件上传结果以 GitHub 页面为准。

## 完成登录后提交

在项目目录运行 `PUSH-GITHUB.cmd`，它会通过官方 GitHub 浏览器登录，再执行 `git push -u origin main`。也可以在 GitHub Desktop 中选择 File → Add local repository，添加当前目录，登录拥有该仓库写权限的账号，再 Push origin。不要把 Token 或密码发送到聊天中。

## 生成可下载程序

现成安装包及绿色 ZIP 会直接上传到预发布版本，无须等待 Actions 构建。

本次 Token 没有工作流写权限，因此自动构建模板放在 `github-workflows/windows-build.yml`，当前不会运行。仓库所有者可在 GitHub 网页将该模板创建为 `.github/workflows/windows-build.yml`，以后再打开 Actions → Build Windows desktop → Run workflow。工作流只安装依赖、构建和检查包文件，不运行耗时的语音/桌面测试。

启用上述工作流后，若需要 GitHub Releases 自动附加程序，推送版本标签：

```powershell
git tag v0.1.0-local-preview
git push origin v0.1.0-local-preview
```

标签工作流创建预发布版本，并上传 Setup EXE、Portable ZIP、校验报告和离线安装说明。安装包超过 GitHub 普通 Git 文件 100 MB 限制，请使用 Releases，不能直接 `git add outputs`。

也可直接在仓库 Releases → Draft a new release 中上传本地 `outputs` 里的 Setup EXE 和 Portable ZIP。不要上传旧的 Portable EXE，它的启动器测试失败；绿色版本使用 ZIP，解压后运行应用 EXE。

## 当前交付边界

应用界面、商品、议价、订单及标准安装/卸载已有实际验证。真实离线语音闭环仍需要本地 Whisper/Piper 模型和 Ollama/Qwen，当前环境未完成。发布名称/说明必须保留“预览版”和此限制，不要描述为已通过完全离线语音验收。详见 TEST_REPORT.md。

