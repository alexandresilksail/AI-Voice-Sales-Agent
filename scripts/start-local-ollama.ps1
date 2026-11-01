param([string]$Directory = (Join-Path $PSScriptRoot '..\local-runtime'))
$ErrorActionPreference='Stop'
$runtimeRoot=[IO.Path]::GetFullPath($Directory)
$ollama=Get-ChildItem (Join-Path $runtimeRoot 'ollama') -Filter ollama.exe -Recurse | Select-Object -First 1
if(!$ollama){throw 'Run install-local-runtime.ps1 -IncludeOllama first, or use an existing local Ollama installation.'}
$env:OLLAMA_HOST='127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD='1'
$env:OLLAMA_MODELS=Join-Path $runtimeRoot 'ollama-models'
Start-Process -FilePath $ollama.FullName -ArgumentList 'serve' -WorkingDirectory $ollama.DirectoryName -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'ollama-stdout.log') -RedirectStandardError (Join-Path $runtimeRoot 'ollama-stderr.log')
Write-Host 'Ollama started on 127.0.0.1:11434 with cloud disabled.'
Write-Host ('Setup only: & "'+$ollama.FullName+'" pull qwen2.5:3b')
