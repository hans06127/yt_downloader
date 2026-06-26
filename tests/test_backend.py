import multiprocessing
import time
import unittest
from unittest import mock

import app


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        with app.download_jobs_lock:
            app.download_jobs.clear()
            app.download_runtimes.clear()

    def tearDown(self):
        with app.download_jobs_lock:
            job_ids = list(app.download_runtimes)
        for job_id in job_ids:
            app.terminate_download_process(job_id)
        with app.download_jobs_lock:
            app.download_jobs.clear()
            app.download_runtimes.clear()

    def test_frontend_export_is_served(self):
        response = self.client.get("/")
        try:
            self.assertEqual(response.status_code, 200)
            self.assertIn(b"__NEXT_DATA__", response.data)
        finally:
            response.close()

    def test_version_endpoint_matches_version_file(self):
        response = self.client.get("/api/version")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["version"], app.APP_VERSION)
        self.assertEqual(app.APP_VERSION, app.VERSION_FILE.read_text(encoding="utf-8").strip())

    def test_cancel_job_terminates_active_process(self):
        context = multiprocessing.get_context("spawn")
        process = context.Process(target=time.sleep, args=(60,))
        process.start()
        self.addCleanup(lambda: process.is_alive() and process.kill())

        with app.download_jobs_lock:
            app.download_jobs["cancel-test"] = {
                "status": "running",
                "cancelled": False,
                "log": [],
            }
            app.download_runtimes["cancel-test"] = {
                "process": process,
                "thread": None,
            }

        response = self.client.post("/api/cancel-job/cancel-test")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["ok"])
        process.join(timeout=10)
        self.assertFalse(process.is_alive())
        self.assertTrue(app.download_jobs["cancel-test"]["cancelled"])

    def test_cancel_all_marks_all_jobs(self):
        with app.download_jobs_lock:
            app.download_jobs["job-a"] = {
                "status": "running",
                "cancelled": False,
                "log": [],
            }
            app.download_jobs["job-b"] = {
                "status": "queued",
                "cancelled": False,
                "log": [],
            }
            app.download_runtimes["job-a"] = {"process": None, "thread": None}
            app.download_runtimes["job-b"] = {"process": None, "thread": None}

        response = self.client.post("/api/cancel-all-jobs")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["jobs"], 2)
        self.assertTrue(app.download_jobs["job-a"]["cancelled"])
        self.assertTrue(app.download_jobs["job-b"]["cancelled"])

    def test_download_segments_expand_to_individual_files(self):
        items = app.expand_download_segments([
            {
                "url": "https://www.youtube.com/watch?v=test",
                "custom_title": "Demo",
                "segments": [
                    {"start": 10, "end": 20},
                    {"start": 65, "end": 90},
                ],
            },
        ])

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["segments"], [{"start": 10.0, "end": 20.0}])
        self.assertIn("片段 01 (00-10-00-20)", items[0]["custom_title"])
        self.assertIn("片段 02 (01-05-01-30)", items[1]["custom_title"])

    def test_download_segments_reject_overlap(self):
        with self.assertRaisesRegex(ValueError, "cannot overlap"):
            app.expand_download_segments([
                {
                    "url": "https://www.youtube.com/watch?v=test",
                    "segments": [
                        {"start": 10, "end": 30},
                        {"start": 20, "end": 40},
                    ],
                },
            ])

    def test_fetch_info_falls_back_to_flat_metadata_when_format_unavailable(self):
        class FakeYdl:
            calls = 0
            seen_options = []

            def __init__(self, options):
                self.options = options
                FakeYdl.seen_options.append(options)

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def extract_info(self, url, download=False):
                FakeYdl.calls += 1
                if FakeYdl.calls == 1:
                    raise Exception("Requested format is not available")
                return {
                    "title": "Fallback title",
                    "duration": 125,
                    "webpage_url": url,
                    "uploader": "Uploader",
                }

        with mock.patch.object(app.yt_dlp, "YoutubeDL", FakeYdl):
            result = app.fetch_info("https://www.youtube.com/watch?v=test")

        self.assertEqual(result["type"], "video")
        self.assertEqual(result["title"], "Fallback title")
        self.assertEqual(result["duration_str"], "2:05")
        self.assertEqual(FakeYdl.calls, 2)
        self.assertTrue(FakeYdl.seen_options[1]["extract_flat"])

    def test_fetch_info_returns_collected_error_when_yt_dlp_returns_none(self):
        class FakeYdl:
            def __init__(self, options):
                self.options = options

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def extract_info(self, url, download=False):
                self.options["logger"].error(
                    "[youtube] test: Sign in to confirm you're not a bot. Use --cookies"
                )
                return None

        with mock.patch.object(app.yt_dlp, "YoutubeDL", FakeYdl):
            result = app.fetch_info("https://www.youtube.com/watch?v=test")

        self.assertIn("error", result)
        self.assertIn("Sign in to confirm", result["error"])


if __name__ == "__main__":
    multiprocessing.freeze_support()
    unittest.main()
