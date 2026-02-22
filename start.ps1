param(
  [ValidateSet("auto", "setup", "dev", "all")]
  [string]$Profile = "auto"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptDir = Join-Path $Root "script"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  CLAVES :: PowerShell Launcher" -ForegroundColor Cyan
Write-Host "  Profile: $Profile" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Test-Path $ScriptDir)) {
  throw "Missing folder: $ScriptDir"
}

function Invoke-StepFile {
  param([string]$Name)
  $path = Join-Path $ScriptDir $Name
  Write-Host "----------------------------------------------"
  Write-Host "[RUN] $Name"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $path
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed ($LASTEXITCODE): $Name"
  }
}

function Invoke-SetupCore {
  Invoke-StepFile "01-install.ps1"
  Invoke-StepFile "03-quality.ps1"
  Invoke-StepFile "04-build.ps1"
  Invoke-StepFile "05-doctor.ps1"
}

function Invoke-SetupWithRepair {
  try {
    Invoke-SetupCore
  } catch {
    Write-Host "[WARN] Setup pipeline failed. Running project auto-repair/update..." -ForegroundColor Yellow
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "update.ps1")
    if ($LASTEXITCODE -ne 0) {
      throw "update.ps1 failed ($LASTEXITCODE)"
    }
    Write-Host "[INFO] Retry setup after update..."
    Invoke-SetupCore
  }
}

function Start-PythonSecure {
  $launcher = Join-Path $Root "python\script\03-full.ps1"
  if (-not (Test-Path $launcher)) {
    throw "Missing python secure launcher: $launcher"
  }
  Write-Host "----------------------------------------------"
  Write-Host "[RUN] python secure auto-start"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $launcher
  if ($LASTEXITCODE -ne 0) {
    throw "python secure launcher failed ($LASTEXITCODE)"
  }
}

switch ($Profile) {
  "auto" {
    Invoke-SetupWithRepair
    Start-PythonSecure
    break
  }
  "setup" {
    Invoke-SetupWithRepair
    break
  }
  "dev" {
    Invoke-StepFile "01-install.ps1"
    Invoke-StepFile "02-dev.ps1"
    break
  }
  "all" {
    Invoke-StepFile "01-install.ps1"
    Invoke-StepFile "02-dev.ps1"
    Invoke-StepFile "03-quality.ps1"
    Invoke-StepFile "04-build.ps1"
    Invoke-StepFile "05-doctor.ps1"
    break
  }
}

Write-Host "[OK] Launcher completed." -ForegroundColor Green
