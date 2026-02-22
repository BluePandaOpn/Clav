param(
  [string]$RepoUrl = "https://github.com/BluePandaOpn/Clav.git",
  [string]$DefaultBranch = "main"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  CLAVES :: Auto Repair / Update (PowerShell)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is required but was not found in PATH."
}

if (-not (Test-Path ".git")) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $target = Join-Path (Split-Path $Root -Parent) "Claves-repair-$stamp"
  Write-Host "[WARN] .git not found in current folder. Cloning clean copy to: $target" -ForegroundColor Yellow
  & git clone --depth 1 $RepoUrl $target
  if ($LASTEXITCODE -ne 0) { throw "Clone failed." }
  Write-Host "[OK] Clean clone created: $target" -ForegroundColor Green
  exit 0
}

Write-Host "[INFO] Syncing from: $RepoUrl"
& git remote set-url origin $RepoUrl
if ($LASTEXITCODE -ne 0) { throw "Could not set origin URL." }

& git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }

$branch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
  $branch = $DefaultBranch
}

& git show-ref --verify --quiet ("refs/remotes/origin/" + $branch)
if ($LASTEXITCODE -ne 0) {
  $branch = $DefaultBranch
}

Write-Host "[WARN] Hard reset and clean will discard local changes." -ForegroundColor Yellow
& git reset --hard ("origin/" + $branch)
if ($LASTEXITCODE -ne 0) { throw "Reset failed." }

& git clean -fd
if ($LASTEXITCODE -ne 0) { throw "Clean failed." }

& git submodule update --init --recursive
if ($LASTEXITCODE -ne 0) { throw "Submodule update failed." }

Write-Host "[OK] Project updated successfully from origin/$branch." -ForegroundColor Green
