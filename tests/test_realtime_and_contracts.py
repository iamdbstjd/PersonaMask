from __future__ import annotations

import base64
import json
from unittest.mock import patch

from app.repositories.session_repository import session_repository
from tests.support import ApiTestCase


class RealtimeAndContractTests(ApiTestCase):
    def test_realtime_binary_frame_response_includes_expected_headers(self) -> None:
        session_response = self.client.post(
            "/api/v1/realtime/sessions",
            json={
                "mode": "character",
                "preset_id": "spider",
                "stream_profile": {
                    "target_fps": 8,
                    "frame_width": 640,
                    "jpeg_quality": 0.82,
                    "response_mode": "binary_jpeg",
                },
                "privacy_options": {
                    "blur_faces": True,
                    "blur_plates": False,
                    "blur_text": False,
                    "allowlist_enabled": False,
                },
            },
            headers={"X-Request-Id": "rt-create-1"},
        )
        self.assertEqual(session_response.status_code, 200)
        session_payload = session_response.json()["data"]
        self.assertEqual(session_payload["accepted_profile"]["response_mode"], "binary_jpeg")

        frame_response = self.client.post(
            f"/api/v1/realtime/sessions/{session_payload['session_id']}/frames",
            data={"meta": json.dumps({"frame_id": 7, "mode": "character"})},
            files={"frame": ("frame.jpg", self.make_image_bytes(), "image/jpeg")},
            headers={"X-Request-Id": "rt-frame-1"},
        )

        self.assertEqual(frame_response.status_code, 200)
        self.assertEqual(frame_response.headers["content-type"], "image/jpeg")
        self.assertEqual(frame_response.headers["x-request-id"], "rt-frame-1")
        self.assertGreater(int(frame_response.headers["x-trace-latency-ms"]), 0)
        self.assertTrue(frame_response.content.startswith(b"\xff\xd8"))

        frame_meta = self.parse_frame_meta(frame_response.headers.get("x-frame-meta"))
        self.assertEqual(frame_meta["frame_id"], 7)
        self.assertEqual(frame_meta["mode"], "character")
        self.assertEqual(frame_meta["session_id"], session_payload["session_id"])
        self.assertIn("detections", frame_meta)
        self.assertIn("faces_total", frame_meta["detections"])

    def test_realtime_session_repository_persists_local_state(self) -> None:
        session_response = self.client.post(
            "/api/v1/realtime/sessions",
            json={
                "mode": "privacy",
                "stream_profile": {
                    "target_fps": 8,
                    "frame_width": 640,
                    "jpeg_quality": 0.82,
                    "response_mode": "binary_jpeg",
                },
                "privacy_options": {
                    "blur_faces": True,
                    "blur_plates": False,
                    "blur_text": False,
                    "allowlist_enabled": False,
                },
            },
        )
        self.assertEqual(session_response.status_code, 200)
        session_id = session_response.json()["data"]["session_id"]
        state_file = self.temp_path / "data" / "state" / "sessions.json"
        self.assertTrue(state_file.exists())

        with session_repository._lock:
            session_repository._sessions.clear()
            session_repository._storage_file = None
        session_repository.configure_storage(str(self.temp_path / "data"))

        self.assertIsNotNone(session_repository.get(session_id))

    def test_realtime_json_frame_response_matches_frontend_contract(self) -> None:
        session_response = self.client.post(
            "/api/v1/realtime/sessions",
            json={
                "mode": "privacy",
                "stream_profile": {
                    "target_fps": 10,
                    "frame_width": 720,
                    "jpeg_quality": 0.76,
                    "response_mode": "json_base64",
                },
                "privacy_options": {
                    "blur_faces": True,
                    "blur_plates": True,
                    "blur_text": True,
                    "allowlist_enabled": True,
                },
            },
        )
        self.assertEqual(session_response.status_code, 200)
        session_id = session_response.json()["data"]["session_id"]

        frame_response = self.client.post(
            f"/api/v1/realtime/sessions/{session_id}/frames",
            data={
                "meta": json.dumps(
                    {
                        "frame_id": 3,
                        "timestamp_ms": 123456,
                        "client_width": 96,
                        "client_height": 72,
                        "rotation_deg": 0,
                        "mode": "privacy",
                    }
                )
            },
            files={"frame": ("frame.jpg", self.make_image_bytes((90, 120, 210)), "image/jpeg")},
            headers={"X-Request-Id": "rt-frame-json"},
        )

        self.assertEqual(frame_response.status_code, 200)
        self.assertIn("application/json", frame_response.headers["content-type"])
        payload = frame_response.json()
        self.assertEqual(payload["request_id"], "rt-frame-json")
        self.assertIsNone(payload["error"])
        self.assertEqual(payload["data"]["frame_id"], 3)
        self.assertEqual(payload["data"]["mime_type"], "image/jpeg")
        self.assertIn("detections", payload["data"])
        self.assertTrue(base64.b64decode(payload["data"]["processed_image_base64"]).startswith(b"\xff\xd8"))

    def test_realtime_frame_rejects_oversized_payload(self) -> None:
        session_response = self.client.post(
            "/api/v1/realtime/sessions",
            json={
                "mode": "privacy",
                "stream_profile": {
                    "target_fps": 10,
                    "frame_width": 720,
                    "jpeg_quality": 0.76,
                    "response_mode": "binary_jpeg",
                },
                "privacy_options": {
                    "blur_faces": True,
                    "blur_plates": False,
                    "blur_text": False,
                    "allowlist_enabled": False,
                },
            },
        )
        self.assertEqual(session_response.status_code, 200)
        session_id = session_response.json()["data"]["session_id"]

        frame_response = self.client.post(
            f"/api/v1/realtime/sessions/{session_id}/frames",
            files={"frame": ("huge.jpg", b"x" * (self.settings.max_realtime_frame_bytes + 1), "image/jpeg")},
        )

        self.assertEqual(frame_response.status_code, 413)
        self.assertEqual(frame_response.json()["detail"]["code"], "FRAME_TOO_LARGE")

    def test_allowlist_upload_rejects_non_image_payload(self) -> None:
        media_response = self.client.post(
            "/api/v1/allowlist/faces",
            data={"label": "operator"},
            files={"image": ("face.txt", b"not an image", "text/plain")},
        )
        self.assertEqual(media_response.status_code, 400)
        self.assertEqual(media_response.json()["detail"]["code"], "UNSUPPORTED_MEDIA_TYPE")

        decode_response = self.client.post(
            "/api/v1/allowlist/faces",
            data={"label": "operator"},
            files={"image": ("face.jpg", b"not an image", "image/jpeg")},
        )
        self.assertEqual(decode_response.status_code, 400)
        self.assertEqual(decode_response.json()["detail"]["code"], "INVALID_IMAGE_FILE")

    def test_presets_and_runtime_diagnostics_match_frontend_expectations(self) -> None:
        runtime_probe = {
            "python_executable": "/usr/bin/python",
            "conda_env": "bys",
            "available_providers": ["CPUExecutionProvider"],
            "cuda_enabled": False,
            "onnxruntime_import_error": None,
            "nvidia": {"available": False, "reason": "not-installed"},
        }

        with patch("app.services.diagnostics_service.probe_runtime", return_value=runtime_probe):
            diagnostics_response = self.client.get("/api/v1/diagnostics/runtime", headers={"X-Request-Id": "diag-1"})

        self.assertEqual(diagnostics_response.status_code, 200)
        diagnostics_payload = diagnostics_response.json()
        self.assertEqual(diagnostics_payload["request_id"], "diag-1")
        self.assertIsNone(diagnostics_payload["error"])
        self.assertEqual(diagnostics_payload["data"]["api_status"], "healthy")
        self.assertEqual(diagnostics_payload["data"]["gpu_status"], "cpu_only")
        self.assertEqual(diagnostics_payload["data"]["runtime_status"], "ready")
        self.assertIn("queue_depth", diagnostics_payload["data"])

        presets_response = self.client.get("/api/v1/presets", headers={"X-Request-Id": "preset-1"})
        self.assertEqual(presets_response.status_code, 200)
        presets_payload = presets_response.json()
        self.assertEqual(presets_payload["request_id"], "preset-1")
        self.assertIsNone(presets_payload["error"])
        self.assertGreaterEqual(len(presets_payload["data"]["items"]), 3)
        first_item = presets_payload["data"]["items"][0]
        self.assertIn("preset_id", first_item)
        self.assertIn("thumbnail_url", first_item)
        self.assertIn("supports_realtime", first_item)
