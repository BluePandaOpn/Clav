@echo off
setlocal
cd /d "%~dp0\..\.."
python python\script\launcher.py run %*
