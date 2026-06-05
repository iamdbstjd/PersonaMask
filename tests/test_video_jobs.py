from __future__ import annotations

from datetime import timedelta
import json
from unittest.mock import patch

from app.pipelines.frame_processor import FaceBox
from app.core.config import Settings
from app.repositories.job_repository import job_repository
from app.services.video_job_service import VideoJobService
from tests.support import ApiTestCase


class VideoJobTests(ApiTestCase):
    def test_sanitize_filename_removes_path_segments_and_unsafe_characters(self) -> None:
        service = VideoJobService(Settings(data_dir=str(self.temp_path / "data")))
        self.assertEqual(service._sanitize_filename("../../clips/final clip!!.mp4", "upload.mp4"), "final_clip_.mp4")
        self.assertEqual(service._sanitize_filename(None, "upload.mp4"), "upload.mp4")

    def test_default_video_job_config_is_safe_redaction(self) -> None:
        service = VideoJobService(Settings(data_dir=str(self.temp_path / "data")))
        config = service._parse_config(None)

        self.assertEqual(config.mode, "blur")
        self.assertFalse(config.privacy_options.allowlist_enabled)
        self.assertFalse(config.output_options.keep_audio)

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
                        "mode": "character",
                        "character_id": "spider",
                        "analysis_id": "analysis_demo",
                        "candidate_actions": {"face_0001": "character", "face_0002": "blur"},
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
        result = status_payload["data"]["result"]
        self.assertIsNotNone(result["preview_thumbnail_url"])
        self.assertIsNotNone(result["contact_sheet_url"])
        self.assertIsNotNone(result["qa_report_json_url"])
        self.assertIsNotNone(result["qa_report_markdown_url"])
        self.assertEqual(result["qa_summary"]["processed_frames"], 3)
        self.assertIn("faces_total", result["qa_summary"]["detection_totals"])
        self.assertEqual(job_repository.get_queue_depth(), 0)

        download_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/result")
        self.assertEqual(download_response.status_code, 200)
        self.assertGreater(len(download_response.content), 0)

        thumbnail_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/thumbnail")
        self.assertEqual(thumbnail_response.status_code, 200)
        self.assertTrue(thumbnail_response.content.startswith(b"\xff\xd8"))

        contact_sheet_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/contact-sheet")
        self.assertEqual(contact_sheet_response.status_code, 200)
        self.assertTrue(contact_sheet_response.content.startswith(b"\xff\xd8"))

        qa_json_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/qa-report.json")
        self.assertEqual(qa_json_response.status_code, 200)
        qa_payload = qa_json_response.json()
        self.assertEqual(qa_payload["processed_frames"], 3)
        self.assertEqual(qa_payload["analysis_id"], "analysis_demo")
        self.assertEqual(qa_payload["candidate_actions"]["face_0001"], "character")
        self.assertIn("detection_totals", qa_payload)
        self.assertIn("contact_sheet", qa_payload["artifacts"])

        qa_markdown_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/qa-report.md")
        self.assertEqual(qa_markdown_response.status_code, 200)
        self.assertIn("Redaction QA Report", qa_markdown_response.text)
        self.assertIn("Processed frames: 3", qa_markdown_response.text)

        output_dir = self.temp_path / "data" / "outputs"
        self.assertTrue(any(path.suffix == ".mp4" for path in output_dir.iterdir()))
        self.assertTrue(any(path.suffix == ".jpg" for path in output_dir.iterdir()))
        self.assertTrue(any(path.name.endswith("-qa-report.json") for path in output_dir.iterdir()))
        self.assertTrue(any(path.name.endswith("-qa-report.md") for path in output_dir.iterdir()))

    def test_video_candidate_analysis_returns_reviewable_face_crops(self) -> None:
        with patch("app.services.video_candidate_service.detect_faces", return_value=[FaceBox(12, 10, 42, 40)]):
            response = self.client.post(
                "/api/v1/videos/candidates",
                files={"file": ("candidate-source.mp4", self.make_video_bytes(), "video/mp4")},
                headers={"X-Request-Id": "video-candidates-1"},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["request_id"], "video-candidates-1")
        self.assertIsNone(payload["error"])
        self.assertGreaterEqual(len(payload["data"]["candidates"]), 1)

        candidate = payload["data"]["candidates"][0]
        self.assertEqual(candidate["candidate_id"], "face_0001")
        self.assertEqual(candidate["bbox"], [12, 10, 42, 40])
        self.assertTrue(candidate["image_url"].startswith("/api/v1/videos/candidates/"))

        image_response = self.client.get(candidate["image_url"])
        self.assertEqual(image_response.status_code, 200)
        self.assertTrue(image_response.content.startswith(b"\xff\xd8"))
