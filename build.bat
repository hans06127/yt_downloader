@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

echo ========================================
echo   YT Downloader Build Tool
echo ========================================
echo.

cd /d "%~dp0"
echo Project dir: %~dp0

echo.
echo [1/5] Installing PyInstaller...
python -m pip install pyinstaller
if errorlevel 1 (
    echo ERROR: pip failed. Make sure Python is installed and added to PATH.
    if not defined NO_PAUSE pause
    exit /b 1
)

echo.
echo [2/5] Installing requirements...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install requirements.
    if not defined NO_PAUSE pause
    exit /b 1
)

echo.
echo [3/5] Installing and exporting React frontend...

echo Stopping development services to release Next.js SWC files...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1"
if errorlevel 1 goto :stop_services_failed

pushd "%~dp0frontend"
call npm ci --no-audit --no-fund
if errorlevel 1 goto :frontend_install_failed

if exist "%~dp0frontend\out" (
    echo Removing old frontend export...
    rmdir /s /q "%~dp0frontend\out"
)

call npm run build:export
if errorlevel 1 goto :frontend_export_failed
popd

echo.
echo [4/5] Detecting ffmpeg and deno...

REM Check bin/ folder first (git-lfs)
set FFMPEG_ARGS=
set DENO_ARGS=

if exist "%~dp0bin\ffmpeg.exe" (
    for %%F in ("%~dp0bin\ffmpeg.exe") do (
        if %%~zF GTR 1000000 (
            echo Found ffmpeg in bin/
            set FFMPEG_ARGS=--add-binary "%~dp0bin\ffmpeg.exe;." --add-binary "%~dp0bin\ffprobe.exe;."
        ) else (
            echo WARNING: bin/ffmpeg.exe is a Git LFS pointer, falling back to PATH.
        )
    )
)

if not defined FFMPEG_ARGS (
    for /f "delims=" %%i in ('where ffmpeg 2^>nul') do set FFMPEG_EXE=%%i
    for /f "delims=" %%i in ('where ffprobe 2^>nul') do set FFPROBE_EXE=%%i
    if not "!FFMPEG_EXE!"=="" (
        echo Found ffmpeg in PATH: !FFMPEG_EXE!
        set FFMPEG_ARGS=--add-binary "!FFMPEG_EXE!;." --add-binary "!FFPROBE_EXE!;."
    ) else (
        echo WARNING: ffmpeg not found. Target machine must have ffmpeg in PATH.
    )
)

if exist "%~dp0bin\deno.exe" (
    echo Found deno in bin/
    set DENO_ARGS=--add-binary "%~dp0bin\deno.exe;."
) else (
    for /f "delims=" %%i in ('where deno 2^>nul') do set DENO_EXE=%%i
    if not "!DENO_EXE!"=="" (
        echo Found deno in PATH: !DENO_EXE!
        set DENO_ARGS=--add-binary "!DENO_EXE!;."
    ) else (
        echo WARNING: deno not found. Target machine must have deno in PATH.
    )
)

echo.
echo [5/5] Building...

if exist "%~dp0dist\YT_Downloader" (
    echo Removing old packaged app...
    rmdir /s /q "%~dp0dist\YT_Downloader"
)

if exist "%~dp0build\YT_Downloader" (
    echo Removing old PyInstaller work folder...
    rmdir /s /q "%~dp0build\YT_Downloader"
)

python -m PyInstaller --noconfirm --onedir --console --specpath build ^
  --add-data "%~dp0frontend\out;frontend_out" ^
  --add-data "%~dp0VERSION;." ^
  %FFMPEG_ARGS% ^
  %DENO_ARGS% ^
  launcher.py --name YT_Downloader

if errorlevel 1 (
    echo.
    echo Build failed. Check errors above.
    if not defined NO_PAUSE pause
    exit /b 1
)

echo.
echo ========================================
echo   Build Complete!
echo   Output: %~dp0dist\YT_Downloader\
echo ========================================
echo.
if not defined NO_PAUSE pause
exit /b 0

:stop_services_failed
echo ERROR: Failed to stop development services on ports 3001/5000.
if not defined NO_PAUSE pause
exit /b 1

:frontend_install_failed
echo ERROR: Failed to install frontend dependencies.
echo Close any Node.js process, editor terminal, or antivirus scan using frontend\node_modules and retry.
popd
if not defined NO_PAUSE pause
exit /b 1

:frontend_export_failed
echo ERROR: Failed to export frontend.
popd
if not defined NO_PAUSE pause
exit /b 1
