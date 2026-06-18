@echo off
setlocal
cd /d "%~dp0"
start "Nova Biz Server" cmd /k "node server.js"
timeout /t 2 /nobreak >nul

where chrome >nul 2>nul && (
  start "" chrome "http://localhost:8787"
  exit /b
)

where msedge >nul 2>nul && (
  start "" msedge "http://localhost:8787"
  exit /b
)

start "" "http://localhost:8787"
