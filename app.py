import os
import json
import re
import threading
import uuid
import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import yt_dlp
import openpyxl
import opencc
from pathlib import Path

# OpenCC converter: Simplified → Traditional
_s2t = opencc.OpenCC('s2t')

def s2t_title(text):
    """
    Convert simplified Chinese to traditional Chinese if needed.
    If the text has no Chinese or is already traditional, return as-is.
    Returns (converted_title, was_converted).
    """
    if not text:
        return text, False
    chinese_chars = [c for c in text if '\u4e00' <= c <= '\u9fff']
    if not chinese_chars:
        return text, False
    converted = _s2t.convert(text)
    was_converted = converted != text
    return converted, was_converted

app = Flask(__name__)
CORS(app)

# Store download jobs
download_jobs = {}

# Cookie file path
COOKIE_FILE = Path(__file__).parent / "cookies.txt"
PRIVATE_VIDEO_MESSAGE = "私人影片無法下載"
YOUTUBE_RATE_LIMIT_MESSAGE = (
    "YouTube 暫時限制請求（HTTP 429：Too Many Requests）。"
    "請等 10-30 分鐘後再試，或更新 cookies.txt、減少連續查詢次數。"
)
ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")

def clean_error_message(error):
    """Strip terminal color codes and return a UI-friendly message."""
    message = ANSI_RE.sub("", str(error or "")).strip()
    if "HTTP Error 429" in message or "Too Many Requests" in message:
        return YOUTUBE_RATE_LIMIT_MESSAGE
    return message or "發生未知錯誤"

def is_private_video_info(info, error_message=""):
    """Best-effort detection for private YouTube videos from yt-dlp data/errors."""
    if not isinstance(info, dict):
        info = {}

    availability = str(info.get("availability") or "").lower()
    privacy = str(info.get("privacy") or "").lower()
    title = str(info.get("title") or "")
    combined = " ".join([
        title,
        str(info.get("description") or ""),
        str(info.get("message") or ""),
        str(info.get("error") or ""),
        str(error_message or ""),
    ]).lower()

    return (
        availability == "private"
        or privacy == "private"
        or "private video" in combined
        or "this video is private" in combined
        or "私人影片" in combined
    )

def private_video_payload(url, title=None, video_id=""):
    """Return a UI-friendly unavailable item for private videos."""
    raw_title = str(title or "")
    display_title = raw_title if raw_title and "private video" not in raw_title.lower() else "私人影片"
    return {
        "type": "video",
        "id": video_id,
        "title": display_title,
        "orig_title": raw_title or display_title,
        "was_converted": False,
        "url": url,
        "duration": None,
        "duration_str": "Unknown",
        "category": None,
        "uploader": "",
        "thumbnail": "",
        "lang": "other",
        "is_private": True,
        "downloadable": False,
        "unavailable_reason": PRIVATE_VIDEO_MESSAGE,
    }

def get_cookie_opt():
    """Return cookiefile path if cookies.txt exists"""
    if COOKIE_FILE.exists():
        return str(COOKIE_FILE)
    return None

def get_system_downloads_dir():
    """Get the system default Downloads directory"""
    return Path.home() / "Downloads"

def get_default_output_dir(title_hint="downloads"):
    """Create output directory inside system Downloads folder"""
    safe_name = "".join(c for c in title_hint if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name[:50] if safe_name else "downloads"
    base_dir = get_system_downloads_dir() / safe_name
    base_dir.mkdir(parents=True, exist_ok=True)
    return str(base_dir)

def get_format_string(media_type, extension):
    """Build yt-dlp format string"""
    if media_type == "audio":
        return "bestaudio/best"
    else:
        return "bestvideo+bestaudio/best"

def get_postprocessors(media_type, extension):
    """Build yt-dlp postprocessors"""
    if media_type == "audio":
        audio_format_map = {
            "mp3": "mp3",
            "m4a": "m4a",
            "aac": "aac",
            "flac": "flac",
            "wav": "wav",
            "ogg": "vorbis",
            "opus": "opus",
        }
        return [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": audio_format_map.get(extension, "mp3"),
            "preferredquality": "192",
        }]
    else:
        if extension in ["avi", "mov"]:
            return [{"key": "FFmpegVideoConvertor", "preferedformat": extension}]
        return []

def build_ydl_opts_base(extra=None):
    """Build common yt-dlp options with cookie and remote-components"""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "remote_components": "ejs:github",
        "retries": 3,
        "extractor_retries": 3,
        "fragment_retries": 3,
        "sleep_interval_requests": 1,
        "socket_timeout": 30,
    }
    cookie = get_cookie_opt()
    if cookie:
        opts["cookiefile"] = cookie
    if extra:
        opts.update(extra)
    return opts

def fetch_info(url):
    """Fetch video/playlist info without downloading"""
    ydl_opts = build_ydl_opts_base({
        "extract_flat": True,
        "skip_download": True,
    })
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info is None:
                return {"error": "無法取得影片資訊"}

            if info.get("_type") == "playlist":
                entries = info.get("entries", [])
                items = []
                for e in entries:
                    if e:
                        duration = e.get("duration")
                        orig_title = e.get("title", "Unknown")
                        url_value = e.get("url") or e.get("webpage_url") or f"https://www.youtube.com/watch?v={e.get('id','')}"
                        if is_private_video_info(e):
                            item = private_video_payload(url_value, orig_title, e.get("id", ""))
                            item["duration"] = duration
                            item["duration_str"] = format_duration(duration)
                            items.append(item)
                            continue

                        conv_title, was_conv = s2t_title(orig_title)
                        items.append({
                            "id": e.get("id", ""),
                            "title": conv_title,
                            "orig_title": orig_title,
                            "was_converted": was_conv,
                            "url": url_value,
                            "duration": duration,
                            "duration_str": format_duration(duration),
                            "category": e.get("categories", [None])[0] if e.get("categories") else None,
                            "uploader": e.get("uploader", ""),
                            "lang": "zh-CN" if was_conv else "other",
                            "downloadable": True,
                            "is_private": False,
                        })
                return {
                    "type": "playlist",
                    "title": info.get("title", "Playlist"),
                    "uploader": info.get("uploader", ""),
                    "count": len(items),
                    "items": items,
                }
            else:
                duration = info.get("duration")
                orig_title = info.get("title", "Unknown")
                if is_private_video_info(info):
                    payload = private_video_payload(url, orig_title, info.get("id", ""))
                    payload["duration"] = duration
                    payload["duration_str"] = format_duration(duration)
                    return payload

                conv_title, was_conv = s2t_title(orig_title)
                return {
                    "type": "video",
                    "title": conv_title,
                    "orig_title": orig_title,
                    "was_converted": was_conv,
                    "url": url,
                    "duration": duration,
                    "duration_str": format_duration(duration),
                    "category": info.get("categories", [None])[0] if info.get("categories") else None,
                    "uploader": info.get("uploader", ""),
                    "thumbnail": info.get("thumbnail", ""),
                    "lang": "zh-CN" if was_conv else "other",
                    "downloadable": True,
                    "is_private": False,
                }
    except Exception as e:
        message = clean_error_message(e)
        if is_private_video_info({}, message):
            return private_video_payload(url)
        return {"error": message}

def format_duration(seconds):
    if not seconds:
        return "Unknown"
    seconds = int(seconds)
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

def download_worker(job_id, items, media_type, extension, output_dir, title_hint):
    """Background download worker. items = list of {url, custom_title}"""
    job = download_jobs[job_id]
    job["status"] = "running"
    job["total"] = len(items)
    job["completed"] = 0
    job["failed"] = 0
    job["log"] = []

    if not output_dir:
        output_dir = get_default_output_dir(title_hint)
    else:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

    job["output_dir"] = output_dir

    def progress_hook(d):
        if d["status"] == "downloading":
            downloaded = d.get("downloaded_bytes", 0)
            total = d.get("total_bytes") or d.get("total_bytes_estimate", 0)
            percent = (downloaded / total * 100) if total else 0
            job["current_percent"] = round(percent, 1)
            job["current_file"] = d.get("filename", "")
        elif d["status"] == "finished":
            job["current_percent"] = 100

    fmt = get_format_string(media_type, extension)
    postprocessors = get_postprocessors(media_type, extension)

    for i, item in enumerate(items):
        if job.get("cancelled"):
            break
        url = item["url"]
        custom_title = item.get("custom_title", "").strip() or None
        job["current_index"] = i + 1
        job["current_url"] = url
        job["current_percent"] = 0

        # Use custom title if provided, else use yt-dlp default %(title)s
        if custom_title:
            # Sanitize filename
            safe = "".join(c for c in custom_title if c not in r'\/:*?"<>|').strip()
            outtmpl = os.path.join(output_dir, f"{safe}.%(ext)s")
        else:
            outtmpl = os.path.join(output_dir, "%(title)s.%(ext)s")

        ydl_opts = build_ydl_opts_base({
            "format": fmt,
            "outtmpl": outtmpl,
            "progress_hooks": [progress_hook],
            "postprocessors": postprocessors,
        })
        if media_type == "video" and extension in ["mkv", "avi", "mov"]:
            ydl_opts["merge_output_format"] = extension

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            job["completed"] += 1
            job["log"].append({"url": url, "title": custom_title or url, "status": "success"})
        except Exception as e:
            job["failed"] += 1
            job["log"].append({"url": url, "title": custom_title or url, "status": "error", "message": clean_error_message(e)})

    job["status"] = "done" if not job.get("cancelled") else "cancelled"
    job["current_percent"] = 100


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/default-dir")
def api_default_dir():
    return jsonify({"path": str(get_system_downloads_dir())})

@app.route("/api/convert-titles", methods=["POST"])
def api_convert_titles():
    """Convert simplified Chinese titles to traditional Chinese"""
    data = request.json
    titles = data.get("titles", [])
    converted = [_s2t.convert(t) if isinstance(t, str) else (t or '') for t in titles]
    return jsonify({"converted": converted})

@app.route("/api/fetch-info", methods=["POST"])
def api_fetch_info():
    data = request.json or {}
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    info = fetch_info(url)
    return jsonify(info)

@app.route("/api/parse-import", methods=["POST"])
def api_parse_import():
    """Parse uploaded txt or xlsx file for URLs"""
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    filename = f.filename.lower()
    urls = []
    if filename.endswith(".txt"):
        content = f.read().decode("utf-8", errors="ignore")
        for line in content.splitlines():
            for part in line.split(";"):
                u = part.strip()
                if u:
                    urls.append(u)
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        import io
        wb = openpyxl.load_workbook(io.BytesIO(f.read()), read_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            for cell in row:
                if cell and isinstance(cell, str) and ("youtube.com" in cell or "youtu.be" in cell):
                    urls.append(cell.strip())
    else:
        return jsonify({"error": "Unsupported file type"}), 400
    return jsonify({"urls": urls})

@app.route("/api/start-download", methods=["POST"])
def api_start_download():
    data = request.json or {}
    # Accept either old format {urls:[]} or new format {items:[{url, custom_title}]}
    raw_items = data.get("items", [])
    had_input = bool(raw_items or data.get("urls", []))
    if not raw_items:
        # fallback: old format
        raw_items = [{"url": u, "custom_title": ""} for u in data.get("urls", [])]
    normalized_items = []
    for item in raw_items:
        if isinstance(item, str):
            item = {"url": item, "custom_title": ""}
        if not isinstance(item, dict):
            continue
        if item.get("is_private") or item.get("downloadable") is False:
            continue
        if item.get("url"):
            normalized_items.append(item)
    raw_items = normalized_items

    media_type = data.get("media_type", "video")
    extension = data.get("extension", "mp4")
    output_dir = data.get("output_dir", "")
    title_hint = data.get("title_hint", "downloads")

    if not raw_items:
        return jsonify({"error": PRIVATE_VIDEO_MESSAGE if had_input else "No URLs"}), 400

    job_id = str(uuid.uuid4())
    download_jobs[job_id] = {
        "status": "queued",
        "total": len(raw_items),
        "completed": 0,
        "failed": 0,
        "current_index": 0,
        "current_url": "",
        "current_percent": 0,
        "output_dir": output_dir,
        "log": [],
        "cancelled": False,
    }

    t = threading.Thread(
        target=download_worker,
        args=(job_id, raw_items, media_type, extension, output_dir, title_hint),
        daemon=True,
    )
    t.start()
    return jsonify({"job_id": job_id})

@app.route("/api/job-status/<job_id>")
def api_job_status(job_id):
    job = download_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)

@app.route("/api/cancel-job/<job_id>", methods=["POST"])
def api_cancel_job(job_id):
    job = download_jobs.get(job_id)
    if job:
        job["cancelled"] = True
    return jsonify({"ok": True})

@app.route("/api/cookie-status")
def api_cookie_status():
    exists = COOKIE_FILE.exists()
    mtime = None
    if exists:
        mtime = datetime.datetime.fromtimestamp(COOKIE_FILE.stat().st_mtime).strftime("%Y/%m/%d %H:%M")
    return jsonify({"exists": exists, "mtime": mtime})

@app.route("/api/upload-cookie", methods=["POST"])
def api_upload_cookie():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    if not f.filename.endswith(".txt"):
        return jsonify({"error": "請上傳 .txt 檔案"}), 400
    content = f.read().decode("utf-8", errors="ignore")
    if "youtube.com" not in content and "HTTP Cookie" not in content and "# Netscape" not in content:
        return jsonify({"error": "檔案格式不正確，請確認是 YouTube cookies.txt"}), 400
    COOKIE_FILE.write_text(content, encoding="utf-8")
    return jsonify({"ok": True})

@app.route("/api/delete-cookie", methods=["POST"])
def api_delete_cookie():
    if COOKIE_FILE.exists():
        COOKIE_FILE.unlink()
    return jsonify({"ok": True})

@app.route("/api/open-folder", methods=["POST"])
def api_open_folder():
    """Open output folder in file explorer"""
    data = request.json
    folder = data.get("folder", "")
    if folder and os.path.exists(folder):
        import subprocess, sys
        if sys.platform == "win32":
            subprocess.Popen(["explorer", folder])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", folder])
        else:
            subprocess.Popen(["xdg-open", folder])
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
