import datetime
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

from web_runtime import WebRuntimeStore, normalize_client_id


class WebRuntimeStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = WebRuntimeStore(self.temp_dir.name, ttl_hours=24)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_client_id_validation(self):
        self.assertEqual(normalize_client_id("12345678-1234-1234-1234-123456789012"), "12345678-1234-1234-1234-123456789012")
        self.assertIsNone(normalize_client_id("../invalid"))
        self.assertIsNone(normalize_client_id("short"))

    def test_jobs_are_persisted_and_interrupted_jobs_are_recovered(self):
        self.store.save_job("job-1", {"status": "running", "client_id": "client-1234567890"})
        loaded = self.store.load_jobs()
        self.assertEqual(loaded["job-1"]["status"], "error")
        self.assertIn("重新啟動", loaded["job-1"]["error"])

    def test_queued_jobs_remain_available_for_resume(self):
        self.store.save_job(
            "job-queued",
            {
                "status": "queued",
                "_request": {"items": [{"url": "https://example.com/video"}]},
            },
        )

        loaded = self.store.load_jobs()

        self.assertEqual(loaded["job-queued"]["status"], "queued")
        self.assertIn("_request", loaded["job-queued"])

    def test_cookie_files_are_isolated_by_client(self):
        first = self.store.cookie_file("client-1111111111")
        second = self.store.cookie_file("client-2222222222")
        self.assertNotEqual(first, second)
        self.assertEqual(first.name, "cookies.txt")

    def test_artifacts_are_archived_for_browser_delivery(self):
        output_dir = self.store.output_dir("job-2")
        (output_dir / "video.mp4").write_bytes(b"video")
        (output_dir / "audio.mp3").write_bytes(b"audio")

        archive_path = self.store.build_archive("job-2")

        self.assertIsNotNone(archive_path)
        with zipfile.ZipFile(archive_path) as archive:
            self.assertEqual(sorted(archive.namelist()), ["audio.mp3", "video.mp4"])

    def test_cleanup_removes_expired_job_files(self):
        self.store.save_job("job-old", {"status": "done"})
        output_dir = self.store.output_dir("job-old")
        (output_dir / "old.mp4").write_bytes(b"old")
        expired = (
            datetime.datetime.now(datetime.timezone.utc)
            - datetime.timedelta(hours=48)
        ).isoformat()
        with sqlite3.connect(self.store.db_path) as connection:
            connection.execute(
                "UPDATE jobs SET updated_at = ? WHERE id = ?",
                (expired, "job-old"),
            )

        removed = self.store.cleanup_expired()

        self.assertEqual(removed, ["job-old"])
        self.assertFalse(output_dir.exists())


if __name__ == "__main__":
    unittest.main()
