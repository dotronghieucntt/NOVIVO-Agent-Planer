@echo off
chcp 65001 >nul
title NOVIVO Agent Planer

echo.
echo  ==========================================
echo    NOVIVO Agent Planer - Khoi dong...
echo  ==========================================
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

:: ── Kill ALL python/node processes on our ports ────────────────────
echo [1/3] Don dep tien trinh cu...
taskkill /IM python.exe /F >nul 2>&1
taskkill /IM python3.exe /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8001 "') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /PID %%p /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo     OK

:: ── Start Backend ───────────────────────────────────────────────────
echo [2/3] Khoi dong Backend port 8001...
start "Backend FastAPI" /d "%BACKEND%" cmd /k "venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001"
echo     OK

:: ── Wait for backend to boot ───────────────────────────────────────
timeout /t 4 /nobreak >nul

:: ── Start Frontend ──────────────────────────────────────────────────
echo [3/3] Khoi dong Electron App...
start "Electron App" /d "%FRONTEND%" cmd /k "npm run electron:dev"
echo     OK

echo.
echo  Done! Cua so app se hien ra sau vai giay.
echo.
pause >nul
