$ErrorActionPreference = 'Stop'

$releaseRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sandboxRoot = Join-Path $releaseRoot 'sandbox'
$url = 'http://127.0.0.1:8765/#/overview'

if (-not (Test-Path -LiteralPath (Join-Path $sandboxRoot 'engine\server.py'))) {
    throw 'The sandbox folder is incomplete. Extract the complete GitHub ZIP before starting.'
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host 'Python was not found.' -ForegroundColor Red
    Write-Host 'Install Python 3.10 or newer, then run START_FULL_SANDBOX.bat again.'
    Write-Host 'Download: https://www.python.org/downloads/'
    exit 1
}

$alreadyRunning = $false
$portProbe = [System.Net.Sockets.TcpClient]::new()
try {
    $portProbe.Connect('127.0.0.1', 8765)
    $alreadyRunning = $true
} catch {
    # Expected when the local server has not started yet.
} finally {
    $portProbe.Dispose()
}

if ($alreadyRunning) {
    Write-Host 'Sandbox is already running. Opening the UI...' -ForegroundColor Green
    Start-Process $url
    exit 0
}

Set-Location -LiteralPath $sandboxRoot
Write-Host 'Starting Decision Engine Offline Research Workbench...' -ForegroundColor Cyan
Write-Host "UI: $url"
Write-Host 'Keep this window open. Press Ctrl+C to stop the sandbox.' -ForegroundColor Yellow

$openBrowser = Start-Job -ScriptBlock {
    param($targetUrl)
    Start-Sleep -Seconds 2
    Start-Process $targetUrl
} -ArgumentList $url

try {
    & $python.Source -m engine.server
} finally {
    Remove-Job -Job $openBrowser -Force -ErrorAction SilentlyContinue
}

