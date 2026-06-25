$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "YT Downloader Frontend"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath (Join-Path $root "frontend")
npm run dev:3001
