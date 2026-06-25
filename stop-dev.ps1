$ErrorActionPreference = "Stop"

$stopped = @()
foreach ($port in 5000, 3001) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $processId = $listener.OwningProcess
        if ($processId -and $processId -notin $stopped) {
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                & taskkill.exe /PID $processId /T /F | Out-Null
            }
            else {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
            $stopped += $processId
            Write-Host "Stopped PID $processId on port $port"
        }
    }
}

if (-not $stopped.Count) {
    Write-Host "Ports 3001 and 5000 are already free."
}

$deadline = (Get-Date).AddSeconds(15)
do {
    $remaining = foreach ($port in 5000, 3001) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    }
    if (-not $remaining) {
        break
    }
    Start-Sleep -Milliseconds 300
} while ((Get-Date) -lt $deadline)

if ($remaining) {
    $ports = ($remaining.LocalPort | Sort-Object -Unique) -join ", "
    throw "Unable to release development ports: $ports"
}
