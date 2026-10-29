@echo off
setlocal
title Decision Engine - Offline Research Workbench
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_FULL_SANDBOX.ps1"
if errorlevel 1 (
  echo.
  echo Sandbox failed to start. Please read README.md for troubleshooting.
  pause
)

