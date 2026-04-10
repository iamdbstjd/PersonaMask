from __future__ import annotations

import unittest
from unittest.mock import patch

import numpy as np

from app.pipelines.frame_processor import FaceBox, apply_character_effects, apply_privacy_effects


def _random_image(height: int = 160, width: int = 160) -> np.ndarray:
    rng = np.random.default_rng(1234)
    return rng.integers(0, 256, size=(height, width, 3), dtype=np.uint8)


class FrameProcessorTests(unittest.TestCase):
    def test_privacy_allowlist_preserves_largest_face_even_if_detector_order_varies(self) -> None:
        image = _random_image()
        small_face = FaceBox(x1=12, y1=18, x2=42, y2=50)
        large_face = FaceBox(x1=70, y1=36, x2=128, y2=116)

        with patch("app.pipelines.frame_processor.detect_faces", return_value=[small_face, large_face]):
            result = apply_privacy_effects(
                image,
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                allowlist_enabled=True,
            )

        self.assertEqual(result.primary_face, large_face)
        self.assertEqual(result.detections.faces_total, 2)
        self.assertEqual(result.detections.faces_redacted, 1)
        self.assertTrue(np.array_equal(result.image_bgr[large_face.y1:large_face.y2, large_face.x1:large_face.x2], image[large_face.y1:large_face.y2, large_face.x1:large_face.x2]))
        self.assertFalse(np.array_equal(result.image_bgr[small_face.y1:small_face.y2, small_face.x1:small_face.x2], image[small_face.y1:small_face.y2, small_face.x1:small_face.x2]))

    def test_character_effects_keep_background_intact_when_face_is_detected(self) -> None:
        image = _random_image()
        primary_face = FaceBox(x1=56, y1=42, x2=104, y2=110)

        with patch("app.pipelines.frame_processor.detect_faces", return_value=[primary_face]):
            result = apply_character_effects(image, "spider")

        self.assertEqual(result.primary_face, primary_face)
        self.assertFalse(np.array_equal(result.image_bgr[54:98, 54:106], image[54:98, 54:106]))
        self.assertTrue(np.array_equal(result.image_bgr[:24, :24], image[:24, :24]))
        self.assertTrue(np.array_equal(result.image_bgr[-24:, -24:], image[-24:, -24:]))

    def test_character_effects_fall_back_to_full_frame_transform_without_face(self) -> None:
        image = _random_image()

        with patch("app.pipelines.frame_processor.detect_faces", return_value=[]):
            result = apply_character_effects(image, "bat")

        self.assertIsNone(result.primary_face)
        self.assertFalse(np.array_equal(result.image_bgr, image))


if __name__ == "__main__":
    unittest.main()
