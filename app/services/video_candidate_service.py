from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from app.pipelines.frame_processor import FaceBox, detect_faces


@dataclass(frozen=True)
class VideoFaceCandidate:
    candidate_id: str
    image_path: Path
    frame_index: int
    bbox: FaceBox
    confidence: float = 1.0


def extract_video_face_candidates(
    video_path: Path,
    output_dir: Path,
    *,
    max_frames: int = 90,
    max_candidates: int = 12,
) -> list[VideoFaceCandidate]:
    output_dir.mkdir(parents=True, exist_ok=True)
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        capture.release()
        raise ValueError(f"unable to open video for candidate analysis: {video_path.name}")

    candidates: list[VideoFaceCandidate] = []
    seen_histograms: list[np.ndarray] = []
    try:
        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        for frame_index in _sample_positions(total_frames, max_frames):
            if total_frames > 0:
                capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok:
                break

            for face in detect_faces(frame):
                crop = _crop_face(frame, face)
                if _is_low_quality_crop(crop):
                    continue
                histogram = _crop_histogram(crop)
                if _is_duplicate(histogram, seen_histograms):
                    continue

                candidate_id = f"face_{len(candidates) + 1:04d}"
                image_path = output_dir / f"{candidate_id}.jpg"
                cv2.imwrite(str(image_path), crop)
                candidates.append(
                    VideoFaceCandidate(
                        candidate_id=candidate_id,
                        image_path=image_path,
                        frame_index=frame_index,
                        bbox=face,
                    )
                )
                seen_histograms.append(histogram)
                if len(candidates) >= max_candidates:
                    return candidates
    finally:
        capture.release()

    return candidates


def _sample_positions(total_frames: int, max_frames: int) -> list[int]:
    if max_frames <= 0:
        return []
    if total_frames <= 0:
        return list(range(max_frames))
    sample_count = min(total_frames, max_frames)
    if sample_count <= 1:
        return [0]
    return sorted({round(index * (total_frames - 1) / (sample_count - 1)) for index in range(sample_count)})


def _crop_face(frame: np.ndarray, face: FaceBox) -> np.ndarray:
    height, width = frame.shape[:2]
    pad_x = int(round(face.width * 0.18))
    pad_y = int(round(face.height * 0.18))
    x1 = max(0, face.x1 - pad_x)
    x2 = min(width, face.x2 + pad_x)
    y1 = max(0, face.y1 - pad_y)
    y2 = min(height, face.y2 + pad_y)
    if x2 <= x1 or y2 <= y1:
        return np.empty((0, 0, 3), dtype=frame.dtype)
    return frame[y1:y2, x1:x2]


def _is_low_quality_crop(crop: np.ndarray) -> bool:
    if crop.size == 0:
        return True
    height, width = crop.shape[:2]
    if min(height, width) < 18:
        return True
    aspect_ratio = width / max(1, height)
    return aspect_ratio < 0.55 or aspect_ratio > 1.8


def _crop_histogram(crop: np.ndarray) -> np.ndarray:
    resized = cv2.resize(crop, (64, 64), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    histogram = cv2.calcHist([hsv], [0, 1], None, [24, 24], [0, 180, 0, 256])
    cv2.normalize(histogram, histogram, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    return histogram


def _is_duplicate(histogram: np.ndarray, seen_histograms: list[np.ndarray], threshold: float = 0.92) -> bool:
    return any(cv2.compareHist(histogram, seen, cv2.HISTCMP_CORREL) >= threshold for seen in seen_histograms)
