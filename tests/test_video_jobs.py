from __future__ import annotations

import json
from pathlib import Path
import time
from unittest.mock import patch

from app.pipelines.frame_processor import FaceBox, FaceDetection
from app.core.config import Settings
from app.repositories.job_repository import job_repository
from app.services.video_job_service import VideoJobService
from tests.support import ApiTestCase


class VideoJobTests(ApiTestCase):
    def wait_for_job_status(self, job_id: str, access_token: str, expected: str = "completed") -> dict[str, object]:
        status_payload: dict[str, object] | None = None
        for _ in range(30):
            status_response = self.client.get(
                f"/api/v1/videos/jobs/{job_id}",
                headers={"X-Request-Id": "video-status-1", "X-Access-Token": access_token},
            )
            self.assertEqual(status_response.status_code, 200)
            status_payload = status_response.json()
            if status_payload["data"]["status"] == expected:
                return status_payload
            time.sleep(0.1)
        raise AssertionError(f"job {job_id} did not reach {expected}: {status_payload}")

    def face_detections(self) -> list[FaceDetection]:
        return [FaceDetection(box=FaceBox(12, 10, 42, 40))]

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

    def test_create_job_rejects_unsupported_output_codec(self) -> None:
        response = self.client.post(
            "/api/v1/videos/jobs",
            data={"config": json.dumps({"output_options": {"container": "mp4", "video_codec": "h264", "keep_audio": False}})},
            files={"file": ("codec.mp4", self.make_video_bytes(), "video/mp4")},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["code"], "INVALID_CONFIG")

    def test_video_job_end_to_end_generates_downloadable_result(self) -> None:
        with patch("app.services.video_candidate_service.detect_face_details", return_value=self.face_detections()):
            analysis_response = self.client.post(
                "/api/v1/videos/candidates",
                files={"file": ("candidate-source.mp4", self.make_video_bytes(), "video/mp4")},
            )
        self.assertEqual(analysis_response.status_code, 200)
        analysis = analysis_response.json()["data"]

        response = self.client.post(
            "/api/v1/videos/jobs",
            data={
                "config": json.dumps(
                    {
                        "mode": "character",
                        "character_id": "spider",
                        "analysis_id": analysis["analysis_id"],
                        "candidate_access_token": analysis["access_token"],
                        "candidate_actions": {"face_0001": "character", "face_0002": "blur"},
                        "privacy_options": {
                            "blur_faces": True,
                            "blur_plates": True,
                            "blur_text": False,
                            "allowlist_enabled": True,
                        },
                        "output_options": {"container": "mp4", "video_codec": "mp4v", "keep_audio": True},
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
        access_token = payload["data"]["access_token"]
        self.assertTrue(access_token)

        queued_record = job_repository.get(job_id)
        self.assertIsNotNone(queued_record)
        self.assertIn(f"/uploads/{job_id}/", queued_record.upload_path.replace("\\", "/"))

        missing_token_response = self.client.get(f"/api/v1/videos/jobs/{job_id}", headers={"X-Request-Id": "video-status-missing-token"})
        self.assertEqual(missing_token_response.status_code, 403)

        status_payload = self.wait_for_job_status(job_id, access_token)
        self.assertEqual(status_payload["request_id"], "video-status-1")
        self.assertEqual(status_payload["data"]["status"], "completed")
        self.assertEqual(status_payload["data"]["progress"]["percent"], 100)
        result = status_payload["data"]["result"]
        self.assertNotIn("access_token", result["download_url"])
        self.assertIsNotNone(result["preview_thumbnail_url"])
        self.assertIsNotNone(result["contact_sheet_url"])
        self.assertIsNotNone(result["qa_report_json_url"])
        self.assertIsNotNone(result["qa_report_markdown_url"])
        self.assertEqual(result["qa_summary"]["processed_frames"], 3)
        self.assertIn("faces_total", result["qa_summary"]["detection_totals"])
        self.assertIn("candidate_enforcement", result["qa_summary"])
        self.assertEqual(job_repository.get_queue_depth(), 0)

        download_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/result", headers={"X-Access-Token": access_token})
        self.assertEqual(download_response.status_code, 200)
        self.assertGreater(len(download_response.content), 0)

        thumbnail_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/thumbnail", headers={"X-Access-Token": access_token})
        self.assertEqual(thumbnail_response.status_code, 200)
        self.assertTrue(thumbnail_response.content.startswith(b"\xff\xd8"))

        contact_sheet_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/contact-sheet", headers={"X-Access-Token": access_token})
        self.assertEqual(contact_sheet_response.status_code, 200)
        self.assertTrue(contact_sheet_response.content.startswith(b"\xff\xd8"))

        qa_json_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/qa-report.json", headers={"X-Access-Token": access_token})
        self.assertEqual(qa_json_response.status_code, 200)
        qa_payload = qa_json_response.json()
        self.assertEqual(qa_payload["processed_frames"], 3)
        self.assertEqual(qa_payload["analysis_id"], analysis["analysis_id"])
        self.assertEqual(qa_payload["candidate_actions"]["face_0001"], "character")
        self.assertIn("candidate_enforcement", qa_payload)
        self.assertIn("detection_totals", qa_payload)
        self.assertIn("contact_sheet", qa_payload["artifacts"])

        qa_markdown_response = self.client.get(f"/api/v1/videos/jobs/{job_id}/qa-report.md", headers={"X-Access-Token": access_token})
        self.assertEqual(qa_markdown_response.status_code, 200)
        self.assertIn("Redaction QA Report", qa_markdown_response.text)
        self.assertIn("Processed frames: 3", qa_markdown_response.text)

        output_dir = self.temp_path / "data" / "outputs"
        job_output_dir = output_dir / job_id
        self.assertTrue(any(path.suffix == ".mp4" for path in job_output_dir.iterdir()))
        self.assertTrue(any(path.suffix == ".jpg" for path in job_output_dir.iterdir()))
        self.assertTrue(any(path.name.endswith("-qa-report.json") for path in job_output_dir.iterdir()))
        self.assertTrue(any(path.name.endswith("-qa-report.md") for path in job_output_dir.iterdir()))

    def test_create_job_rejects_wrong_candidate_analysis_token(self) -> None:
        with patch("app.services.video_candidate_service.detect_face_details", return_value=self.face_detections()):
            analysis_response = self.client.post(
                "/api/v1/videos/candidates",
                files={"file": ("candidate-source.mp4", self.make_video_bytes(), "video/mp4")},
            )
        self.assertEqual(analysis_response.status_code, 200)
        analysis = analysis_response.json()["data"]

        response = self.client.post(
            "/api/v1/videos/jobs",
            data={
                "config": json.dumps(
                    {
                        "mode": "blur",
                        "analysis_id": analysis["analysis_id"],
                        "candidate_access_token": "wrong-token",
                        "candidate_actions": {"face_0001": "preserve"},
                    }
                )
            },
            files={"file": ("review-me.mp4", self.make_video_bytes(), "video/mp4")},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"]["code"], "ACCESS_TOKEN_REQUIRED")

    def test_same_filename_jobs_store_unique_upload_paths(self) -> None:
        with patch("app.services.video_job_service.VideoJobService._schedule_processing"):
            first = self.client.post(
                "/api/v1/videos/jobs",
                files={"file": ("same-name.mp4", self.make_video_bytes(), "video/mp4")},
            )
            second = self.client.post(
                "/api/v1/videos/jobs",
                files={"file": ("same-name.mp4", self.make_video_bytes(), "video/mp4")},
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        first_job = job_repository.get(first.json()["data"]["job_id"])
        second_job = job_repository.get(second.json()["data"]["job_id"])
        self.assertIsNotNone(first_job)
        self.assertIsNotNone(second_job)
        self.assertNotEqual(first_job.upload_path, second_job.upload_path)
        self.assertTrue(Path(first_job.upload_path).exists())
        self.assertTrue(Path(second_job.upload_path).exists())

    def test_status_poll_does_not_start_renderer(self) -> None:
        with patch("app.services.video_job_service.VideoJobService._schedule_processing"):
            response = self.client.post(
                "/api/v1/videos/jobs",
                files={"file": ("queued-only.mp4", self.make_video_bytes(), "video/mp4")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        with patch("app.services.video_job_service.process_video_privacy") as processor:
            status_response = self.client.get(
                f"/api/v1/videos/jobs/{data['job_id']}",
                headers={"X-Access-Token": data["access_token"]},
            )

        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.json()["data"]["status"], "queued")
        processor.assert_not_called()

    def test_job_repository_persists_created_jobs_to_local_state(self) -> None:
        with patch("app.services.video_job_service.VideoJobService._schedule_processing"):
            response = self.client.post(
                "/api/v1/videos/jobs",
                files={"file": ("persistent.mp4", self.make_video_bytes(), "video/mp4")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        state_file = self.temp_path / "data" / "state" / "jobs.json"
        self.assertTrue(state_file.exists())

        with job_repository._lock:
            job_repository._jobs.clear()
            job_repository._storage_file = None
        job_repository.configure_storage(str(self.temp_path / "data"))
        restored = job_repository.get(data["job_id"])

        self.assertIsNotNone(restored)
        self.assertEqual(restored.access_token, data["access_token"])
        self.assertEqual(restored.status, "queued")

    def test_service_reschedules_persisted_processing_jobs_after_restart(self) -> None:
        with patch("app.services.video_job_service.VideoJobService._schedule_processing"):
            response = self.client.post(
                "/api/v1/videos/jobs",
                files={"file": ("restart.mp4", self.make_video_bytes(), "video/mp4")},
            )
        self.assertEqual(response.status_code, 200)
        job_id = response.json()["data"]["job_id"]
        job_repository.update_status(
            job_id,
            status="processing",
            progress={"percent": 20, "processed_frames": 1, "total_frames": 3, "eta_sec": 2},
        )

        with job_repository._lock:
            job_repository._jobs.clear()
            job_repository._storage_file = None

        with patch("app.services.video_job_service.VideoJobService._schedule_processing") as schedule_processing:
            VideoJobService(self.settings).resume_pending_jobs()

        restored = job_repository.get(job_id)
        self.assertIsNotNone(restored)
        self.assertEqual(restored.status, "queued")
        schedule_processing.assert_called_once_with(job_id)

    def test_video_candidate_analysis_returns_reviewable_face_crops(self) -> None:
        with patch("app.services.video_candidate_service.detect_face_details", return_value=self.face_detections()):
            response = self.client.post(
                "/api/v1/videos/candidates",
                files={"file": ("candidate-source.mp4", self.make_video_bytes(), "video/mp4")},
                headers={"X-Request-Id": "video-candidates-1"},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["request_id"], "video-candidates-1")
        self.assertIsNone(payload["error"])
        self.assertTrue(payload["data"]["access_token"])
        self.assertGreaterEqual(len(payload["data"]["candidates"]), 1)

        candidate = payload["data"]["candidates"][0]
        self.assertEqual(candidate["candidate_id"], "face_0001")
        self.assertEqual(candidate["bbox"], [12, 10, 42, 40])
        self.assertTrue(candidate["image_url"].startswith("/api/v1/videos/candidates/"))
        self.assertNotIn("access_token", candidate["image_url"])

        missing_token_response = self.client.get(candidate["image_url"])
        self.assertEqual(missing_token_response.status_code, 403)

        image_response = self.client.get(candidate["image_url"], headers={"X-Access-Token": payload["data"]["access_token"]})
        self.assertEqual(image_response.status_code, 200)
        self.assertTrue(image_response.content.startswith(b"\xff\xd8"))
