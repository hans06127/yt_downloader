# YT Downloader Frontend

目前版本：`v0.2.0`

Next.js 16 Pages Router + React 19 + TypeScript 前端。UI 使用 Ant Design、SCSS 與 styled-components，資料查詢使用 Axios / TanStack Query，失敗下載紀錄使用 Zustand persist。

## 開發

請優先從專案根目錄啟動：

```powershell
start-dev.bat
```

服務：

- 前端：`http://localhost:3001`
- 後端：`http://localhost:5000`
- 開發模式 `/api/*` 由 Next.js rewrite 到 Flask。

只啟動前端：

```powershell
npm run dev:3001
```

## 畫面結構

- 左側／手機頂部：單一網址、多個網址、播放清單、匯入檔案。
- Header：終止後端工作、Cookie 狀態、上傳與刪除 Cookie。
- 查詢結果：勾選、編輯標題、預覽／試聽、設定多段下載。
- 輸出設定：媒體類型、格式、輸出資料夾。
- 下載進度：取消、開啟資料夾、失敗項目重試。
- 失敗紀錄：Zustand + localStorage 持久化，可移除或清除。

## Mock

`frontend/.env.local`：

```env
NEXT_PUBLIC_USE_MOCK=false
```

瀏覽器 smoke test 會自行以 mock 模式啟動，不需要修改 `.env.local`。

## 驗證

```powershell
npm run lint
.\node_modules\.bin\tsc.cmd --noEmit
npm run test:smoke
npm run build:export
```

`build:export` 會將靜態檔案輸出到 `frontend/out`，供 Flask 與 PyInstaller 使用。

## 版本

根目錄 `VERSION` 是版本唯一來源。Next.js 會在建置時讀取並注入 `NEXT_PUBLIC_APP_VERSION`，顯示於側欄底部。
