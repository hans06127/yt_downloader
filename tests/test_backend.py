import multiprocessing
import tempfile
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

    def test_download_segments_stay_grouped_with_titles(self):
        items = app.expand_download_segments([
            {
                "url": "https://www.youtube.com/watch?v=test",
                "custom_title": "Demo",
                "segments": [
                    {"start": 10, "end": 20, "title": "Intro"},
                    {"start": 65, "end": 90, "title": "Main"},
                ],
            },
        ])

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["custom_title"], "Demo")
        self.assertEqual(items[0]["segments"][0], {"start": 10.0, "end": 20.0, "title": "Intro"})
        self.assertEqual(items[0]["segments"][1], {"start": 65.0, "end": 90.0, "title": "Main"})

    def test_download_segments_allow_overlap(self):
        items = app.expand_download_segments([
            {
                "url": "https://www.youtube.com/watch?v=test",
                "segments": [
                    {"start": 10, "end": 30},
                    {"start": 20, "end": 40},
                ],
            },
        ])

        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0]["segments"],
            [
                {"start": 10.0, "end": 30.0, "title": ""},
                {"start": 20.0, "end": 40.0, "title": ""},
            ],
        )

    def test_resolve_output_dir_uses_downloads_for_blank_value(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            downloads = app.Path(temp_dir) / "Downloads"
            with mock.patch.object(app, "get_system_downloads_dir", return_value=downloads):
                output_dir = app.resolve_output_dir("", "Demo")

        self.assertEqual(app.Path(output_dir), downloads / "Demo")

    def test_resolve_output_dir_places_relative_paths_under_downloads(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            downloads = app.Path(temp_dir) / "Downloads"
            with mock.patch.object(app, "get_system_downloads_dir", return_value=downloads):
                output_dir = app.resolve_output_dir("single-test", "Demo")

        self.assertEqual(app.Path(output_dir), downloads / "single-test")

    def test_unique_output_path_avoids_overwrite(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            existing = app.Path(temp_dir) / "clip.mp4"
            existing.write_text("existing", encoding="utf-8")

            output = app.unique_output_path(temp_dir, "clip.mp4")

        self.assertEqual(output.name, "clip - 02.mp4")

    def test_cut_segment_file_decodes_ffmpeg_output_as_utf8(self):
        calls = []

        def fake_run(command, **kwargs):
            calls.append(kwargs)
            app.Path(command[-1]).write_bytes(b"segment")
            return mock.Mock(returncode=0, stderr="", stdout="")

        with tempfile.TemporaryDirectory() as temp_dir:
            source = app.Path(temp_dir) / "source.mp4"
            output = app.Path(temp_dir) / "clip.mp4"
            source.write_bytes(b"source")

            with mock.patch.object(app, "find_ffmpeg_exe", return_value="ffmpeg"):
                with mock.patch.object(app.subprocess, "run", fake_run):
                    app.cut_segment_file(source, output, {"start": 1, "end": 2})

        self.assertEqual(calls[0]["encoding"], "utf-8")
        self.assertEqual(calls[0]["errors"], "replace")
        self.assertIn("timeout", calls[0])

    def test_cut_segment_file_rejects_empty_ffmpeg_output(self):
        def fake_run(command, **kwargs):
            app.Path(command[-1]).write_bytes(b"")
            return mock.Mock(returncode=0, stderr="", stdout="")

        with tempfile.TemporaryDirectory() as temp_dir:
            source = app.Path(temp_dir) / "source.mp4"
            output = app.Path(temp_dir) / "clip.mp4"
            source.write_bytes(b"source")

            with mock.patch.object(app, "find_ffmpeg_exe", return_value="ffmpeg"):
                with mock.patch.object(app.subprocess, "run", fake_run):
                    with self.assertRaisesRegex(RuntimeError, "空檔"):
                        app.cut_segment_file(source, output, {"start": 1, "end": 2})

            self.assertFalse(output.exists())

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

    def test_drm_query_error_is_normalized(self):
        result = app.normalize_query_error(
            "ERROR: [DRM] The requested site is known to use DRM protection. It will NOT be supported."
        )

        self.assertIn("DRM", result)
        self.assertIn("不支援下載", result)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    unittest.main()
