# YT Downloader

YouTube 影片下載器，使用 Flask + yt-dlp 建構，暗色系 UI。

## 功能

- **單一網址** — 貼上單一 YouTube 網址下載
- **多個網址** — 輸入多個網址（每行一個或分號分隔）
- **播放清單** — 載入整個播放清單，支援選擇/篩選
- **匯入檔案** — 支援 .txt 和 .xlsx 批量匯入網址
- **時長篩選** — 依總時長（分鐘）範圍篩選，支援小數（如 60.5 分鐘）
- **類型篩選** — 依影片類型（Genre）篩選（播放清單模式）
- **重複偵測** — 自動偵測同名影片，標記為重複且無法勾選
- **格式選擇** — 影片（MP4/WebM/MKV/AVI/MOV）或音檔（MP3/M4A/AAC/FLAC/WAV/OGG/Opus）
- **資料夾選擇** — 可指定輸出路徑，或自動以影片/清單標題命名
- **即時進度** — 雙進度條（當前檔案 + 整體），成功/失敗計數
- **取消下載** — 下載中可隨時取消
- **畫面重置** — 各 Tab 可獨立重置，不需要刷新瀏覽器
- **開啟資料夾** — 下載完成後直接開啟輸出資料夾

---

## 環境需求

- Python 3.9+
- ffmpeg（需安裝並加入 PATH）
- Deno（用於解 YouTube n challenge）

---

## 安裝

### 1. 安裝 Python 套件

```bash
pip install -r requirements.txt
```

### 2. 安裝 ffmpeg（Windows）

前往 https://www.gyan.dev/ffmpeg/builds/ 下載 `ffmpeg-release-essentials.zip`

解壓後將 bin 資料夾路徑加入系統 PATH，例如：
```
C:\ffmpeg\bin
```

驗證安裝：
```cmd
ffmpeg -version
```

### 3. 安裝 Deno

```cmd
winget install DenoLand.Deno
```

驗證安裝：
```cmd
deno --version
```

---

## 啟動（開發模式）

```bash
python app.py
```

開啟瀏覽器訪問：http://localhost:5000

---

## 打包成 .exe

```cmd
pip install pyinstaller
pyinstaller --noconfirm --onedir --console --add-data "templates;templates" --add-binary "C:\ffmpeg\bin\ffmpeg.exe;." --add-binary "C:\ffmpeg\bin\ffprobe.exe;." --add-binary "C:\path\to\deno.exe;." launcher.py --name YT_Downloader
```

打包完成後執行檔位於 `dist\YT_Downloader\YT_Downloader.exe`，雙擊即可啟動。

---

## Cookie 設定

YouTube 需要登入 cookie 才能下載。

### 方法 A：使用 export_cookies.bat（推薦）

1. 確認 Chrome 已登入 YouTube
2. **完全關閉 Chrome**
3. 雙擊執行 `export_cookies.bat`
4. 成功後 cookies.txt 自動儲存到專案目錄

### 方法 B：Chrome 擴充功能手動匯出

1. 安裝 Chrome 擴充功能：**Get cookies.txt LOCALLY**
2. 開啟 YouTube 確認已登入
3. 點擴充功能圖示 → Export
4. 在網站 Header 點「上傳 cookies.txt」上傳

> ⚠️ Cookie 有效期約 1~2 週，過期需重新匯出

---

## TXT 匯入格式

```
https://www.youtube.com/watch?v=xxx
https://www.youtube.com/watch?v=yyy;https://www.youtube.com/watch?v=zzz
```

每行一個網址，或用分號分隔多個。

## Excel 匯入

將 YouTube 網址放在任意欄位，程式會自動掃描包含 `youtube.com` 或 `youtu.be` 的儲存格。

---

## 專案結構

```
yt_downloader/
├── app.py                  # Flask 後端
├── launcher.py             # PyInstaller 打包入口
├── requirements.txt        # Python 套件需求
├── export_cookies.bat      # Cookie 快速匯出工具
├── build.bat               # 一鍵打包腳本
├── README.md               # 本文件
├── cookies.txt             # YouTube cookies（執行後自動產生）
└── templates/
    └── index.html          # 前端 UI
```

---

## 常見問題

**Q: 下載時出現 "Sign in to confirm you're not a bot"**
A: 需要設定 cookies.txt，參考上方 Cookie 設定章節。

**Q: 下載時出現 "n challenge solving failed"**
A: 確認 Deno 已安裝並加入 PATH。執行 `deno --version` 驗證。

**Q: 時長篩選沒效果**
A: 需先點「查詢影片資訊」取得影片時長後再篩選（匯入模式）。

**Q: 類型篩選沒有選項**
A: YouTube 的播放清單通常不回傳 category 資訊，此功能在少數有類型標記的清單才有效。
