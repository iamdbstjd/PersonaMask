from __future__ import annotations

from datetime import timedelta
import json

from app.core.config import Settings
from app.repositories.job_repository import job_repository
from app.services.video_job_service import VideoJobService
from tests.support import ApiTestCase


class VideoJobTests(ApiTestCase):
    def test_sanitize_filename_removes_path_segments_and_unsafe_characters(self) -> None:
        service = VideoJobService(Settings(data_dir=str(self.temp_path / "data")))
        self.assertEqual(service._sanitize_filename("../../clips/final clip!!.mp4", "upload.mp4"), "final_clip_.mp4")
        self.assertEqual(service._sanitize_filename(None, "upload.mp4"), "upload.mp4")

    def test_create_job_rejects_non_video_media_type(self) -> None:
        response = self.client.post(
            "/api/v1/videos/jobs",
            data={"config": json.dumps({"mode": "video_privacy"})},
            files={"file": ("../../bad.mp4", self.make_video_bytes(), "text/plain")},
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload["detail"]["code"], "UNSUPPORTED_MEDIA_TYPE")

    def test_video_job_end_to_end_generates_downloadable_result(self) -> None:
        response = self.client.post(
            "/api/v1/videos/jobs",
            data={
                "config": json.dumps(
                    {
                        "mode": "video_privacy",
                        "privacy_options": {
                            "blur_faces": True,
                            "blur_plates": True,
                            "blur_text": False,
                            "allowlist_enabled": True,
                        },
                        "output_options": {"container": "mp4", "video_codec": "h264", "keep_audio": True},
                    }
                )
            },
            files={"file": ("../../review-me.mp4", self.make_video_bytes(), "video/mp4")},
            headers={"X-Request-Id": "video-create-1"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["request_id"], "video-create-1")
        self.assertEqual(payload["data"]["status"], "queued")
        job_id = payload["data"]["job_id"]

        queued_record = job_repository.get(job_id)
        self.assertIsNotNone(queued_record)
        self.assertEqual(job_repository.get_queue_depth(), 1)
        queued_record.created_at -= timedelta(seconds=3)

        status_response = self.client.get(f"/api/v1/videos/jobs/{job_id}", headers={"X-Request-Id": "video-status-1"})
        self.assertEqual(status_response.status_code, 200)
        status_payload = status_response.json()
        self.assertEqual(status_payload["request_id"], "video-status-1")
        self.assertEqual(status_payload["data"]["status"], "completed")
        self.assertEqual(status_payload["data"]["progress"]["percent"], 100)
        self.assertIsNotNone(status_payload["data"]["result"]["preview_thumbnail_url"])
        self.assertEqual(job_repository.get_queue_depth(), 0)

        download_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/result")
        self.assertEqual(download_response.status_code, 200)
        self.assertGreater(len(download_response.content), 0)

        output_dir = self.temp_path / "data" / "outputs"
        self.assertTrue(any(path.suffix == ".mp4" for path in output_dir.iterdir()))
        self.assertTrue(any(path.suffix == ".jpg" for path in output_dir.iterdir()))
