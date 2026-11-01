param([string]$Directory = (Join-Path $PSScriptRoot '..\local-runtime'), [switch]$IncludeOllama)
$ErrorActionPreference = 'Stop'
$runtimeRoot = [IO.Path]::GetFullPath($Directory)
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
$receipt = @()
function Status([string]$component,[string]$state,[long]$bytes=0) {
  @{component=$component;state=$state;bytes=$bytes;updatedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeRoot 'download-status.json') -Encoding utf8
  Write-Host "$component : $state ($bytes bytes)"
}
function Hash([string]$file) { return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
function Download([string]$name,[string]$url,[string]$relative,[string]$expected='') {
  $file=Join-Path $runtimeRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
  if((Test-Path -LiteralPath $file) -and $expected -and ((Hash $file) -eq $expected)){ Status $name 'Already verified'; return $file }
  if((Test-Path -LiteralPath $file) -and !$expected){Status $name 'Existing local archive (hash recorded)' (Get-Item -LiteralPath $file).Length;return $file}
  $partial=$file+'.partial'
  Status $name 'Downloading'
  & curl.exe --fail --location --retry 2 --connect-timeout 20 --max-time 900 --output $partial $url
  if($LASTEXITCODE -ne 0){throw "$name download failed. Re-run setup to retry; there is no online voice fallback."}
  $actual=Hash $partial
  if($expected -and $actual -ne $expected){throw "$name SHA-256 mismatch; the partial file was not installed."}
  Move-Item -LiteralPath $partial -Destination $file -Force
  Status $name 'Downloaded and hashed' (Get-Item -LiteralPath $file).Length
  return $file
}
function Record([string]$file,[string]$version,[string]$source) {
  $script:receipt+=@{path=$file.Substring($runtimeRoot.Length+1);version=$version;sha256=(Hash $file);source=$source}
  @{version=1;createdAt=[DateTime]::UtcNow.ToString('o');files=@($script:receipt)} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runtimeRoot 'runtime-manifest.json') -Encoding utf8
}
function HuggingFace([string]$repo,[string]$path,[string]$relative) {
  $model=Invoke-RestMethod -Uri ('https://huggingface.co/api/models/'+$repo) -TimeoutSec 30
  $revision=$model.sha
  $parent=if($path -match '/'){$path.Substring(0,$path.LastIndexOf('/'))}else{''}
  $listing=Invoke-RestMethod -Uri ('https://huggingface.co/api/models/'+$repo+'/tree/'+$revision+'/'+$parent+'?expand=true&limit=1000') -TimeoutSec 30
  $entry=$listing | Where-Object {$_.path -eq $path} | Select-Object -First 1
  $expected=if($entry.lfs){$entry.lfs.oid}else{''}
  $url='https://huggingface.co/'+$repo+'/resolve/'+$revision+'/'+$path
  $file=Download $relative $url $relative $expected
  Record $file $revision $url
  return $file
}
try {
  $whisperUrl='https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip'
  $zip=Download 'whisper.cpp b5454' $whisperUrl 'downloads/whisper.zip' '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb'
  Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $runtimeRoot 'whisper') -Force
  $whisper=Get-ChildItem (Join-Path $runtimeRoot 'whisper') -Filter whisper-cli.exe -Recurse | Select-Object -First 1
  if(!$whisper){throw 'whisper-cli.exe was not found in the official archive.'}
  Get-ChildItem (Join-Path $runtimeRoot 'whisper') -File -Recurse | ForEach-Object {Record $_.FullName 'b5454' $whisperUrl}
  $piperUrl='https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip'
  $zip=Download 'Piper 2023.11.14-2' $piperUrl 'downloads/piper.zip'
  Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $runtimeRoot 'piper') -Force
  $piper=Get-ChildItem (Join-Path $runtimeRoot 'piper') -Filter piper.exe -Recurse | Select-Object -First 1
  if(!$piper){throw 'piper.exe was not found in the official archive.'}
  Get-ChildItem (Join-Path $runtimeRoot 'piper') -File -Recurse | ForEach-Object {Record $_.FullName '2023.11.14-2' $piperUrl}
  if($IncludeOllama) {
    $release=Invoke-RestMethod 'https://api.github.com/repos/ollama/ollama/releases/latest' -TimeoutSec 30
    $asset=$release.assets | Where-Object {$_.name -eq 'ollama-windows-amd64.zip'} | Select-Object -First 1
    if(!$asset){throw 'The official Ollama Windows x64 archive is unavailable.'}
    $expected=if($asset.digest){$asset.digest -replace '^sha256:',''}else{''}
    $zip=Download ('Ollama '+$release.tag_name) $asset.browser_download_url 'downloads/ollama.zip' $expected
    Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $runtimeRoot 'ollama') -Force
    $ollama=Get-ChildItem (Join-Path $runtimeRoot 'ollama') -Filter ollama.exe -Recurse | Select-Object -First 1
    if(!$ollama){throw 'ollama.exe was not found in the official archive.'}
    Record $ollama.FullName $release.tag_name $asset.browser_download_url
    Write-Host ('Next: run '+(Join-Path $PSScriptRoot 'start-local-ollama.ps1')+' -Directory "'+$runtimeRoot+'"')
    Write-Host 'Then run: ollama pull qwen2.5:3b (setup only; downloads a local model).'
  }
  $whisperModel=HuggingFace 'ggerganov/whisper.cpp' 'ggml-base.bin' 'models/ggml-base.bin'
  $voice=HuggingFace 'rhasspy/piper-voices' 'en/en_US/lessac/medium/en_US-lessac-medium.onnx' 'models/en_US-lessac-medium.onnx'
  $null=HuggingFace 'rhasspy/piper-voices' 'en/en_US/lessac/medium/en_US-lessac-medium.onnx.json' 'models/en_US-lessac-medium.onnx.json'
  @{version=1;createdAt=[DateTime]::UtcNow.ToString('o');files=@($receipt)} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runtimeRoot 'runtime-manifest.json') -Encoding utf8
  @{runtimeDirectory=$runtimeRoot;whisperPath=$whisper.FullName;whisperModel=$whisperModel;piperPath=$piper.FullName;piperModel=$voice;ollamaUrl='http://127.0.0.1:11434';ollamaModel='qwen2.5:3b'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeRoot 'runtime-config.json') -Encoding utf8
  Status 'Local runtime files' 'Complete'
  Write-Host ('In the app, set Runtime directory to '+$runtimeRoot+' and click Load runtime directory.')
} catch { Status 'Local setup' ('FAILED: '+$_.Exception.Message); throw }

