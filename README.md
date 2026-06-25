# YT Downloader

目前版本：`v0.2.0`

一個基於 **Next.js + React + Flask + yt-dlp** 的 YouTube 媒體下載工具，支援單一影片、多網址、播放清單與檔案匯入，並可預覽、編輯標題、設定多個下載區段及重試失敗項目。

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
| 媒體預覽 | 影片與音訊都可透過 YouTube 嵌入播放器預覽／試聽 |
| 區段下載 | 每支影片最多設定 20 個不重疊區段，多段輸出為多個檔案 |
| 失敗重試 | 失敗紀錄保存在瀏覽器 localStorage，可逐筆或全部重試 |

### 畫面操作

1. 從左側選擇「單一網址」、「多個網址」、「播放清單」或「匯入檔案」。
2. 輸入網址或匯入檔案後按下查詢按鈕。
3. 查詢結果可勾選、修改輸出標題，並使用列右側按鈕：
   - 播放圖示：預覽影片。
   - 音量圖示：音訊模式下試聽。
   - 剪刀圖示：設定下載區段。
4. 在「輸出設定」選擇影片／音訊、格式及輸出資料夾。
5. 按「下載此影片」或「下載已選項目」。
6. 「下載進度」可查看每筆結果、取消工作或開啟輸出資料夾。
7. 失敗項目會出現在「失敗下載紀錄」，可重試、移除或清除全部紀錄。

重新查詢會清除目前查詢結果、輸出設定及下載進度；失敗下載紀錄會保留，直到按下「清除清單」。

Header 的「終止後端工作」會要求後端停止全部執行中的下載，適合工作卡住或前端已重新整理時使用。

### 預覽與多段下載

- 預覽使用 YouTube 嵌入播放器，影片擁有者若停用嵌入則無法在 popup 播放。
- 區段時間可輸入 `SS`、`MM:SS` 或 `HH:MM:SS`。
- 結束時間必須大於開始時間，且不同區段不可重疊。
- 多個區段會輸出為不同檔案，檔名包含片段編號與時間。
- 區段擷取需要 ffmpeg；實際邊界可能受來源 keyframe 影響。

### 直接下載執行檔（免安裝）

> 適合不想自己 build 的使用者

前往 [Releases](../../releases) 頁面下載最新版 `YT_Downloader.zip`，解壓後直接雙擊 `YT_Downloader.exe` 即可使用。

公開影片不一定需要 Cookie；遇到登入、年齡、地區或機器人驗證時，再依下方方式上傳 `cookies.txt`。Deno 與 ffmpeg 建議直接內建於打包版。

### Cookie 設定

Cookie 僅在 YouTube 要求登入或額外驗證時使用。Cookie 的有效時間由 Google 帳號狀態決定，沒有固定週期；失效時重新匯出即可。

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

Header 會顯示 Cookie 是否存在及檔案更新時間，垃圾桶按鈕可刪除目前 Cookie。

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
├── start-dev.bat           # 同時啟動 Flask 與 Next.js
├── stop-dev.bat            # 停止 5000 / 3001 開發服務
├── build.bat               # 一鍵打包腳本
├── README.md               # 本文件
├── .gitignore
├── bin/                    # 打包用執行檔（git-lfs 管理）
│   ├── ffmpeg.exe
│   ├── ffprobe.exe
│   ├── deno.exe
│   └── README.md
├── frontend/               # Next.js + React + TypeScript 前端
│   └── out/                # 打包時產生的靜態 React 輸出
└── dist/                   # 打包輸出（不進 git）
```

### 環境需求

| 工具 | 版本 | 用途 |
|------|------|------|
| Python | 3.9+ | 後端執行環境 |
| Node.js | 20+ | React 前端開發與打包 |
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

# 6. 安裝前端套件
cd frontend
npm install
cd ..

# 7. 同時啟動前後端
start-dev.bat
# 開啟瀏覽器：http://localhost:3001
```

停止開發服務可執行 `stop-dev.bat`。

### 一鍵打包成 .exe

```bash
# 會先停止 3001/5000，避免 Next.js SWC 檔案被鎖住
# 接著執行 npm ci、React 靜態匯出、偵測 ffmpeg / deno，再打包
build.bat
```

打包完成後執行檔位於：
```
dist\YT_Downloader\YT_Downloader.exe
```

雙擊即可啟動，自動開啟瀏覽器，關閉視窗即停止服務。

### 版本號設計

版本唯一來源是根目錄的 [`VERSION`](VERSION)：

```text
0.2.0
```

採用 [Semantic Versioning](https://semver.org/)：

- `MAJOR`：不相容的架構或 API 變更，例如 `1.0.0 -> 2.0.0`
- `MINOR`：向下相容的新功能，例如 `0.2.0 -> 0.3.0`
- `PATCH`：向下相容的修正，例如 `0.2.0 -> 0.2.1`

發布流程：

1. 執行 `powershell -ExecutionPolicy Bypass -File .\set-version.ps1 0.2.1`。
2. 腳本會同步更新 `VERSION`、根目錄 package 與 frontend package/lock。
3. 執行測試與 `build.bat`。
4. Commit 使用 `release: vX.Y.Z` 或清楚的功能名稱。
5. 建立同名 Git tag，例如 `v0.2.0`。
6. 將 tag 對應的 ZIP 上傳 GitHub Release。

`VERSION` 是發布版本來源，`set-version.ps1` 負責同步套件 metadata。前端側欄會顯示版本；後端可透過 `GET /api/version` 取得同一版本。PyInstaller 也會將 `VERSION` 打入執行檔。

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
A：沒有固定週期。網站 Header 會顯示檔案更新時間；遇到登入或驗證錯誤時重新匯出並上傳。

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

**Q：下載卡住或取消後沒有停止**  
A：新版會將每個 yt-dlp 下載放在可終止的子程序中。可按進度區的「取消下載」，或 Header 的「終止後端工作」終止所有 active jobs。失敗項目可在進度區直接再次下載。

**Q：為什麼預覽 popup 無法播放？**  
A：預覽使用 YouTube 官方嵌入播放器。影片可能被擁有者停用嵌入、要求登入，或受地區／年齡限制。

**Q：區段下載會產生幾個檔案？**  
A：每一個區段各產生一個檔案。清除所有區段後會恢復完整下載。

**Q：頻繁下載會不會被 YouTube 限制？**  
A：可能。大量或高頻自動請求可能遇到 HTTP 429、機器人驗證、IP 或帳號限制。請只下載自己擁有、已獲授權或可合法使用的內容，避免大量平行與短時間重複請求。

**Q：React 建立後還需要 templates/index.html 嗎？**  
A：不需要。Flask 開發與打包版都改為提供 `frontend/out`。每次產生新版 EXE 都必須重新執行 `build.bat`，腳本會先從目前 React 原始碼重新產生靜態輸出，再重新打包。

**Q：export_cookies.bat 匯出失敗**  
A：部分瀏覽器（Chrome）執行中會鎖住 Cookie 資料庫，嘗試關閉瀏覽器後再執行，或改用 Edge / Firefox。
