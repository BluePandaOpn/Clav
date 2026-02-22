@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "REPO_URL=%~1"
if "%REPO_URL%"=="" set "REPO_URL=https://github.com/BluePandaOpn/Clav.git"

where powershell >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%update.ps1" -RepoUrl "%REPO_URL%"
  exit /b %ERRORLEVEL%
)

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] git is required but was not found in PATH.
  exit /b 1
)

pushd "%ROOT_DIR%"
if not exist ".git" (
  echo [ERROR] .git not found and PowerShell is unavailable. Run update.ps1 manually.
  popd
  exit /b 1
)

echo [INFO] Syncing from: %REPO_URL%
git remote set-url origin "%REPO_URL%" || (popd & exit /b 1)
git fetch origin --prune || (popd & exit /b 1)
for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if "%BRANCH%"=="" set "BRANCH=main"
git show-ref --verify --quiet refs/remotes/origin/%BRANCH%
if errorlevel 1 set "BRANCH=main"
echo [WARN] Hard reset and clean will discard local changes.
git reset --hard origin/%BRANCH% || (popd & exit /b 1)
git clean -fd || (popd & exit /b 1)
git submodule update --init --recursive || (popd & exit /b 1)
echo [OK] Project updated successfully from origin/%BRANCH%.
popd
exit /b 0
