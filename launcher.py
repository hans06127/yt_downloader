import sys
import os
import multiprocessing
import threading
import webbrowser
from pathlib import Path

# Fix paths for PyInstaller bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
    EXE_DIR = Path(sys.executable).parent
    # Add bundled ffmpeg and deno to PATH
    os.environ["PATH"] = str(BASE_DIR) + os.pathsep + os.environ.get("PATH", "")
else:
    BASE_DIR = Path(__file__).parent
    EXE_DIR = BASE_DIR

os.chdir(BASE_DIR)

import app as flask_app

flask_app.COOKIE_FILE = EXE_DIR / "cookies.txt"
flask_app.FRONTEND_DIST = BASE_DIR / "frontend_out"
flask_app.VERSION_FILE = BASE_DIR / "VERSION"
flask_app.APP_VERSION = flask_app.read_app_version()

def open_browser():
    import time
    time.sleep(1.5)
    webbrowser.open("http://localhost:5000")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    print("=" * 40)
    print("  YT Downloader 啟動中...")
    print(f"  版本: v{flask_app.APP_VERSION}")
    print("  開啟瀏覽器: http://localhost:5000")
    print("  關閉此視窗即停止服務")
    print("=" * 40)

    if os.environ.get("YT_DOWNLOADER_NO_BROWSER") != "1":
        t = threading.Thread(target=open_browser, daemon=True)
        t.start()

    flask_app.app.run(debug=False, port=5000)
