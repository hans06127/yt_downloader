$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root "frontend"

foreach ($port in 5000, 3001) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        throw "Port $port is already in use. Run stop-dev.bat or close the existing service."
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $frontend
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

$backendScript = Join-Path $root "start-backend.ps1"
$frontendScript = Join-Path $root "start-frontend.ps1"

Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $backendScript
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $frontendScript

Write-Host "Waiting for backend and frontend..."
$deadline = (Get-Date).AddSeconds(90)
do {
    Start-Sleep -Seconds 1
    $backendReady = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
    $frontendReady = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
} while ((-not $backendReady -or -not $frontendReady) -and (Get-Date) -lt $deadline)

if ($backendReady -and $frontendReady) {
    Write-Host "Ready: http://localhost:3001"
    Start-Process "http://localhost:3001"
}
else {
    Write-Warning "Services are not fully ready. Check the Backend and Frontend console windows."
}
