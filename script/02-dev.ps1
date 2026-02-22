. "$PSScriptRoot/common.ps1"
Write-Banner "CLAVES :: Dev (PowerShell)"

$root = Get-ProjectRoot
Set-Location $root

Assert-Command "npm"
Write-Step "Starting full dev mode (client + server)."
npm run dev
