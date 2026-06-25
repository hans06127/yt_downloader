param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    (Join-Path $root "VERSION"),
    "$Version`n",
    $utf8NoBom
)

function Update-PackageVersion {
    param([string]$Path)

    $package = Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
    $package.version = $Version
    $json = $package | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($Path, "$json`n", $utf8NoBom)
}

Update-PackageVersion (Join-Path $root "package.json")

$frontend = Join-Path $root "frontend"
Push-Location $frontend
try {
    npm version $Version --no-git-tag-version --allow-same-version
    if ($LASTEXITCODE -ne 0) {
        throw "npm version failed"
    }
}
finally {
    Pop-Location
}

Write-Host "Version updated to v$Version"
