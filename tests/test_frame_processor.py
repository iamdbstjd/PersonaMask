from __future__ import annotations

import unittest
from unittest.mock import patch

import numpy as np

from app.pipelines.frame_processor import (
    CandidateReference,
    FaceBox,
    FaceDetection,
    _crop_face_with_padding,
    apply_character_effects,
    apply_privacy_effects,
    apply_video_review_effects,
)


def _random_image(height: int = 160, width: int = 160) -> np.ndarray:
    rng = np.random.default_rng(1234)
    return rng.integers(0, 256, size=(height, width, 3), dtype=np.uint8)


def _detections(*faces: FaceBox) -> list[FaceDetection]:
    return [FaceDetection(box=face) for face in faces]


class FrameProcessorTests(unittest.TestCase):
    def test_privacy_allowlist_preserves_largest_face_even_if_detector_order_varies(self) -> None:
        image = _random_image()
        small_face = FaceBox(x1=12, y1=18, x2=42, y2=50)
        large_face = FaceBox(x1=70, y1=36, x2=128, y2=116)

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=_detections(small_face, large_face)):
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

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=_detections(primary_face)):
            result = apply_character_effects(image, "spider")

        self.assertEqual(result.primary_face, primary_face)
        self.assertFalse(np.array_equal(result.image_bgr[54:98, 54:106], image[54:98, 54:106]))
        self.assertTrue(np.array_equal(result.image_bgr[:24, :24], image[:24, :24]))
        self.assertTrue(np.array_equal(result.image_bgr[-24:, -24:], image[-24:, -24:]))

    def test_character_effects_fall_back_to_full_frame_transform_without_face(self) -> None:
        image = _random_image()

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=[]):
            result = apply_character_effects(image, "bat")

        self.assertIsNone(result.primary_face)
        self.assertFalse(np.array_equal(result.image_bgr, image))

    def test_video_review_modes_blur_or_preserve_reference_face(self) -> None:
        image = _random_image()
        primary_face = FaceBox(x1=58, y1=42, x2=126, y2=124)
        secondary_face = FaceBox(x1=12, y1=22, x2=44, y2=58)

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=_detections(primary_face, secondary_face)):
            blur_result = apply_video_review_effects(
                image,
                mode="blur",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                allowlist_enabled=True,
            )
            preserve_result = apply_video_review_effects(
                image,
                mode="preserve",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                allowlist_enabled=True,
            )
            character_result = apply_video_review_effects(
                image,
                mode="character",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                allowlist_enabled=True,
                character_id="spider",
            )

        self.assertEqual(blur_result.detections.faces_redacted, 2)
        self.assertFalse(np.array_equal(blur_result.image_bgr[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2], image[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2]))
        self.assertEqual(preserve_result.detections.faces_redacted, 1)
        self.assertTrue(np.array_equal(preserve_result.image_bgr[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2], image[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2]))
        self.assertEqual(character_result.detections.faces_redacted, 1)
        self.assertFalse(np.array_equal(character_result.image_bgr[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2], image[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2]))

    def test_video_review_applies_candidate_specific_preserve_action(self) -> None:
        image = _random_image()
        preserve_face = FaceBox(x1=18, y1=24, x2=62, y2=80)
        blur_face = FaceBox(x1=92, y1=42, x2=140, y2=112)
        candidate = CandidateReference(
            candidate_id="face_0001",
            action="preserve",
            image_bgr=_crop_face_with_padding(image, preserve_face),
        )

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=_detections(blur_face, preserve_face)):
            result = apply_video_review_effects(
                image,
                mode="blur",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                allowlist_enabled=False,
                candidate_references=[candidate],
            )

        self.assertEqual(result.candidate_matches["face_0001"], 1)
        self.assertEqual(result.detections.faces_redacted, 1)
        self.assertTrue(np.array_equal(result.image_bgr[preserve_face.y1:preserve_face.y2, preserve_face.x1:preserve_face.x2], image[preserve_face.y1:preserve_face.y2, preserve_face.x1:preserve_face.x2]))
        self.assertFalse(np.array_equal(result.image_bgr[blur_face.y1:blur_face.y2, blur_face.x1:blur_face.x2], image[blur_face.y1:blur_face.y2, blur_face.x1:blur_face.x2]))

    def test_video_review_candidate_blur_overrides_global_face_blur_toggle(self) -> None:
        image = _random_image()
        face = FaceBox(x1=38, y1=34, x2=116, y2=122)
        candidate = CandidateReference(
            candidate_id="face_0001",
            action="blur",
            image_bgr=_crop_face_with_padding(image, face),
        )

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=_detections(face)):
            result = apply_video_review_effects(
                image,
                mode="preserve",
                blur_faces=False,
                blur_plates=False,
                blur_text=False,
                allowlist_enabled=True,
                candidate_references=[candidate],
            )

        self.assertEqual(result.candidate_matches["face_0001"], 1)
        self.assertEqual(result.detections.faces_redacted, 1)
        self.assertFalse(np.array_equal(result.image_bgr[face.y1:face.y2, face.x1:face.x2], image[face.y1:face.y2, face.x1:face.x2]))

    def test_video_review_matches_candidate_by_embedding_when_available(self) -> None:
        image = _random_image()
        preserve_face = FaceBox(x1=18, y1=24, x2=62, y2=80)
        blur_face = FaceBox(x1=92, y1=42, x2=140, y2=112)
        candidate = CandidateReference(
            candidate_id="face_0001",
            action="preserve",
            image_bgr=_crop_face_with_padding(image, preserve_face),
            embedding=(1.0, 0.0, 0.0),
        )
        detections = [
            FaceDetection(box=blur_face, embedding=(0.0, 1.0, 0.0)),
            FaceDetection(box=preserve_face, embedding=(0.98, 0.02, 0.0)),
        ]

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=detections):
            result = apply_video_review_effects(
                image,
                mode="blur",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                allowlist_enabled=False,
                candidate_references=[candidate],
            )

        self.assertEqual(result.candidate_matches["face_0001"], 1)
        self.assertEqual(result.detections.faces_redacted, 1)
        self.assertTrue(np.array_equal(result.image_bgr[preserve_face.y1:preserve_face.y2, preserve_face.x1:preserve_face.x2], image[preserve_face.y1:preserve_face.y2, preserve_face.x1:preserve_face.x2]))
        self.assertFalse(np.array_equal(result.image_bgr[blur_face.y1:blur_face.y2, blur_face.x1:blur_face.x2], image[blur_face.y1:blur_face.y2, blur_face.x1:blur_face.x2]))


if __name__ == "__main__":
    unittest.main()
