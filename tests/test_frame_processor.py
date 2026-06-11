from __future__ import annotations

import unittest
from unittest.mock import patch

import numpy as np

from app.pipelines.frame_processor import (
    CandidateReference,
    CharacterStyleAsset,
    FaceBox,
    FaceDetection,
    _crop_face_with_padding,
    _detect_faces_yolo,
    apply_video_review_effects,
    detect_face_details,
)


def _random_image(height: int = 160, width: int = 160) -> np.ndarray:
    rng = np.random.default_rng(1234)
    return rng.integers(0, 256, size=(height, width, 3), dtype=np.uint8)


def _detections(*faces: FaceBox) -> list[FaceDetection]:
    return [FaceDetection(box=face) for face in faces]


class _DummyYoloBox:
    def __init__(self, xyxy: list[float], cls: int, conf: float) -> None:
        self.xyxy = np.asarray([xyxy], dtype=np.float32)
        self.cls = np.asarray([cls], dtype=np.float32)
        self.conf = np.asarray([conf], dtype=np.float32)


class _DummyYoloResult:
    def __init__(self, boxes: list[_DummyYoloBox]) -> None:
        self.boxes = boxes


class _DummyYoloModel:
    names = {0: "face", 1: "person"}

    def __init__(self) -> None:
        self.calls = 0

    def predict(self, image: np.ndarray, *, verbose: bool, conf: float) -> list[_DummyYoloResult]:
        self.calls += 1
        return [
            _DummyYoloResult(
                [
                    _DummyYoloBox([12.2, 16.4, 58.8, 72.1], cls=0, conf=0.91),
                    _DummyYoloBox([5.0, 5.0, 130.0, 150.0], cls=1, conf=0.88),
                ]
            )
        ]


class FrameProcessorTests(unittest.TestCase):
    def test_yolo_face_detector_maps_face_boxes_when_configured(self) -> None:
        image = _random_image()
        model = _DummyYoloModel()

        with patch.dict("os.environ", {"PERSONAMASK_YOLO_FACE_CLASSES": "face"}):
            detections = _detect_faces_yolo(image, model)

        self.assertEqual(model.calls, 1)
        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].detector, "yolo_face")
        self.assertAlmostEqual(detections[0].confidence, 0.91, places=2)
        self.assertEqual(detections[0].box.as_list(), [12, 16, 59, 72])

    def test_detect_face_details_prefers_yolo_when_available(self) -> None:
        image = _random_image()
        model = _DummyYoloModel()

        with patch("app.pipelines.frame_processor._get_yolo_model", return_value=model), patch.dict(
            "os.environ", {"PERSONAMASK_YOLO_FACE_CLASSES": "face"}
        ):
            detections = detect_face_details(image)

        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].detector, "yolo_face")

    def test_yolo_mode_without_model_path_falls_back_to_opencv(self) -> None:
        image = _random_image()
        fallback_face = FaceBox(x1=20, y1=24, x2=80, y2=96)

        with patch.dict(
            "os.environ",
            {
                "PERSONAMASK_FACE_DETECTOR": "yolo",
                "PERSONAMASK_YOLO_FACE_MODEL": "",
            },
        ), patch("app.pipelines.frame_processor._get_insightface_app", return_value=None), patch(
            "app.pipelines.frame_processor._detect_faces_opencv", return_value=[fallback_face]
        ):
            detections = detect_face_details(image)

        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].detector, "opencv_haar")
        self.assertEqual(detections[0].box, fallback_face)

    def test_video_review_modes_blur_or_preserve_candidate_face(self) -> None:
        image = _random_image()
        primary_face = FaceBox(x1=58, y1=42, x2=126, y2=124)
        secondary_face = FaceBox(x1=12, y1=22, x2=44, y2=58)
        candidate = CandidateReference(
            candidate_id="face_0001",
            action="preserve",
            image_bgr=_crop_face_with_padding(image, primary_face),
        )

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=_detections(primary_face, secondary_face)):
            blur_result = apply_video_review_effects(
                image,
                mode="blur",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
            )
            preserve_result = apply_video_review_effects(
                image,
                mode="preserve",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                candidate_references=[candidate],
            )

        self.assertEqual(blur_result.detections.faces_redacted, 2)
        self.assertFalse(np.array_equal(blur_result.image_bgr[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2], image[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2]))
        self.assertEqual(preserve_result.detections.faces_redacted, 1)
        self.assertTrue(np.array_equal(preserve_result.image_bgr[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2], image[primary_face.y1:primary_face.y2, primary_face.x1:primary_face.x2]))

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
                candidate_references=[candidate],
            )

        self.assertEqual(result.candidate_matches["face_0001"], 1)
        self.assertEqual(result.detections.faces_redacted, 1)
        self.assertTrue(np.array_equal(result.image_bgr[preserve_face.y1:preserve_face.y2, preserve_face.x1:preserve_face.x2], image[preserve_face.y1:preserve_face.y2, preserve_face.x1:preserve_face.x2]))
        self.assertFalse(np.array_equal(result.image_bgr[blur_face.y1:blur_face.y2, blur_face.x1:blur_face.x2], image[blur_face.y1:blur_face.y2, blur_face.x1:blur_face.x2]))

    def test_video_review_applies_candidate_character_style_asset(self) -> None:
        image = _random_image()
        character_face = FaceBox(x1=34, y1=34, x2=116, y2=122)
        candidate = CandidateReference(
            candidate_id="face_0001",
            action="character",
            image_bgr=_crop_face_with_padding(image, character_face),
        )
        style_image = np.full((96, 96, 3), (12, 210, 180), dtype=np.uint8)
        style_asset = CharacterStyleAsset(
            candidate_id="face_0001",
            image_bgr=style_image,
            engine="diffusion_img2img",
            prompt="privacy character",
        )

        with patch("app.pipelines.frame_processor.detect_face_details", return_value=_detections(character_face)):
            result = apply_video_review_effects(
                image,
                mode="character",
                blur_faces=True,
                blur_plates=False,
                blur_text=False,
                candidate_references=[candidate],
                character_style_assets={"face_0001": style_asset},
            )

        self.assertEqual(result.candidate_matches["face_0001"], 1)
        self.assertEqual(result.detections.faces_redacted, 1)
        self.assertEqual(result.detections.faces_stylized, 1)
        self.assertFalse(np.array_equal(result.image_bgr[character_face.y1:character_face.y2, character_face.x1:character_face.x2], image[character_face.y1:character_face.y2, character_face.x1:character_face.x2]))


if __name__ == "__main__":
    unittest.main()
