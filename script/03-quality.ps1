. "$PSScriptRoot/common.ps1"
Write-Banner "CLAVES :: Quality (PowerShell)"

$root = Get-ProjectRoot
Set-Location $root

Assert-Command "npm"
Invoke-AnimatedStep -Name "npm run lint" -Action { npm run lint }
Invoke-AnimatedStep -Name "npm run format:check (advisory)" -Action { npm run format:check } -AllowFailure
Write-Host "[DONE] Quality checks completed." -ForegroundColor Green
