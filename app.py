import os
import json
import re
import threading
import uuid
import datetime
import logging
import multiprocessing
import queue
import time
import http.cookiejar
import urllib.parse
import urllib.request
import shutil
import subprocess
import tempfile
import math
from flask import Flask, request, jsonify, send_from_directory
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("yt_downloader")

APP_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = APP_DIR / "frontend" / "out"
VERSION_FILE = APP_DIR / "VERSION"


def read_app_version():
    try:
        return VERSION_FILE.read_text(encoding="utf-8").strip() or "dev"
    except OSError:
        return "dev"


APP_VERSION = read_app_version()

app = Flask(__name__, static_folder=None)
CORS(app)

# Store download jobs
download_jobs = {}
download_runtimes = {}
download_jobs_lock = threading.RLock()

# Cookie file path
COOKIE_FILE = APP_DIR / "cookies.txt"

class YtdlpErrorCollector:
    """Collect yt-dlp errors that are swallowed when ignoreerrors=True."""

    def __init__(self):
        self.errors = []

    def debug(self, message):
        return None

    def warning(self, message):
        logger.warning("[yt-dlp] %s", message)

    def error(self, message):
        self.errors.append(str(message))
        logger.error("[yt-dlp] %s", message)

    def message(self):
        return self.errors[-1] if self.errors else ""

def get_cookie_opt():
    """Return cookiefile path if cookies.txt exists"""
    if COOKIE_FILE.exists():
        return str(COOKIE_FILE)
    return None

def inspect_cookie_file():
    """Return local validity details for cookies.txt without contacting YouTube."""
    if not COOKIE_FILE.exists():
        return {
            "exists": False,
            "mtime": None,
            "valid": None,
            "message": "尚未上傳 cookies.txt",
        }

    mtime = datetime.datetime.fromtimestamp(COOKIE_FILE.stat().st_mtime).strftime("%Y/%m/%d %H:%M")
    jar = http.cookiejar.MozillaCookieJar()
    try:
        jar.load(str(COOKIE_FILE), ignore_discard=True, ignore_expires=True)
    except Exception as exc:
        logger.warning("[cookie] Failed to parse cookie file: %s", exc)
        return {
            "exists": True,
            "mtime": mtime,
            "valid": False,
            "message": "cookies.txt 格式無法讀取，請重新匯出 YouTube cookies。",
        }

    youtube_cookies = [
        cookie for cookie in jar
        if "youtube.com" in cookie.domain or "google.com" in cookie.domain
    ]
    if not youtube_cookies:
        return {
            "exists": True,
            "mtime": mtime,
            "valid": False,
            "message": "cookies.txt 中沒有 YouTube/Google cookie，請登入後重新匯出 cookies。",
        }

    now = time.time()
    unexpired = [
        cookie for cookie in youtube_cookies
        if cookie.expires is None or cookie.expires > now
    ]
    if not unexpired:
        return {
            "exists": True,
            "mtime": mtime,
            "valid": False,
            "message": "cookies.txt 內的 YouTube cookie 已過期，請重新匯出並上傳。",
        }

    auth_cookie_names = {
        "SID", "HSID", "SSID", "APISID", "SAPISID", "LOGIN_INFO",
        "__Secure-1PSID", "__Secure-3PSID", "__Secure-1PAPISID", "__Secure-3PAPISID",
    }
    has_auth_cookie = any(cookie.name in auth_cookie_names for cookie in unexpired)
    if not has_auth_cookie:
        return {
            "exists": True,
            "mtime": mtime,
            "valid": False,
            "message": "cookies.txt 看起來不是登入狀態的 YouTube cookie，請用已登入帳號重新匯出。",
        }

    return {
        "exists": True,
        "mtime": mtime,
        "valid": True,
        "message": "Cookie 可讀取且尚未過期。",
    }

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
        "socket_timeout": 20,
        "retries": 3,
        "fragment_retries": 3,
        "extractor_retries": 3,
        "file_access_retries": 3,
    }
    cookie = get_cookie_opt()
    if cookie:
        opts["cookiefile"] = cookie
    if extra:
        opts.update(extra)
    return opts

def format_playlist_item(e):
    """Convert a yt-dlp or YouTube continuation entry to the frontend item shape."""
    vid_id = e.get("id") or e.get("videoId") or ""
    orig_title = e.get("title") or ""
    is_private = (
        e.get("availability") in ("private", "needs_auth") or
        orig_title in ("[Private video]", "[Deleted video]", "") or
        e.get("is_private") or
        not vid_id
    )
    conv_title, was_conv = s2t_title(orig_title) if not is_private else (orig_title, False)
    duration = e.get("duration")
    raw_url = e.get("url") or e.get("webpage_url") or ""
    item_url = raw_url if str(raw_url).startswith("http") else f"https://www.youtube.com/watch?v={vid_id}"
    return {
        "id": vid_id,
        "title": conv_title if not is_private else "私人影片",
        "orig_title": orig_title,
        "was_converted": was_conv,
        "url": item_url,
        "duration": duration,
        "duration_str": e.get("duration_str") or format_duration(duration),
        "category": e.get("categories", [None])[0] if e.get("categories") else e.get("category"),
        "uploader": e.get("uploader", ""),
        "lang": "zh-CN" if was_conv else "other",
        "is_private": is_private,
    }

def _extract_json_after(text, marker):
    """Extract a balanced JSON object after a marker in YouTube HTML."""
    pos = text.find(marker)
    if pos < 0:
        return None
    start = text.find("{", pos + len(marker))
    if start < 0:
        return None

    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError:
                    return None
    return None

def _text_from_runs(obj):
    if not obj:
        return ""
    if isinstance(obj, str):
        return obj
    if obj.get("simpleText"):
        return obj["simpleText"]
    return "".join(run.get("text", "") for run in obj.get("runs", []))

def _iter_renderer_values(obj, key):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == key:
                yield v
            else:
                yield from _iter_renderer_values(v, key)
    elif isinstance(obj, list):
        for item in obj:
            yield from _iter_renderer_values(item, key)

def _entry_from_playlist_renderer(renderer):
    video_id = renderer.get("videoId") or renderer.get("navigationEndpoint", {}).get("watchEndpoint", {}).get("videoId", "")
    title = _text_from_runs(renderer.get("title"))
    length_text = _text_from_runs(renderer.get("lengthText"))
    duration = renderer.get("lengthSeconds")
    try:
        duration = int(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration = None
    uploader = _text_from_runs(renderer.get("shortBylineText")) or _text_from_runs(renderer.get("longBylineText"))
    is_private = not video_id or "private" in title.lower() or "deleted" in title.lower()
    return {
        "id": video_id,
        "title": title,
        "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
        "duration": duration,
        "duration_str": length_text or format_duration(duration),
        "uploader": uploader,
        "is_private": is_private,
    }

def _duration_seconds_from_text(text):
    if not text or ":" not in text:
        return None
    parts = text.split(":")
    if not all(part.isdigit() for part in parts):
        return None
    total = 0
    for part in parts:
        total = total * 60 + int(part)
    return total

def _entry_from_lockup_view_model(view_model):
    video_id = view_model.get("contentId") or ""
    if not video_id:
        for endpoint in _iter_renderer_values(view_model, "watchEndpoint"):
            video_id = endpoint.get("videoId", "")
            if video_id:
                break

    metadata = view_model.get("metadata", {}).get("lockupMetadataViewModel", {})
    title = metadata.get("title", {}).get("content", "")
    duration_str = ""
    for badge in _iter_renderer_values(view_model, "thumbnailBadgeViewModel"):
        text = badge.get("text")
        if isinstance(text, str) and ":" in text:
            duration_str = text
            break

    uploader = ""
    content_meta = metadata.get("metadata", {}).get("contentMetadataViewModel", {})
    for row in content_meta.get("metadataRows", []):
        for part in row.get("metadataParts", []):
            text = part.get("text", {}).get("content")
            if text:
                uploader = text
                break
        if uploader:
            break

    duration = _duration_seconds_from_text(duration_str)
    is_private = not video_id or "private" in title.lower() or "deleted" in title.lower()
    return {
        "id": video_id,
        "title": title,
        "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
        "duration": duration,
        "duration_str": duration_str or format_duration(duration),
        "uploader": uploader,
        "is_private": is_private,
    }

def _find_continuation_token(data):
    for command in _iter_renderer_values(data, "continuationCommand"):
        if not isinstance(command, dict):
            continue
        token = command.get("token")
        if token:
            return token
        token = command.get("innertubeCommand", {}).get("continuationCommand", {}).get("token")
        if token:
            return token
    return None

def _extract_declared_playlist_count(data):
    count_re = re.compile(r"([\d,]+)\s*(?:部影片|videos?)", re.IGNORECASE)
    for text_obj in _iter_renderer_values(data, "text"):
        content = ""
        if isinstance(text_obj, dict):
            content = text_obj.get("content") or text_obj.get("simpleText") or _text_from_runs(text_obj)
        elif isinstance(text_obj, str):
            content = text_obj
        match = count_re.search(content or "")
        if match:
            return int(match.group(1).replace(",", ""))
    return None

def _playlist_contents_from_response(data):
    for renderer in _iter_renderer_values(data, "playlistVideoListRenderer"):
        return renderer.get("contents", [])
    for action in data.get("onResponseReceivedActions", []) if isinstance(data, dict) else []:
        items = action.get("appendContinuationItemsAction", {}).get("continuationItems")
        if items:
            return items
    for action in data.get("onResponseReceivedEndpoints", []) if isinstance(data, dict) else []:
        items = action.get("appendContinuationItemsAction", {}).get("continuationItems")
        if items:
            return items
    return []

def _parse_playlist_contents(contents):
    entries = []
    continuation = None
    for content in contents:
        renderer = content.get("playlistVideoRenderer") or content.get("playlistPanelVideoRenderer")
        if renderer:
            entries.append(_entry_from_playlist_renderer(renderer))
            continue
        cont_renderer = content.get("continuationItemRenderer")
        if cont_renderer:
            continuation = (
                cont_renderer.get("continuationEndpoint", {})
                .get("continuationCommand", {})
                .get("token")
            )
    return entries, continuation

def fetch_youtube_playlist_continuation_entries(url, limit=9999):
    """Best-effort YouTube playlist page walker for entries beyond yt-dlp's first 100."""
    parsed = urllib.parse.urlparse(url)
    playlist_id = urllib.parse.parse_qs(parsed.query).get("list", [""])[0]
    if not playlist_id:
        return [], None

    jar = http.cookiejar.MozillaCookieJar()
    handlers = []
    if COOKIE_FILE.exists():
        try:
            jar.load(str(COOKIE_FILE), ignore_discard=True, ignore_expires=True)
            handlers.append(urllib.request.HTTPCookieProcessor(jar))
        except Exception:
            pass
    opener = urllib.request.build_opener(*handlers)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    }

    playlist_url = f"https://www.youtube.com/playlist?list={urllib.parse.quote(playlist_id)}"
    req = urllib.request.Request(playlist_url, headers=headers)
    with opener.open(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    initial_data = _extract_json_after(html, "ytInitialData =") or _extract_json_after(html, "var ytInitialData =")
    ytcfg = _extract_json_after(html, "ytcfg.set(") or {}
    if not initial_data:
        return [], None

    contents = _playlist_contents_from_response(initial_data)
    entries, continuation = _parse_playlist_contents(contents)
    if not entries:
        entries = [_entry_from_lockup_view_model(vm) for vm in _iter_renderer_values(initial_data, "lockupViewModel")]
        entries = [entry for entry in entries if entry.get("id") or entry.get("title")]
        continuation = _find_continuation_token(initial_data)
    declared_count = _extract_declared_playlist_count(initial_data)
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    api_key = ytcfg.get("INNERTUBE_API_KEY") or (api_key_match.group(1) if api_key_match else "")
    if not api_key:
        return entries[:limit], ""
    client_version = ytcfg.get("INNERTUBE_CLIENT_VERSION") or "2.20240620.01.00"

    while continuation and len(entries) < limit:
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": client_version,
                    "hl": "zh-TW",
                    "gl": "TW",
                }
            },
            "continuation": continuation,
        }
        body = json.dumps(payload).encode("utf-8")
        endpoint = f"https://www.youtube.com/youtubei/v1/browse?key={urllib.parse.quote(api_key)}"
        req = urllib.request.Request(endpoint, data=body, headers={
            **headers,
            "Content-Type": "application/json",
            "Origin": "https://www.youtube.com",
            "Referer": playlist_url,
            "X-YouTube-Client-Name": "1",
            "X-YouTube-Client-Version": client_version,
        })
        with opener.open(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        page_entries, continuation = _parse_playlist_contents(_playlist_contents_from_response(data))
        if not page_entries:
            page_entries = [_entry_from_lockup_view_model(vm) for vm in _iter_renderer_values(data, "lockupViewModel")]
            page_entries = [entry for entry in page_entries if entry.get("id") or entry.get("title")]
        continuation = continuation or _find_continuation_token(data)
        if not page_entries:
            break
        entries.extend(page_entries)

    title = ""
    for header in _iter_renderer_values(initial_data, "playlistHeaderRenderer"):
        title = _text_from_runs(header.get("title"))
        break
    if not title:
        for header in _iter_renderer_values(initial_data, "pageHeaderRenderer"):
            title = header.get("pageTitle") or ""
            if title:
                break
    unique_entries = []
    seen_ids = set()
    for entry in entries:
        key = entry.get("id") or entry.get("url") or entry.get("title")
        if key in seen_ids:
            continue
        seen_ids.add(key)
        unique_entries.append(entry)
    if declared_count and declared_count > len(unique_entries):
        missing = declared_count - len(unique_entries)
        for i in range(missing):
            unique_entries.append({
                "id": "",
                "title": f"不可用影片 {i + 1}",
                "url": "",
                "duration": None,
                "duration_str": "Unknown",
                "uploader": "",
                "is_private": True,
            })
    return unique_entries[:limit], title

def complete_playlist_entries(url, ydl_entries):
    """Use YouTube continuation pages when yt-dlp only returns the first page."""
    try:
        continuation_entries, continuation_title = fetch_youtube_playlist_continuation_entries(url)
    except Exception as ex:
        return ydl_entries, "", f"continuation failed: {ex}"

    if len(continuation_entries) <= len(ydl_entries):
        return ydl_entries, continuation_title, ""

    by_id = {e.get("id"): e for e in ydl_entries if e and e.get("id")}
    merged = []
    seen_ids = set()
    for entry in continuation_entries:
        ydl_entry = by_id.get(entry.get("id"))
        merged_entry = {**entry, **ydl_entry} if ydl_entry else entry
        merged.append(merged_entry)
        if merged_entry.get("id"):
            seen_ids.add(merged_entry["id"])
    for entry in ydl_entries:
        entry_id = entry.get("id")
        if entry_id and entry_id not in seen_ids:
            merged.append(entry)
            seen_ids.add(entry_id)
    return merged, continuation_title, ""

def fetch_info(url):
    """Fetch video/playlist info without downloading"""
    error_collector = YtdlpErrorCollector()
    ydl_opts = build_ydl_opts_base({
        "extract_flat": "in_playlist",
        "skip_download": True,
        "lazy_playlist": False,       # Force fetch all pages
        "ignoreerrors": True,         # Skip unavailable videos
        "logger": error_collector,
    })
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info is None:
                return {"error": normalize_query_error(error_collector.message() or "No video info returned")}

            if info.get("_type") == "playlist":
                entries = [e for e in (info.get("entries", []) or []) if e]
                entries, continuation_title, _ = complete_playlist_entries(url, entries)
                items = [format_playlist_item(e) for e in entries]
                return {
                    "type": "playlist",
                    "title": info.get("title") or continuation_title or "Playlist",
                    "uploader": info.get("uploader", ""),
                    "count": len(items),
                    "items": items,
                }
                entries = info.get("entries", [])
                items = []
                for e in entries:
                    if e:
                        duration = e.get("duration")
                        orig_title = e.get("title") or ""
                        # Detect private video
                        is_private = (
                            e.get("availability") in ("private", "needs_auth") or
                            orig_title in ("[Private video]", "[Deleted video]", "") or
                            e.get("id") is None
                        )
                        conv_title, was_conv = s2t_title(orig_title) if not is_private else (orig_title, False)
                        items.append({
                            "id": e.get("id", ""),
                            "title": conv_title if not is_private else "🔒 私人影片",
                            "orig_title": orig_title,
                            "was_converted": was_conv,
                            "url": e.get("url") or e.get("webpage_url") or f"https://www.youtube.com/watch?v={e.get('id','')}",
                            "duration": duration,
                            "duration_str": format_duration(duration),
                            "category": e.get("categories", [None])[0] if e.get("categories") else None,
                            "uploader": e.get("uploader", ""),
                            "lang": "zh-CN" if was_conv else "other",
                            "is_private": is_private,
                        })
                return {
                    "type": "playlist",
                    "title": info.get("title", "Playlist"),
                    "uploader": info.get("uploader", ""),
                    "count": len(items),
                    "items": items,
                }
            else:
                return format_video_info(info, url)
    except Exception as e:
        fallback = fetch_flat_video_info(url, e)
        if fallback:
            return fallback
        return {"error": normalize_query_error(str(e))}

def normalize_query_error(message):
    text = str(message or "No video info returned").strip()
    if text.startswith("ERROR: "):
        text = text[7:].strip()
    if "known to use DRM protection" in text or "[DRM]" in text:
        return (
            "此影片或網站使用 DRM 保護，yt-dlp 不支援下載 DRM 內容。"
            f"原始訊息：{text}"
        )
    if "Sign in to confirm" in text and "not a bot" in text:
        if get_cookie_opt():
            return (
                "YouTube 要求登入或機器人驗證，目前 cookies.txt 可能已過期或不是 YouTube 登入狀態。"
                f"請重新匯出並上傳有效的 YouTube cookies.txt。原始訊息：{text}"
            )
        return (
            "YouTube 要求登入或機器人驗證，請先上傳有效的 YouTube cookies.txt 後再試。"
            f"原始訊息：{text}"
        )
    return text

def format_video_info(info, url):
    duration = info.get("duration")
    orig_title = info.get("title", "Unknown")
    conv_title, was_conv = s2t_title(orig_title)
    return {
        "type": "video",
        "title": conv_title,
        "orig_title": orig_title,
        "was_converted": was_conv,
        "url": info.get("webpage_url") or info.get("original_url") or url,
        "duration": duration,
        "duration_str": format_duration(duration),
        "category": info.get("categories", [None])[0] if info.get("categories") else None,
        "uploader": info.get("uploader", ""),
        "thumbnail": info.get("thumbnail", ""),
        "lang": "zh-CN" if was_conv else "other",
    }

def fetch_flat_video_info(url, original_error):
    """Fall back to flat metadata when full extraction fails on format selection."""
    if "Requested format is not available" not in str(original_error):
        return None

    logger.warning("[query] Full extraction failed on format selection, retrying flat metadata: %s", url)
    ydl_opts = build_ydl_opts_base({
        "extract_flat": True,
        "skip_download": True,
        "ignoreerrors": False,
    })
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not info or info.get("_type") == "playlist":
            return None
        return format_video_info(info, url)
    except Exception as fallback_error:
        logger.warning("[query] Flat metadata fallback failed: %s - %s", url, fallback_error)
        return None

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

def safe_filename(name, fallback="download"):
    safe = "".join(c for c in str(name or "") if c not in r'\/:*?"<>|').strip()
    return safe or fallback

def find_ffmpeg_exe():
    bundled = APP_DIR / "ffmpeg.exe"
    if bundled.exists():
        return str(bundled)
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg not found")

def newest_downloaded_file(folder):
    files = [path for path in Path(folder).iterdir() if path.is_file() and not path.name.endswith(".part")]
    if not files:
        raise RuntimeError("找不到已下載的來源檔")
    return max(files, key=lambda path: path.stat().st_mtime)

def segment_title(base_title, segment, index):
    return safe_filename(
        segment.get("title")
        or f"{base_title} - segment {index:02d} ({format_segment_time(segment['start'])}-{format_segment_time(segment['end'])})"
    )

def unique_output_path(output_dir, filename):
    candidate = Path(output_dir) / filename
    if not candidate.exists():
        return candidate
    stem = candidate.stem
    suffix = candidate.suffix
    for index in range(2, 1000):
        next_candidate = candidate.with_name(f"{stem} - {index:02d}{suffix}")
        if not next_candidate.exists():
            return next_candidate
    raise RuntimeError(f"Could not create unique output filename for {filename}")

def ffmpeg_timeout_for_segment(segment):
    duration = max(0, float(segment["end"]) - float(segment["start"]))
    return max(300, math.ceil(duration * 3))

def run_ffmpeg(command, timeout):
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )

def assert_nonempty_file(path, description):
    path = Path(path)
    if not path.exists():
        raise RuntimeError(f"{description} 未產生")
    if path.stat().st_size <= 0:
        raise RuntimeError(f"{description} 是空檔")

def cut_segment_file(source_file, output_file, segment):
    ffmpeg = find_ffmpeg_exe()
    source_file = Path(source_file)
    output_file = Path(output_file)
    assert_nonempty_file(source_file, "下載來源檔")
    temp_output = output_file.with_name(f".{output_file.stem}.{uuid.uuid4().hex}{output_file.suffix}")
    base_command = [ffmpeg, "-y", "-ss", str(segment["start"]), "-to", str(segment["end"]), "-i", str(source_file)]
    timeout = ffmpeg_timeout_for_segment(segment)
    try:
        result = run_ffmpeg([*base_command, "-map", "0", "-c", "copy", str(temp_output)], timeout)
        if result.returncode != 0:
            if temp_output.exists():
                temp_output.unlink()
            result = run_ffmpeg([*base_command, str(temp_output)], timeout)
        if result.returncode != 0:
            message = (result.stderr or result.stdout or "ffmpeg segment cut failed").strip()
            raise RuntimeError(message[-1000:])
        assert_nonempty_file(temp_output, "分段輸出檔")
        temp_output.replace(output_file)
    except subprocess.TimeoutExpired as error:
        if temp_output.exists():
            temp_output.unlink()
        raise RuntimeError(f"ffmpeg 切割分段逾時，已等待 {error.timeout} 秒") from error
    except BaseException:
        if temp_output.exists():
            temp_output.unlink()
        raise

def download_item_process(event_queue, item, media_type, extension, output_dir):
    """Download one item in a child process so the parent can terminate it."""
    url = item["url"]
    custom_title = item.get("custom_title", "").strip() or None
    segments = item.get("segments") or []
    last_progress = {"percent": -1, "time": 0.0}

    def progress_hook(data):
        if data["status"] == "downloading":
            downloaded = data.get("downloaded_bytes", 0)
            total = data.get("total_bytes") or data.get("total_bytes_estimate", 0)
            percent = round((downloaded / total * 100) if total else 0, 1)
            now = time.monotonic()
            if percent >= last_progress["percent"] + 1 or now - last_progress["time"] >= 1:
                last_progress.update(percent=percent, time=now)
                event_queue.put({
                    "type": "progress",
                    "percent": percent,
                    "filename": data.get("filename", ""),
                })
        elif data["status"] == "finished":
            event_queue.put({
                "type": "progress",
                "percent": 100,
                "filename": data.get("filename", ""),
            })

    def build_download_opts(outtmpl):
        opts = build_ydl_opts_base({
            "format": get_format_string(media_type, extension),
            "outtmpl": outtmpl,
            "progress_hooks": [progress_hook],
            "postprocessors": get_postprocessors(media_type, extension),
        })
        if media_type == "video" and extension in ["mkv", "avi", "mov"]:
            opts["merge_output_format"] = extension
        return opts

    if segments:
        base_title = safe_filename(custom_title or "download")
        try:
            with tempfile.TemporaryDirectory(prefix="yt_downloader_segments_") as temp_dir:
                source_template = os.path.join(temp_dir, "source.%(ext)s")
                with yt_dlp.YoutubeDL(build_download_opts(source_template)) as ydl:
                    ydl.download([url])

                source_file = newest_downloaded_file(temp_dir)
                total_segments = len(segments)
                for index, segment in enumerate(segments, start=1):
                    output_name = f"{segment_title(base_title, segment, index)}.{extension}"
                    output_file = unique_output_path(output_dir, output_name)
                    cut_segment_file(source_file, output_file, segment)
                    event_queue.put({
                        "type": "progress",
                        "percent": round(index / total_segments * 100, 1),
                        "filename": str(output_file),
                    })
            event_queue.put({"type": "result", "status": "success"})
        except BaseException as error:
            event_queue.put({
                "type": "result",
                "status": "error",
                "message": str(error),
            })
        return

    if custom_title:
        outtmpl = os.path.join(output_dir, f"{safe_filename(custom_title)}.%(ext)s")
    else:
        outtmpl = os.path.join(output_dir, "%(title)s.%(ext)s")

    ydl_opts = build_ydl_opts_base({
        "format": get_format_string(media_type, extension),
        "outtmpl": outtmpl,
        "progress_hooks": [progress_hook],
        "postprocessors": get_postprocessors(media_type, extension),
    })
    if media_type == "video" and extension in ["mkv", "avi", "mov"]:
        ydl_opts["merge_output_format"] = extension

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        event_queue.put({"type": "result", "status": "success"})
    except BaseException as error:
        event_queue.put({
            "type": "result",
            "status": "error",
            "message": str(error),
        })


def terminate_download_process(job_id):
    """Terminate the active child process for a job, if one exists."""
    with download_jobs_lock:
        runtime = download_runtimes.get(job_id)
        process = runtime.get("process") if runtime else None

    if not process or not process.is_alive():
        return False

    logger.warning("[job:%s] Terminating active download process tree", job_id)
    if os.name == "nt" and process.pid:
        import subprocess
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True,
            check=False,
            text=True,
        )
    else:
        process.terminate()
    process.join(timeout=5)
    if process.is_alive() and hasattr(process, "kill"):
        process.kill()
        process.join(timeout=2)
    return True


def download_worker(job_id, items, media_type, extension, output_dir, title_hint):
    """Coordinate a job and run each yt-dlp item in a terminable child process."""
    with download_jobs_lock:
        job = download_jobs[job_id]
        job.update({
            "status": "running",
            "total": len(items),
            "completed": 0,
            "failed": 0,
            "log": [],
            "started_at": datetime.datetime.now().isoformat(timespec="seconds"),
        })

    if not output_dir:
        output_dir = get_default_output_dir(title_hint)
    else:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

    with download_jobs_lock:
        job["output_dir"] = output_dir

    logger.info(
        "[job:%s] Started: %s item(s), type=%s, extension=%s, output=%s",
        job_id,
        len(items),
        media_type,
        extension,
        output_dir,
    )

    context = multiprocessing.get_context("spawn")

    try:
        for index, item in enumerate(items):
            with download_jobs_lock:
                if job.get("cancelled"):
                    break
                url = item["url"]
                custom_title = item.get("custom_title", "").strip()
                job.update({
                    "current_index": index + 1,
                    "current_url": url,
                    "current_percent": 0,
                    "current_file": "",
                })

            logger.info(
                "[job:%s] Downloading %s/%s: %s",
                job_id,
                index + 1,
                len(items),
                url,
            )

            event_queue = context.Queue()
            process = context.Process(
                target=download_item_process,
                args=(event_queue, item, media_type, extension, output_dir),
                daemon=True,
            )
            with download_jobs_lock:
                download_runtimes[job_id]["process"] = process

            process.start()
            result = None
            last_logged_bucket = -1

            while process.is_alive():
                with download_jobs_lock:
                    cancelled = job.get("cancelled", False)
                if cancelled:
                    terminate_download_process(job_id)
                    break

                try:
                    event = event_queue.get(timeout=0.25)
                except queue.Empty:
                    continue

                if event.get("type") == "progress":
                    percent = float(event.get("percent", 0))
                    with download_jobs_lock:
                        job["current_percent"] = percent
                        job["current_file"] = event.get("filename", "")
                    bucket = int(percent // 10)
                    if bucket > last_logged_bucket:
                        last_logged_bucket = bucket
                        logger.info(
                            "[job:%s] Progress %s/%s: %.1f%%",
                            job_id,
                            index + 1,
                            len(items),
                            percent,
                        )
                elif event.get("type") == "result":
                    result = event

            process.join(timeout=2)
            while True:
                try:
                    event = event_queue.get_nowait()
                except queue.Empty:
                    break
                if event.get("type") == "result":
                    result = event
                elif event.get("type") == "progress":
                    with download_jobs_lock:
                        job["current_percent"] = float(event.get("percent", 0))
                        job["current_file"] = event.get("filename", "")

            event_queue.close()
            with download_jobs_lock:
                download_runtimes[job_id]["process"] = None
                cancelled = job.get("cancelled", False)

            if cancelled:
                logger.warning("[job:%s] Cancelled while processing %s", job_id, url)
                break

            title = custom_title or url
            if result and result.get("status") == "success":
                with download_jobs_lock:
                    job["completed"] += 1
                    job["current_percent"] = 100
                    job["log"].append({
                        "url": url,
                        "title": title,
                        "custom_title": custom_title,
                        "segments": item.get("segments") or [],
                        "status": "success",
                    })
                logger.info("[job:%s] Completed %s/%s: %s", job_id, index + 1, len(items), title)
            else:
                message = (result or {}).get("message") or f"Download process exited with code {process.exitcode}"
                with download_jobs_lock:
                    job["failed"] += 1
                    job["log"].append({
                        "url": url,
                        "title": title,
                        "custom_title": custom_title,
                        "segments": item.get("segments") or [],
                        "status": "error",
                        "message": message,
                    })
                logger.error("[job:%s] Failed %s/%s: %s - %s", job_id, index + 1, len(items), title, message)
    except BaseException:
        logger.exception("[job:%s] Worker crashed", job_id)
        with download_jobs_lock:
            job["status"] = "error"
            job["error"] = "Download worker crashed. Check backend console."
    finally:
        terminate_download_process(job_id)
        with download_jobs_lock:
            if job.get("status") != "error":
                job["status"] = "cancelled" if job.get("cancelled") else "done"
            if job["status"] == "done":
                job["current_percent"] = 100
            job["finished_at"] = datetime.datetime.now().isoformat(timespec="seconds")
            download_runtimes.pop(job_id, None)

        if job["status"] == "cancelled":
            logger.warning("[job:%s] Job cancelled", job_id)
        elif job["status"] == "error" or job.get("failed"):
            logger.error(
                "[job:%s] Job finished with errors: completed=%s failed=%s",
                job_id,
                job.get("completed", 0),
                job.get("failed", 0),
            )
        else:
            logger.info("[job:%s] Job completed successfully", job_id)

@app.route("/api/default-dir")
def api_default_dir():
    return jsonify({"path": str(get_system_downloads_dir())})


@app.route("/api/version")
def api_version():
    return jsonify({"version": APP_VERSION})

@app.route("/api/convert-titles", methods=["POST"])
def api_convert_titles():
    """Convert simplified Chinese titles to traditional Chinese"""
    data = request.json
    titles = data.get("titles", [])
    converted = [_s2t.convert(t) if isinstance(t, str) else (t or '') for t in titles]
    return jsonify({"converted": converted})

@app.route("/api/fetch-playlist-stream", methods=["POST"])
def api_fetch_playlist_stream():
    """Fetch entire playlist and stream results to frontend"""
    data = request.json
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL"}), 400

    def generate():
        logger.info("[playlist] Query started: %s", url)
        total_fetched = 0
        yield f"data: {json.dumps({'type': 'header', 'title': '載入中...', 'uploader': '', 'total': 0})}\n\n"

        ydl_opts = build_ydl_opts_base({
            "extract_flat": "in_playlist",
            "skip_download": True,
            "lazy_playlist": False,
            "ignoreerrors": True,
            "quiet": True,
            "playlist_items": "1-9999",
        })

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            if info is None or info.get("_type") != "playlist":
                logger.error("[playlist] Not a playlist: %s", url)
                yield f"data: {json.dumps({'error': 'Not a playlist URL'})}\n\n"
                return

            entries = [e for e in (info.get("entries") or []) if e]
            entries, continuation_title, continuation_warning = complete_playlist_entries(url, entries)
            total = len(entries)
            logger.info("[playlist] Query succeeded: %s item(s), %s", total, url)

            yield f"data: {json.dumps({'type': 'meta', 'title': info.get('title') or continuation_title or 'Playlist', 'uploader': info.get('uploader',''), 'total': total, 'warning': continuation_warning})}\n\n"

            CHUNK = 20
            for start in range(0, total, CHUNK):
                chunk_items = []
                for e in entries[start:start+CHUNK]:
                    chunk_items.append(format_playlist_item(e))
                    total_fetched += 1
                    continue
                    vid_id = e.get("id", "")
                    orig_title = e.get("title") or ""
                    is_private = (
                        e.get("availability") in ("private", "needs_auth") or
                        orig_title in ("[Private video]", "[Deleted video]", "") or
                        not vid_id
                    )
                    conv_title, was_conv = s2t_title(orig_title) if not is_private else (orig_title, False)
                    duration = e.get("duration")
                    chunk_items.append({
                        "id": vid_id,
                        "title": conv_title if not is_private else "🔒 私人影片",
                        "orig_title": orig_title,
                        "was_converted": was_conv,
                        "url": e.get("url") or e.get("webpage_url") or f"https://www.youtube.com/watch?v={vid_id}",
                        "duration": duration,
                        "duration_str": format_duration(duration),
                        "category": e.get("categories", [None])[0] if e.get("categories") else None,
                        "uploader": e.get("uploader", ""),
                        "lang": "zh-CN" if was_conv else "other",
                        "is_private": is_private,
                    })
                    total_fetched += 1

                yield f"data: {json.dumps({'type': 'chunk', 'items': chunk_items, 'loaded': total_fetched, 'total': total}, ensure_ascii=False)}\n\n"

        except Exception as ex:
            logger.exception("[playlist] Query failed: %s", url)
            yield f"data: {json.dumps({'type': 'error', 'message': str(ex)})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'total': total_fetched})}\n\n"

    return app.response_class(generate(), mimetype="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.route("/api/fetch-info", methods=["POST"])
def api_fetch_info():
    data = request.json
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    logger.info("[query] Fetch info started: %s", url)
    info = fetch_info(url)
    if info is None:
        info = {"error": "No video info returned"}
    if info and not info.get("error"):
        logger.info("[query] Fetch info succeeded: type=%s title=%s", info.get("type"), info.get("title"))
    else:
        logger.error("[query] Fetch info failed: %s - %s", url, (info or {}).get("error", "No result"))
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
    logger.info("[import] Parsed %s URL(s) from %s", len(urls), f.filename)
    return jsonify({"urls": urls})

@app.route("/api/start-download", methods=["POST"])
def api_start_download():
    data = request.json
    # Accept either old format {urls:[]} or new format {items:[{url, custom_title}]}
    raw_items = data.get("items", [])
    if not raw_items:
        # fallback: old format
        raw_items = [{"url": u, "custom_title": ""} for u in data.get("urls", [])]
    media_type = data.get("media_type", "video")
    extension = data.get("extension", "mp4")
    output_dir = data.get("output_dir", "")
    title_hint = data.get("title_hint", "downloads")

    if not raw_items:
        return jsonify({"error": "No URLs"}), 400

    try:
        raw_items = expand_download_segments(raw_items)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    job_id = str(uuid.uuid4())
    with download_jobs_lock:
        download_jobs[job_id] = {
            "status": "queued",
            "total": len(raw_items),
            "completed": 0,
            "failed": 0,
            "current_index": 0,
            "current_url": "",
            "current_percent": 0,
            "current_file": "",
            "output_dir": output_dir,
            "log": [],
            "cancelled": False,
            "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
        }
        download_runtimes[job_id] = {"process": None, "thread": None}

    t = threading.Thread(
        target=download_worker,
        args=(job_id, raw_items, media_type, extension, output_dir, title_hint),
        daemon=True,
    )
    with download_jobs_lock:
        download_runtimes[job_id]["thread"] = t
    t.start()
    logger.info("[job:%s] Queued %s item(s)", job_id, len(raw_items))
    return jsonify({"job_id": job_id})


def expand_download_segments(raw_items):
    """Validate ranges and keep requested segments grouped by source video."""
    expanded = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict) or not str(raw_item.get("url", "")).strip():
            raise ValueError("Each download item must contain a URL")

        item = {
            "url": str(raw_item["url"]).strip(),
            "custom_title": str(raw_item.get("custom_title", "")).strip(),
            "segments": [],
        }
        segments = raw_item.get("segments") or []
        if not segments:
            expanded.append(item)
            continue
        if not isinstance(segments, list) or len(segments) > 20:
            raise ValueError("Each video supports at most 20 download segments")

        normalized = []
        for segment in segments:
            if not isinstance(segment, dict):
                raise ValueError("Invalid download segment")
            try:
                start = float(segment["start"])
                end = float(segment["end"])
            except (KeyError, TypeError, ValueError):
                raise ValueError("Segment start and end must be numbers") from None
            if start < 0 or end <= start:
                raise ValueError("Segment end must be greater than start")
            normalized.append({
                "start": start,
                "end": end,
                "title": str(segment.get("title", "")).strip(),
            })

        normalized.sort(key=lambda segment: segment["start"])
        expanded.append({
            **item,
            "segments": normalized,
        })

    if len(expanded) > 1000:
        raise ValueError("A download job supports at most 1000 source videos")
    return expanded


def format_segment_time(seconds):
    total = max(0, int(seconds))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}-{minutes:02d}-{secs:02d}"
    return f"{minutes:02d}-{secs:02d}"

@app.route("/api/job-status/<job_id>")
def api_job_status(job_id):
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        snapshot = dict(job)
        snapshot["log"] = [dict(entry) for entry in job.get("log", [])]
    return jsonify(snapshot)

@app.route("/api/cancel-job/<job_id>", methods=["POST"])
def api_cancel_job(job_id):
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        if job.get("status") in ("done", "cancelled", "error"):
            return jsonify({"ok": True, "status": job.get("status")})
        job["cancelled"] = True
        job["status"] = "cancelling"
    terminated = terminate_download_process(job_id)
    logger.warning("[job:%s] Cancel requested, process_terminated=%s", job_id, terminated)
    return jsonify({"ok": True, "status": "cancelling", "terminated": terminated})


@app.route("/api/cancel-all-jobs", methods=["POST"])
def api_cancel_all_jobs():
    with download_jobs_lock:
        active_job_ids = [
            job_id
            for job_id, job in download_jobs.items()
            if job.get("status") not in ("done", "cancelled", "error")
        ]
        for job_id in active_job_ids:
            download_jobs[job_id]["cancelled"] = True
            download_jobs[job_id]["status"] = "cancelling"

    terminated = sum(1 for job_id in active_job_ids if terminate_download_process(job_id))
    logger.warning("[jobs] Cancel all requested: jobs=%s terminated=%s", len(active_job_ids), terminated)
    return jsonify({"ok": True, "jobs": len(active_job_ids), "terminated": terminated})

@app.route("/api/cookie-status")
def api_cookie_status():
    return jsonify(inspect_cookie_file())

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
    logger.info("[cookie] Cookie file updated")
    return jsonify({"ok": True})

@app.route("/api/delete-cookie", methods=["POST"])
def api_delete_cookie():
    if COOKIE_FILE.exists():
        COOKIE_FILE.unlink()
    logger.info("[cookie] Cookie file deleted")
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


def resolve_frontend_file(path):
    """Resolve an exported Next.js route or asset inside FRONTEND_DIST."""
    clean_path = path.strip("/")
    candidates = []
    if clean_path:
        candidates.extend([
            FRONTEND_DIST / clean_path,
            FRONTEND_DIST / clean_path / "index.html",
            FRONTEND_DIST / f"{clean_path}.html",
        ])
    else:
        candidates.append(FRONTEND_DIST / "index.html")

    frontend_root = FRONTEND_DIST.resolve()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if frontend_root not in resolved.parents and resolved != frontend_root:
            continue
        if resolved.is_file():
            return resolved
    return None


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    target = resolve_frontend_file(path)
    if not target:
        logger.error("[frontend] Exported file not found: %s", path or "/")
        return jsonify({
            "error": "Frontend build not found",
            "hint": "Run frontend static export before starting the packaged application.",
        }), 503
    return send_from_directory(target.parent, target.name)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    logger.info("Backend listening on http://localhost:5000")
    app.run(debug=True, use_reloader=False, threaded=True, port=5000)
