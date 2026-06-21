@echo off
chcp 65001 >nul
echo ========================================
echo   YouTube Cookie Exporter
echo ========================================
echo.
echo 請選擇你登入 YouTube 的瀏覽器：
echo.
echo  [1] Chrome
echo  [2] Edge
echo  [3] Firefox
echo  [4] Brave
echo  [5] Opera
echo.
set /p CHOICE=輸入數字 (1-5)：

if "%CHOICE%"=="1" set BROWSER=chrome
if "%CHOICE%"=="2" set BROWSER=edge
if "%CHOICE%"=="3" set BROWSER=firefox
if "%CHOICE%"=="4" set BROWSER=brave
if "%CHOICE%"=="5" set BROWSER=opera

if "%BROWSER%"=="" (
    echo 無效選擇
    pause
    exit /b 1
)

echo.
echo 正在從 %BROWSER% 匯出 YouTube cookies...
echo 如果失敗請先關閉 %BROWSER% 再重試
echo.

cd /d "%~dp0"
set COOKIE_DST=%~dp0cookies.txt

python -m yt_dlp --cookies-from-browser %BROWSER% --skip-download --quiet "https://www.youtube.com" --cookies "%COOKIE_DST%" 2>nul

if exist "%COOKIE_DST%" (
    echo [成功] cookies.txt 已儲存到專案目錄
    echo 請回到網站上傳此 cookies.txt
) else (
    echo [失敗] 無法匯出，請嘗試以下方式：
    echo 1. 關閉 %BROWSER% 後重試
    echo 2. 確認已在 %BROWSER% 登入 YouTube
)

echo.
pause