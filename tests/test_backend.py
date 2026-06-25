import multiprocessing
import time
import unittest

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
        self.assertEqual(app.APP_VERSION, "0.2.0")

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


if __name__ == "__main__":
    multiprocessing.freeze_support()
    unittest.main()
