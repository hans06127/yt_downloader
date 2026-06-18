@echo off
chcp 65001 >nul
cd /d D:\self\yt_downloader
pip install pyinstaller
pyinstaller YT_Downloader.spec --clean
echo.
echo Done! Output: dist\YT_Downloader\YT_Downloader.exe
pause