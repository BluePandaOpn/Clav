$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")
python python/script/launcher.py setup @args
