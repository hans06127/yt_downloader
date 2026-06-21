@echo off
chcp 65001 >nul

echo ========================================
echo   YT Downloader Build Tool
echo ========================================
echo.

cd /d "%~dp0"
echo Project dir: %~dp0

echo.
echo [1/4] Installing PyInstaller...
python -m pip install pyinstaller
if errorlevel 1 (
    echo ERROR: pip failed. Make sure Python is installed and added to PATH.
    pause
    exit /b 1
)

echo.
echo [2/4] Installing requirements...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install requirements.
    pause
    exit /b 1
)

echo.
echo [3/4] Detecting ffmpeg and deno...

REM Check bin/ folder first (git-lfs)
set FFMPEG_ARGS=
set DENO_ARGS=

if exist "%~dp0bin\ffmpeg.exe" (
    echo Found ffmpeg in bin/
    set FFMPEG_ARGS=--add-binary "%~dp0bin\ffmpeg.exe;." --add-binary "%~dp0bin\ffprobe.exe;."
) else (
    for /f "delims=" %%i in ('where ffmpeg 2^>nul') do set FFMPEG_EXE=%%i
    for /f "delims=" %%i in ('where ffprobe 2^>nul') do set FFPROBE_EXE=%%i
    if not "%FFMPEG_EXE%"=="" (
        echo Found ffmpeg in PATH: %FFMPEG_EXE%
        set FFMPEG_ARGS=--add-binary "%FFMPEG_EXE%;." --add-binary "%FFPROBE_EXE%;."
    ) else (
        echo WARNING: ffmpeg not found. Target machine must have ffmpeg in PATH.
    )
)

if exist "%~dp0bin\deno.exe" (
    echo Found deno in bin/
    set DENO_ARGS=--add-binary "%~dp0bin\deno.exe;."
) else (
    for /f "delims=" %%i in ('where deno 2^>nul') do set DENO_EXE=%%i
    if not "%DENO_EXE%"=="" (
        echo Found deno in PATH: %DENO_EXE%
        set DENO_ARGS=--add-binary "%DENO_EXE%;."
    ) else (
        echo WARNING: deno not found. Target machine must have deno in PATH.
    )
)

echo.
echo [4/4] Building...
python -m PyInstaller --noconfirm --onedir --console ^
  --add-data "templates;templates" ^
  %FFMPEG_ARGS% ^
  %DENO_ARGS% ^
  launcher.py --name YT_Downloader

if errorlevel 1 (
    echo.
    echo Build failed. Check errors above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Build Complete!
echo   Output: %~dp0dist\YT_Downloader\
echo ========================================
echo.
pause