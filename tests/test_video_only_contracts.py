from __future__ import annotations

from unittest.mock import patch

from tests.support import ApiTestCase


class VideoOnlyContractTests(ApiTestCase):
    def test_realtime_and_allowlist_endpoints_are_not_exposed(self) -> None:
        realtime_response = self.client.post("/api/v1/realtime/sessions", json={})
        allowlist_response = self.client.get("/api/v1/allowlist/faces")

        self.assertEqual(realtime_response.status_code, 404)
        self.assertEqual(allowlist_response.status_code, 404)

    def test_presets_and_runtime_diagnostics_match_uploaded_video_expectations(self) -> None:
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
        self.assertEqual(first_item["engine"], "diffusion_img2img")
        self.assertNotIn("supports_realtime", first_item)
