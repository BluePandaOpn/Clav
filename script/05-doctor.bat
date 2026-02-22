@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ==============================================
echo   CLAVES :: Doctor (Batch)
echo ==============================================

where node >nul 2>nul || (echo [ERROR] node not found & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm not found & exit /b 1)
where git >nul 2>nul || (echo [ERROR] git not found & exit /b 1)

call :anim "Checking toolchain"
echo [INFO] node version:
node -v
echo [INFO] npm version:
npm -v
echo [INFO] git status:
git status --short
echo [DONE] Doctor checks completed.
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
