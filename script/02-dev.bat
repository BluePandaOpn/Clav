@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ==============================================
echo   CLAVES :: Dev (Batch)
echo ==============================================

where npm >nul 2>nul || (echo [ERROR] npm not found & exit /b 1)
echo [STEP] Starting full dev mode (client + server).
call npm run dev
exit /b %ERRORLEVEL%
