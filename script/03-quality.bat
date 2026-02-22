@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ==============================================
echo   CLAVES :: Quality (Batch)
echo ==============================================

where npm >nul 2>nul || (echo [ERROR] npm not found & exit /b 1)

call :anim "Running lint"
call npm run lint
if errorlevel 1 exit /b 1

call :anim "Running format check"
call npm run format:check
if errorlevel 1 (
  echo [WARN] format:check reported style differences. Continuing...
)

echo [DONE] Quality checks completed.
exit /b 0

:anim
set "TXT=%~1"
set /a i=0
:loop
if %i% GEQ 6 goto :eof
set /a i+=1
<nul set /p "=[....] %TXT% ."
ping -n 2 127.0.0.1 >nul
echo.
goto :loop
