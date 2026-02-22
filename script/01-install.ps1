. "$PSScriptRoot/common.ps1"
Write-Banner "CLAVES :: Install (PowerShell)"

$root = Get-ProjectRoot
Set-Location $root

Assert-Command "node"
Assert-Command "npm"

Invoke-AnimatedStep -Name "npm install" -Action { npm install }
Write-Host "[DONE] Install completed." -ForegroundColor Green
