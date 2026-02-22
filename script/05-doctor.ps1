. "$PSScriptRoot/common.ps1"
Write-Banner "CLAVES :: Doctor (PowerShell)"

$root = Get-ProjectRoot
Set-Location $root

Assert-Command "node"
Assert-Command "npm"
Assert-Command "git"

Invoke-AnimatedStep -Name "node -v" -Action { node -v }
Invoke-AnimatedStep -Name "npm -v" -Action { npm -v }
Invoke-AnimatedStep -Name "git status --short" -Action { git status --short }
Write-Host "[DONE] Doctor checks completed." -ForegroundColor Green
