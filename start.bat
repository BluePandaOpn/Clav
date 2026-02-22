@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
set "SCRIPT_DIR=%ROOT_DIR%script"
set "PROFILE=%~1"
if "%PROFILE%"=="" set "PROFILE=auto"

echo ==============================================
echo   CLAVES :: Windows Launcher
echo   Profile: %PROFILE%
echo ==============================================

if not exist "%SCRIPT_DIR%" (
  echo [ERROR] Missing folder: %SCRIPT_DIR%
  exit /b 1
)

where powershell >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  if exist "%ROOT_DIR%start.ps1" (
    echo [INFO] PowerShell detected. Running start.ps1...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%start.ps1" -Profile %PROFILE%
    exit /b %ERRORLEVEL%
  )
  echo [INFO] PowerShell detected. Running inline .ps1 pipeline...
  call :run_ps_flow %PROFILE%
  set "RC=%ERRORLEVEL%"
  if not "%RC%"=="0" (
    echo [WARN] .ps1 flow failed with code %RC%.
    echo [INFO] Falling back to .bat flow...
    call :run_bat_flow %PROFILE%
    exit /b %ERRORLEVEL%
  )
  exit /b 0
)

echo [WARN] PowerShell not found. Running .bat flow...
call :run_bat_flow %PROFILE%
exit /b %ERRORLEVEL%

:run_ps_flow
set "P=%~1"
set "NEED_PYTHON_START=0"
if /I "%P%"=="auto" (
  set "P=setup"
  set "NEED_PYTHON_START=1"
)
if /I "%P%"=="setup" (
  call :run_setup_ps_with_repair
  if errorlevel 1 exit /b 1
  if "!NEED_PYTHON_START!"=="1" (
    call :start_python_secure
    exit /b %ERRORLEVEL%
  )
  exit /b 0
)
if /I "%P%"=="dev" (
  call :run_ps "01-install.ps1"
  if errorlevel 1 exit /b 1
  call :run_ps "02-dev.ps1"
  exit /b %ERRORLEVEL%
)
if /I "%P%"=="all" (
  call :run_ps "01-install.ps1"
  if errorlevel 1 exit /b 1
  call :run_ps "02-dev.ps1"
  if errorlevel 1 exit /b 1
  call :run_ps "03-quality.ps1"
  if errorlevel 1 exit /b 1
  call :run_ps "04-build.ps1"
  if errorlevel 1 exit /b 1
  call :run_ps "05-doctor.ps1"
  exit /b %ERRORLEVEL%
)
echo [ERROR] Unknown profile: %P%
echo Usage: start.bat [auto^|setup^|dev^|all]
exit /b 1

:run_setup_ps_core
call :run_ps "01-install.ps1"
if errorlevel 1 exit /b 1
call :run_ps "03-quality.ps1"
if errorlevel 1 exit /b 1
call :run_ps "04-build.ps1"
if errorlevel 1 exit /b 1
call :run_ps "05-doctor.ps1"
if errorlevel 1 exit /b 1
exit /b 0

:run_setup_ps_with_repair
call :run_setup_ps_core
if not errorlevel 1 exit /b 0
echo [WARN] Setup pipeline failed. Running project auto-repair/update...
call "%ROOT_DIR%update.bat"
if errorlevel 1 exit /b 1
echo [INFO] Retry setup after update...
call :run_setup_ps_core
exit /b %ERRORLEVEL%

:run_bat_flow
set "P=%~1"
set "NEED_PYTHON_START=0"
if /I "%P%"=="auto" (
  set "P=setup"
  set "NEED_PYTHON_START=1"
)
if /I "%P%"=="setup" (
  call :run_setup_bat_with_repair
  if errorlevel 1 exit /b 1
  if "!NEED_PYTHON_START!"=="1" (
    call :start_python_secure
    exit /b %ERRORLEVEL%
  )
  exit /b 0
)
if /I "%P%"=="dev" (
  call :run_bat "01-install.bat"
  if errorlevel 1 exit /b 1
  call :run_bat "02-dev.bat"
  exit /b %ERRORLEVEL%
)
if /I "%P%"=="all" (
  call :run_bat "01-install.bat"
  if errorlevel 1 exit /b 1
  call :run_bat "02-dev.bat"
  if errorlevel 1 exit /b 1
  call :run_bat "03-quality.bat"
  if errorlevel 1 exit /b 1
  call :run_bat "04-build.bat"
  if errorlevel 1 exit /b 1
  call :run_bat "05-doctor.bat"
  exit /b %ERRORLEVEL%
)
echo [ERROR] Unknown profile: %P%
echo Usage: start.bat [auto^|setup^|dev^|all]
exit /b 1

:run_setup_bat_core
call :run_bat "01-install.bat"
if errorlevel 1 exit /b 1
call :run_bat "03-quality.bat"
if errorlevel 1 exit /b 1
call :run_bat "04-build.bat"
if errorlevel 1 exit /b 1
call :run_bat "05-doctor.bat"
if errorlevel 1 exit /b 1
exit /b 0

:run_setup_bat_with_repair
call :run_setup_bat_core
if not errorlevel 1 exit /b 0
echo [WARN] Setup pipeline failed. Running project auto-repair/update...
call "%ROOT_DIR%update.bat"
if errorlevel 1 exit /b 1
echo [INFO] Retry setup after update...
call :run_setup_bat_core
exit /b %ERRORLEVEL%

:start_python_secure
echo ----------------------------------------------
echo [RUN] python secure auto-start
if exist "%ROOT_DIR%python\script\03-full.bat" (
  call "%ROOT_DIR%python\script\03-full.bat"
  exit /b %ERRORLEVEL%
)
echo [ERROR] Missing python secure launcher: %ROOT_DIR%python\script\03-full.bat
exit /b 1

:run_ps
set "FILE=%~1"
echo ----------------------------------------------
echo [RUN] %FILE%
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\%FILE%"
exit /b %ERRORLEVEL%

:run_bat
set "FILE=%~1"
echo ----------------------------------------------
echo [RUN] %FILE%
call "%SCRIPT_DIR%\%FILE%"
exit /b %ERRORLEVEL%
