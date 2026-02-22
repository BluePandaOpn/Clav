$ErrorActionPreference = "Stop"

function Get-ProjectRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Write-Banner {
  param([string]$Title)
  Write-Host ""
  Write-Host "==============================================" -ForegroundColor Cyan
  Write-Host "  $Title" -ForegroundColor Cyan
  Write-Host "==============================================" -ForegroundColor Cyan
}

function Write-Step {
  param([string]$Message)
  Write-Host "[STEP] $Message" -ForegroundColor Yellow
}

function Invoke-AnimatedStep {
  param(
    [string]$Name,
    [scriptblock]$Action,
    [switch]$AllowFailure
  )

  Write-Host "[RUN ] $Name" -ForegroundColor Gray
  for ($i = 0; $i -le 100; $i += 20) {
    Write-Progress -Activity $Name -Status "$i% complete" -PercentComplete $i
    Start-Sleep -Milliseconds 70
  }
  & $Action
  $exitCode = $LASTEXITCODE
  Write-Progress -Activity $Name -Completed
  if ($exitCode -ne 0) {
    if ($AllowFailure) {
      Write-Host "[WARN] $Name failed (exit $exitCode) - continuing." -ForegroundColor Yellow
      return
    }
    throw "Step failed ($exitCode): $Name"
  }
  Write-Host "[OK  ] $Name" -ForegroundColor Green
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}
