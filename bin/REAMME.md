# bin/

此資料夾存放打包所需的執行檔，透過 git-lfs 管理。

## 需要的檔案

| 檔案 | 來源 |
|------|------|
| `ffmpeg.exe` | https://www.gyan.dev/ffmpeg/builds/ → ffmpeg-release-essentials.zip → bin/ |
| `ffprobe.exe` | 同上 |
| `deno.exe` | `winget install DenoLand.Deno` 後從 PATH 複製，或 https://deno.land/ |

## 初次設定 git-lfs

```cmd
winget install GitHub.GitLFS
git lfs install
git lfs track "bin/*.exe"
git add .gitattributes
```

## deno.exe 位置

安裝 Deno 後執行 `where deno` 找到路徑，複製到此資料夾。
通常在：
```
C:\Users\{使用者}\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_...\deno.exe
```