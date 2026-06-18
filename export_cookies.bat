@echo off
chcp 65001 >nul
echo ========================================
echo   YouTube Cookie Exporter
echo ========================================
echo.
echo 此工具將從 Chrome 匯出 YouTube cookies
echo 並儲存到專案目錄的 cookies.txt
echo 請確認 Chrome 已完全關閉再繼續
echo.
pause

set COOKIE_DST=D:\self\yt_downloader\cookies.txt

echo.
echo 正在嘗試從 Chrome 匯出 cookies...
echo.

yt-dlp --cookies-from-browser chrome --skip-download --quiet "https://www.youtube.com" --cookies "%COOKIE_DST%" 2>nul

if exist "%COOKIE_DST%" (
    echo [成功] cookies.txt 已儲存到:
    echo %COOKIE_DST%
    echo.
    echo 如果網站已在執行中，直接使用即可（自動載入）
    echo 如果使用 exe 版本，請在網站介面上傳此 cookies.txt
) else (
    echo [失敗] 無法自動匯出
    echo.
    echo 請改用手動方式：
    echo 1. 安裝 Chrome 擴充功能 "Get cookies.txt LOCALLY"
    echo 2. 開啟 YouTube 確認已登入
    echo 3. 點擴充功能圖示 Export
    echo 4. 到網站介面上傳匯出的 cookies.txt
)

echo.
pause