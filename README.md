# YT Downloader

一個基於 **Flask + yt-dlp** 的 YouTube 影片下載工具，支援單一影片、播放清單（完整抓取超過 100 首）、批量匯入，並內建簡繁體中文標題轉換。暗色系 UI，可打包成 .exe 在任何 Windows 電腦使用。

---

## 第一部分：使用說明

### 功能總覽

| 功能 | 說明 |
|------|------|
| 單一網址 | 貼上 YouTube 影片連結直接下載 |
| 多個網址 | 每行一個或分號分隔，批量下載 |
| 播放清單 | 完整載入清單（突破 100 首限制），支援即時進度顯示 |
| 匯入檔案 | 支援 .txt / .xlsx 批量匯入 YouTube 網址 |
| 時長篩選 | 依總時長（分鐘）篩選，支援小數 |
| 語言篩選 | 依繁中／簡中／其他篩選 |
| 類型篩選 | 依影片類型（播放清單模式） |
| 重複偵測 | 自動標記同名影片，無法重複勾選 |
| 私人影片 | 自動標記私人／刪除影片，無法下載 |
| 標題編輯 | 可直接修改每首影片的輸出檔名 |
| 簡繁轉換 | 偵測簡體中文標題自動轉為繁體，轉換後以綠色顯示 |
| 格式選擇 | 影片（MP4/WebM/MKV/AVI/MOV）或音檔（MP3/M4A/AAC/FLAC/WAV/OGG/Opus） |
| 輸出目錄 | 預設為系統下載資料夾，可自訂 |
| 即時進度 | 雙進度條（當前檔案 + 整體），可隨時取消 |
| Cookie 管理 | 網頁介面上傳 cookies.txt，顯示狀態與上傳時間 |

### 直接下載執行檔（免安裝）

> 適合不想自己 build 的使用者

前往 [Releases](../../releases) 頁面下載最新版 `YT_Downloader.zip`，解壓後直接雙擊 `YT_Downloader.exe` 即可使用。

**執行檔使用前需要：**
1. 設定 Cookie（見下方「Cookie 設定」）
2. 確認 Deno 已安裝（若執行檔未內建）

### Cookie 設定

YouTube 需要登入 Cookie 才能正常下載，設定一次後長期有效（約 1~2 週需更新）。

**方法 A：使用 export_cookies.bat（推薦）**
1. 確認瀏覽器已登入 YouTube
2. 雙擊執行 `export_cookies.bat`
3. 選擇你的瀏覽器（支援 Chrome / Edge / Firefox / Brave / Opera）
4. 成功後自動儲存 `cookies.txt` 到專案目錄
5. 回到網站介面上傳

**方法 B：Chrome 擴充功能**
1. 安裝 [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. 開啟 YouTube 確認已登入
3. 點擴充功能圖示 → Export
4. 在網站 Header 點「上傳 cookies.txt」

### TXT 匯入格式

```
https://www.youtube.com/watch?v=xxx
https://www.youtube.com/watch?v=yyy;https://www.youtube.com/watch?v=zzz
```

每行一個網址，或用分號分隔多個。

### Excel 匯入

將 YouTube 網址放在任意欄位，程式自動掃描含 `youtube.com` 或 `youtu.be` 的儲存格。

---

## 第二部分：開發與打包

### 專案結構

```
yt_downloader/
├── app.py                  # Flask 後端（API + 下載邏輯）
├── launcher.py             # PyInstaller 打包入口
├── requirements.txt        # Python 套件需求
├── export_cookies.bat      # Cookie 快速匯出工具
├── build.bat               # 一鍵打包腳本
├── README.md               # 本文件
├── .gitignore
├── bin/                    # 打包用執行檔（git-lfs 管理）
│   ├── ffmpeg.exe
│   ├── ffprobe.exe
│   ├── deno.exe
│   └── README.md
├── templates/
│   └── index.html          # 前端 UI（單一 HTML 檔案）
└── dist/                   # 打包輸出（不進 git）
```

### 環境需求

| 工具 | 版本 | 用途 |
|------|------|------|
| Python | 3.9+ | 後端執行環境 |
| ffmpeg | 任意 | 影片/音訊轉換合併 |
| Deno | 任意 | YouTube n challenge 解碼 |

### 開發環境設定

```bash
# 1. Clone 專案
git clone <your-repo-url>
cd yt_downloader

# 2. 下載 git-lfs 大檔案（ffmpeg、deno）
git lfs pull

# 3. 安裝 Python 套件
python -m pip install -r requirements.txt

# 4. 安裝 ffmpeg（若 bin/ 沒有）
# Windows: https://www.gyan.dev/ffmpeg/builds/
# macOS: brew install ffmpeg
# Linux: sudo apt install ffmpeg

# 5. 安裝 Deno
winget install DenoLand.Deno  # Windows
# macOS/Linux: curl -fsSL https://deno.land/install.sh | sh

# 6. 啟動開發伺服器
python app.py
# 開啟瀏覽器：http://localhost:5000
```

### 一鍵打包成 .exe

```bash
# 雙擊執行，自動偵測 ffmpeg / deno 路徑
build.bat
```

打包完成後執行檔位於：
```
dist\YT_Downloader\YT_Downloader.exe
```

雙擊即可啟動，自動開啟瀏覽器，關閉視窗即停止服務。

### git-lfs 初次設定（僅需一次）

```bash
winget install GitHub.GitLFS
git lfs install
git lfs track "bin/*.exe"
git add .gitattributes
```

將以下檔案放入 `bin/`：
- `ffmpeg.exe` + `ffprobe.exe`：從 https://www.gyan.dev/ffmpeg/builds/ 下載
- `deno.exe`：安裝 Deno 後執行 `where deno` 找到路徑複製過來

### 新增 Release（含下載連結）

1. 執行 `build.bat` 產生 `dist\YT_Downloader\`
2. 將整個 `YT_Downloader` 資料夾壓縮成 `YT_Downloader.zip`
3. 在 GitHub → Releases → Draft a new release
4. 上傳 `YT_Downloader.zip`
5. 使用者即可從 Releases 頁面下載

### Python 套件清單

```
flask>=3.0.0
flask-cors>=4.0.0
yt-dlp>=2024.1.0
openpyxl>=3.1.0
opencc-python-reimplemented>=0.1.7
```

---

## 第三部分：常見問題

**Q：下載時出現「Sign in to confirm you're not a bot」**  
A：需要設定 cookies.txt。參考第一部分「Cookie 設定」，重新匯出並上傳。

**Q：Cookie 多久需要更新一次？**  
A：約 1~2 週，網站 Header 會顯示上次設定時間，過期後重新執行 `export_cookies.bat` 再上傳即可。

**Q：播放清單只載入 100 首**  
A：確認使用最新版 `app.py`。新版使用 YouTube continuation API 自動分頁，可突破 100 首限制。

**Q：下載時出現「n challenge solving failed」**  
A：確認 Deno 已安裝並加入 PATH，執行 `deno --version` 驗證。若使用打包版，確認 `deno.exe` 有放入 `bin/` 並重新打包。

**Q：下載時出現「ffprobe and ffmpeg not found」**  
A：ffmpeg 未安裝或未加入 PATH。開發版請安裝 ffmpeg；打包版確認 `bin/` 有 `ffmpeg.exe` 並重新執行 `build.bat`。

**Q：打包後 .exe 閃退**  
A：用 cmd 執行 `dist\YT_Downloader\YT_Downloader.exe` 查看錯誤訊息，最常見原因是缺少套件，在專案目錄先執行 `python -m pip install -r requirements.txt` 再重新打包。

**Q：另一台電腦執行 build.bat 失敗**  
A：確認已安裝 Python 並加入 PATH，執行 `python --version` 驗證。第一次使用需先執行 `python -m pip install -r requirements.txt`。

**Q：簡繁轉換不準確**  
A：語言判斷基於 opencc 字元轉換，標題全英文或通用漢字（如「你好」）可能被歸為「其他」。可在清單上直接手動編輯標題欄位。

**Q：取消下載後重新下載沒反應**  
A：取消後等待當前影片下載完畢再重試，或重新整理頁面（不影響已下載的檔案）。

**Q：export_cookies.bat 匯出失敗**  
A：部分瀏覽器（Chrome）執行中會鎖住 Cookie 資料庫，嘗試關閉瀏覽器後再執行，或改用 Edge / Firefox。