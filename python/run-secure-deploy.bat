@echo off
setlocal
cd /d "%~dp0\.."

if "%1"=="" (
  call python\script\03-full.bat
  goto :eof
)

call python\script\03-full.bat %*
