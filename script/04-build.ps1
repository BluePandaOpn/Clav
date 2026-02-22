. "$PSScriptRoot/common.ps1"
Write-Banner "CLAVES :: Build (PowerShell)"

$root = Get-ProjectRoot
Set-Location $root

Assert-Command "npm"
Invoke-AnimatedStep -Name "npm run build" -Action { npm run build }
Write-Host "[DONE] Build completed." -ForegroundColor Green
