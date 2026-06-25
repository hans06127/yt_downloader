# React / Backend Optimization Status

更新日期：2026-06-25  
目前版本：`v0.2.0`  
開發網址：`http://localhost:3001`  
打包版網址：`http://localhost:5000`

## 1. 目前架構

- Next.js 16 Pages Router
- React 19 + TypeScript
- SCSS + styled-components
- Ant Design
- Axios + TanStack React Query
- Zustand 5（失敗下載紀錄）
- Flask + yt-dlp
- MSW 瀏覽器 mock

開發模式：

```text
Browser :3001 -> Next.js -> /api rewrite -> Flask :5000
```

打包模式：

```text
Browser :5000 -> Flask -> frontend/out + /api/*
```

## 2. 本次完成項目

### 前端 Console

瀏覽器 DevTools Console 現在會記錄：

- 查詢開始、成功與失敗
- 多網址每一筆查詢結果
- 播放清單載入進度
- 下載工作送出
- 每個項目下載中
- 每個項目下載完成
- 每個項目下載失敗，使用 `console.error`
- 工作全部完成、部分失敗或取消
- 取消單一工作與終止所有後端工作

訊息前綴：

```text
[YT Downloader]
```

### 查詢重置

每次重新查詢時，該模式會先清除：

- 舊影片資訊或影片清單
- 舊篩選條件
- 輸出類型、格式與輸出目錄
- 舊下載進度卡片

失敗下載歷史不會因重新查詢消失，必須由使用者在失敗清單中清除。

### 主題與查詢結果版面

- 整體改為深色工作台主題，包含固定側欄、頂部工具列與內容工作區。
- 桌面版查詢結果標題輸入欄約占整列 70%，影片時間固定靠右。
- 390px 手機版改為頂部模式導覽，控制項不互相重疊。
- 實測可見元素最小字體為 `12.04px`。

### 預覽與區段下載

- 單一影片與清單項目都提供預覽/試聽按鈕。
- 預覽使用 YouTube 官方嵌入播放器；影片模式顯示完整播放器，音訊模式提供精簡試聽視窗。
- 每個項目可設定最多 20 個不重疊時間區段。
- 時間支援 `SS`、`MM:SS`、`HH:MM:SS`。
- 多個區段會展開為多個下載檔案，檔名自動加入片段編號與時間。
- 後端使用 yt-dlp `download_ranges` 與 FFmpeg keyframe cut 執行擷取。

### 下載失敗重試

`ProgressCard` 會根據後端 job log 顯示失敗項目。

工作結束後若有失敗項目，會出現：

```text
再次下載失敗項目
```

重試只會重新送出失敗項目，並沿用原 job 的輸出資料夾。

失敗項目也會寫入 Zustand persist store：

```text
localStorage key: yt-downloader-failed-downloads
```

- 重新整理頁面後仍會恢復失敗紀錄。
- 可逐筆重試或移除。
- 可使用「全部重試」重新送出清單。
- 「清除清單」會同步清空 Zustand store 並移除 localStorage 紀錄。

### 字體

- 全域基準字體為 14px。
- SCSS 中最小字體已調整為約 12px。
- 已掃描確認沒有低於 12px 的自訂字級。

### 後端 Console

Flask console 現在會記錄：

- 查詢網址與查詢結果
- 播放清單查詢、總數與錯誤
- 匯入檔案解析結果
- Job queued / started
- 每個下載項目開始
- 每 10% 左右的下載進度
- 每個項目完成或失敗
- Job 完成、部分失敗或取消
- Cookie 上傳與刪除
- 子程序終止紀錄

### 可終止下載

每個 yt-dlp 項目現在執行在獨立 multiprocessing 子程序。

取消時：

- 單一工作：`POST /api/cancel-job/:jobId`
- 全部工作：`POST /api/cancel-all-jobs`
- Windows 使用 `taskkill /T /F` 終止 yt-dlp 與 ffmpeg 子行程樹。
- yt-dlp 加入 socket timeout 與 retry 限制。

前端 Header 永遠提供：

```text
終止後端工作
```

因此即使重新整理瀏覽器、前端忘記舊 job ID，仍可要求後端終止全部 active jobs。

## 3. Templates 與打包

`templates/index.html` 與 `templates/` 已移除。

Flask 現在提供：

```text
frontend/out/
```

`build.bat` 會依序：

1. 安裝 Python requirements。
2. 在 `frontend/` 執行 `npm ci`。
3. 執行 `npm run build:export`。
4. 檢查 ffmpeg / Deno。
5. 將 `frontend/out` 打入 PyInstaller。

每次 React 原始碼有變更，都必須重新執行：

```powershell
build.bat
```

舊的 `dist/` 不會自動更新。

本次完整打包已成功，輸出：

```text
dist/YT_Downloader/YT_Downloader.exe
```

打包內容已確認包含：

- React `frontend_out/index.html`
- 真正的 `ffmpeg.exe`
- `deno.exe`

`build.bat` 也會辨識只有 137 bytes 的 Git LFS 指標檔，並改用 PATH 中真正的 ffmpeg。

## 4. 一鍵啟動

啟動前後端：

```powershell
start-dev.bat
```

或：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

腳本會：

- 檢查 `5000`、`3001` 是否被占用
- 啟動 Flask console
- 啟動 Next.js console
- 等待服務 ready
- 開啟 `http://localhost:3001`

已於 2026-06-25 實際執行驗證，Flask、Next.js 與 `/api` rewrite 均成功啟動。

停止開發服務：

```powershell
stop-dev.bat
```

## 5. 版本管理

- 根目錄 `VERSION` 是版本唯一來源，目前為 `0.2.0`。
- 使用 `set-version.ps1` 同步根目錄與 frontend package metadata。
- 前端側欄顯示 `v0.2.0`。
- 後端 `GET /api/version` 回傳同一版本。
- `build.bat` 會把 `VERSION` 一起加入 PyInstaller。
- 新功能升 `MINOR`、修正升 `PATCH`、不相容變更升 `MAJOR`。

## 6. 驗證結果

已通過：

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run build:export
npm run test:smoke
npm ls --depth=0
python -m py_compile app.py launcher.py
python -m unittest discover -s tests -p test_*.py -v
build.bat
```

Browser smoke test 實際驗證：

- React 桌面與 390px 手機畫面
- MSW API 攔截
- 查詢影片成功
- 第二次查詢清除輸出設定
- 第二次查詢清除下載進度
- 下載中 console
- 下載完成 console
- 下載失敗 error console
- 失敗項目重試區
- 失敗紀錄重新整理後仍可由 Zustand/localStorage 還原
- 清除清單同步清空 store 與 localStorage
- 新版查詢結果標題欄寬度比例 `0.69`
- 預覽與下載區段按鈕
- 下載區段 modal 可正常開啟
- 後端多段展開與重疊拒絕測試
- 可見元素最小字體 `12.04px`

後端測試實際驗證：

- Flask 提供 React 靜態首頁
- cancel job 終止長時間子程序
- cancel all 標記全部 active jobs

打包版 EXE 實際驗證：

- `/` 回傳 React 首頁
- 無效下載由打包內的子程序執行
- Job 正常結束並回傳 `failed=1`
- Job log 包含完整錯誤
- 後端未因下載錯誤卡住

## 7. 套件安全狀態

`npm ls --depth=0` 乾淨，沒有 extraneous package。

`npm audit --omit=dev` 仍回報 Next.js 內部 PostCSS 的 2 個 moderate advisory。npm 建議的自動修正會錯誤地降級到 Next.js 9，因此沒有執行：

```text
npm audit fix --force
```

後續應等待 Next.js 官方相依更新，不應強制套用破壞性降級。

## 8. 尚待人工驗證

以下涉及真實 YouTube 與實際輸出，仍建議使用短影片人工測試：

1. 公開短影片完整下載。
2. 下載中按「取消下載」。
3. 下載中按 Header「終止後端工作」。
4. 一個成功、一個失敗的批次下載與重試。
5. 真實播放清單 SSE。
6. Cookie 過期、登入或受限影片。
7. MP3、MP4 與需要 ffmpeg 合併的格式。
