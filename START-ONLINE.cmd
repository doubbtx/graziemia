@echo off
cd /d "%~dp0"
node scripts\online.mjs
if errorlevel 1 pause
