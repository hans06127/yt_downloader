$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "YT Downloader Backend"
Set-Location -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path)
python app.py
