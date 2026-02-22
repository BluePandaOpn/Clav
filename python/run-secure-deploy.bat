@echo off
setlocal
cd /d "%~dp0\.."

python python\bootstrap_venv.py
if errorlevel 1 (
  echo [python-venv][error] No se pudo preparar .venv
  exit /b 1
)

set "VENV_PY=python\.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
  echo [python-venv][error] No existe %VENV_PY%
  exit /b 1
)

if "%1"=="" (
  "%VENV_PY%" python\deploy_secure.py full --with-api --api-https --enable-http-redirect --watch
  goto :eof
)

"%VENV_PY%" python\deploy_secure.py %*
