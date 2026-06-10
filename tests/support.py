from __future__ import annotations

from contextlib import ExitStack
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import create_app
from app.repositories.job_repository import job_repository


class ApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._temp_dir = TemporaryDirectory()
        self.temp_path = Path(self._temp_dir.name)
        self.settings = Settings(
            app_env="test",
            data_dir=str(self.temp_path / "data"),
            models_dir=str(self.temp_path / "models"),
            diffusion_enabled=False,
        )
        self._patches = ExitStack()
        for target in (
            "app.main.get_settings",
            "app.api.routers.diagnostics.get_settings",
            "app.api.routers.videos.get_settings",
        ):
            self._patches.enter_context(patch(target, return_value=self.settings))
        get_settings.cache_clear()
        with job_repository._lock:
            job_repository._jobs.clear()
            job_repository._storage_file = None
        self.client = TestClient(create_app())

    def tearDown(self) -> None:
        self.client.close()
        self._patches.close()
        get_settings.cache_clear()
        self._temp_dir.cleanup()
        super().tearDown()

    @staticmethod
    def make_image_bytes(color: tuple[int, int, int] = (40, 160, 220)) -> bytes:
        image = np.full((72, 96, 3), color, dtype=np.uint8)
        ok, encoded = cv2.imencode(".jpg", image)
        if not ok:
            raise AssertionError("failed to encode test image")
        return encoded.tobytes()

    @staticmethod
    def make_video_bytes() -> bytes:
        with TemporaryDirectory() as tmp:
            video_path = Path(tmp) / "sample.mp4"
            writer = cv2.VideoWriter(str(video_path), cv2.VideoWriter_fourcc(*"mp4v"), 5.0, (64, 48))
            if not writer.isOpened():
                raise AssertionError("failed to open test video writer")
            for index in range(3):
                frame = np.full((48, 64, 3), (index * 30, 120, 200), dtype=np.uint8)
                writer.write(frame)
            writer.release()
            return video_path.read_bytes()

    @staticmethod
    def parse_frame_meta(header_value: str | None) -> dict[str, object]:
        if not header_value:
            raise AssertionError("expected X-Frame-Meta header")
        return json.loads(header_value)
