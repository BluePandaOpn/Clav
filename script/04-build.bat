@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ==============================================
echo   CLAVES :: Build (Batch)
echo ==============================================

where npm >nul 2>nul || (echo [ERROR] npm not found & exit /b 1)

call :anim "Building project"
call npm run build
if errorlevel 1 exit /b 1

echo [DONE] Build completed.
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
