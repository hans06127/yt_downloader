import datetime
import json
import os
import re
import shutil
import sqlite3
import tempfile
import zipfile
from pathlib import Path


_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")


def normalize_client_id(value):
    candidate = str(value or "").strip()
    return candidate if _CLIENT_ID_RE.fullmatch(candidate) else None


class WebRuntimeStore:
    def __init__(self, data_dir=None, ttl_hours=None):
        default_root = Path(tempfile.gettempdir()) / "yt_downloader_web"
        self.root = Path(data_dir or os.environ.get("YT_DOWNLOADER_WEB_DATA_DIR") or default_root)
        self.downloads_root = self.root / "downloads"
        self.cookies_root = self.root / "cookies"
        self.db_path = self.root / "jobs.sqlite3"
        self.ttl_hours = int(ttl_hours or os.environ.get("YT_DOWNLOADER_JOB_TTL_HOURS", "24"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.downloads_root.mkdir(parents=True, exist_ok=True)
        self.cookies_root.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self):
        connection = sqlite3.connect(self.db_path, timeout=30)
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def _initialize(self):
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def load_jobs(self):
        jobs = {}
        interrupted = []
        with self._connect() as connection:
            rows = connection.execute("SELECT id, payload FROM jobs").fetchall()
        for job_id, payload in rows:
            try:
                job = json.loads(payload)
            except (TypeError, json.JSONDecodeError):
                continue
            if job.get("status") in {"running", "cancelling"}:
                job["status"] = "error"
                job["error"] = "後端曾重新啟動，原下載工作已中止。"
                job["finished_at"] = datetime.datetime.now().isoformat(timespec="seconds")
                interrupted.append((job_id, job))
            jobs[job_id] = job
        for job_id, job in interrupted:
            self.save_job(job_id, job)
        return jobs

    def save_job(self, job_id, job):
        payload = json.dumps(job, ensure_ascii=False)
        updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO jobs (id, payload, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                """,
                (job_id, payload, updated_at),
            )

    def output_dir(self, job_id):
        target = self.downloads_root / job_id
        target.mkdir(parents=True, exist_ok=True)
        return target

    def cookie_file(self, client_id):
        target = self.cookies_root / client_id
        target.mkdir(parents=True, exist_ok=True)
        return target / "cookies.txt"

    def artifact_files(self, job_id):
        target = self.downloads_root / job_id
        if not target.is_dir():
            return []
        return sorted(
            path for path in target.iterdir()
            if path.is_file() and path.name != f"{job_id}.zip"
        )

    def build_archive(self, job_id):
        files = self.artifact_files(job_id)
        if not files:
            return None
        target = self.downloads_root / job_id / f"{job_id}.zip"
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in files:
                archive.write(path, arcname=path.name)
        return target

    def cleanup_expired(self):
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=self.ttl_hours)
        expired_ids = []
        with self._connect() as connection:
            rows = connection.execute("SELECT id, updated_at FROM jobs").fetchall()
            for job_id, updated_at in rows:
                try:
                    updated = datetime.datetime.fromisoformat(updated_at)
                except ValueError:
                    expired_ids.append(job_id)
                    continue
                if updated < cutoff:
                    expired_ids.append(job_id)
            if expired_ids:
                connection.executemany("DELETE FROM jobs WHERE id = ?", [(job_id,) for job_id in expired_ids])
        for job_id in expired_ids:
            shutil.rmtree(self.downloads_root / job_id, ignore_errors=True)

        cookie_cutoff = cutoff.timestamp()
        for client_dir in self.cookies_root.iterdir():
            if not client_dir.is_dir():
                continue
            cookie_file = client_dir / "cookies.txt"
            try:
                last_modified = cookie_file.stat().st_mtime
            except OSError:
                shutil.rmtree(client_dir, ignore_errors=True)
                continue
            if last_modified < cookie_cutoff:
                shutil.rmtree(client_dir, ignore_errors=True)
        return expired_ids
