@echo off
chcp 65001 >nul
title NOVIVO Agent Planer - Build Release

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: ── Đọc version từ version.json ─────────────────────────────────────────
for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" version.json') do (
    set "VERSION=%%~a"
    set "VERSION=!VERSION:"=!"
    goto :got_version
)
:: Fallback nếu không đọc được
set VERSION=1.0.0
:got_version
:: Xóa dấu ngoặc kép còn sót
set VERSION=%VERSION:"=%

echo.
echo  ==============================================
echo    NOVIVO Agent Planer - Build Release v%VERSION%
echo  ==============================================
echo.

:: ── 1. Build Python backend với PyInstaller ──────────────────────────────
echo [1/4] Dang build Python backend (PyInstaller)...
cd /d "%ROOT%backend"

if not exist "venv\Scripts\pyinstaller.exe" (
    echo     Cai dat PyInstaller...
    venv\Scripts\pip.exe install pyinstaller --quiet
)

if not exist "novivo_backend.spec" (
    echo     ERROR: Khong tim thay novivo_backend.spec
    pause & exit /b 1
)

venv\Scripts\pyinstaller.exe novivo_backend.spec ^
    --distpath "%ROOT%dist-backend" ^
    --workpath "%ROOT%build-tmp\backend" ^
    --noconfirm ^
    --clean

if %ERRORLEVEL% NEQ 0 (
    echo     ERROR: Backend build that bai!
    pause & exit /b 1
)
echo     [OK] Backend built → dist-backend\novivo_backend\

:: ── 2. Build Electron frontend ───────────────────────────────────────────
echo.
echo [2/4] Dang build Electron app...
cd /d "%ROOT%frontend"

call npm install --silent
call npm run electron:build

if %ERRORLEVEL% NEQ 0 (
    echo     ERROR: Electron build that bai!
    pause & exit /b 1
)
echo     [OK] Electron built → frontend\dist-electron\

:: ── 3. Tạo bản Full ZIP ──────────────────────────────────────────────────
echo.
echo [3/4] Dang tao Full ZIP...
cd /d "%ROOT%"

set "DIST_DIR=%ROOT%dist"
set "FULL_NAME=NOVIVO-Agent-Planer-Full-v%VERSION%"
set "ZIP_STAGE=%DIST_DIR%\%FULL_NAME%"

if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"
if exist "%ZIP_STAGE%" rd /s /q "%ZIP_STAGE%"
mkdir "%ZIP_STAGE%"
mkdir "%ZIP_STAGE%\backend"
mkdir "%ZIP_STAGE%\app"

:: Copy PyInstaller backend
if exist "%ROOT%dist-backend\novivo_backend" (
    xcopy /e /i /q "%ROOT%dist-backend\novivo_backend" "%ZIP_STAGE%\backend\novivo_backend\"
    :: Copy .env.example vào cạnh exe để user biết phải điền gì
    copy "%ROOT%backend\.env.example" "%ZIP_STAGE%\backend\novivo_backend\.env.example" >nul 2>&1
) else (
    echo     WARN: Khong tim thay dist-backend\novivo_backend, bo qua.
)

:: Copy Electron portable (win-unpacked)
if exist "%ROOT%frontend\dist-electron\win-unpacked" (
    xcopy /e /i /q "%ROOT%frontend\dist-electron\win-unpacked" "%ZIP_STAGE%\app\"
) else (
    echo     WARN: Khong tim thay win-unpacked, bo qua.
)

:: Thêm launcher và README
copy "%ROOT%run.bat" "%ZIP_STAGE%\" >nul 2>&1
copy "%ROOT%README.md" "%ZIP_STAGE%\" >nul 2>&1
copy "%ROOT%version.json" "%ZIP_STAGE%\" >nul 2>&1

:: Nén thành ZIP
if exist "%DIST_DIR%\%FULL_NAME%.zip" del "%DIST_DIR%\%FULL_NAME%.zip"
powershell -NoProfile -Command ^
    "Compress-Archive -Path '%ZIP_STAGE%\*' -DestinationPath '%DIST_DIR%\%FULL_NAME%.zip' -Force"

if %ERRORLEVEL% EQU 0 (
    echo     [OK] Full ZIP: dist\%FULL_NAME%.zip
) else (
    echo     WARN: Khong tao duoc ZIP.
)

:: ── 4. Upload lên GitHub ─────────────────────────────────────────────────
echo.
echo [4/4] Upload release len GitHub...
cd /d "%ROOT%"

"%ROOT%backend\venv\Scripts\python.exe" "%ROOT%scripts\upload_release.py"

echo.
echo  ==============================================
echo    Build xong!
echo    - Installer : frontend\dist-electron\
echo    - Full ZIP  : dist\%FULL_NAME%.zip
echo    - GitHub    : https://github.com/dotronghieucntt/NOVIVO-Agent-Planer/releases
echo  ==============================================
echo.
pause
