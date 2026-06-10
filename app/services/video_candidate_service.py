from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from app.pipelines.frame_processor import FaceBox, detect_face_details


@dataclass(frozen=True)
class VideoFaceCandidate:
    candidate_id: str
    image_path: Path
    frame_index: int
    bbox: FaceBox
    confidence: float = 1.0
    embedding: tuple[float, ...] | None = None
    detector: str = "opencv_haar"
    cluster_size: int = 1


@dataclass(frozen=True)
class _CandidateObservation:
    frame_index: int
    bbox: FaceBox
    crop: np.ndarray
    confidence: float
    embedding: tuple[float, ...] | None
    detector: str


def extract_video_face_candidates(
    video_path: Path,
    output_dir: Path,
    *,
    max_frames: int = 90,
    max_candidates: int = 5,
) -> list[VideoFaceCandidate]:
    output_dir.mkdir(parents=True, exist_ok=True)
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        capture.release()
        raise ValueError(f"unable to open video for candidate analysis: {video_path.name}")

    observations: list[_CandidateObservation] = []
    try:
        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        for frame_index in _sample_positions(total_frames, max_frames):
            if total_frames > 0:
                capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok:
                break

            for detection in detect_face_details(frame):
                crop = _crop_face(frame, detection.box)
                if _is_low_quality_crop(crop):
                    continue
                observations.append(
                    _CandidateObservation(
                        frame_index=frame_index,
                        bbox=detection.box,
                        crop=crop,
                        confidence=detection.confidence,
                        embedding=detection.embedding,
                        detector=detection.detector,
                    )
                )
    finally:
        capture.release()

    if any(observation.embedding is not None for observation in observations):
        return _write_embedding_clusters(observations, output_dir, max_candidates=max_candidates)
    return _write_histogram_candidates(observations, output_dir, max_candidates=max_candidates)


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


def _embedding_similarity(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    return float(np.dot(np.asarray(left, dtype=np.float32), np.asarray(right, dtype=np.float32)))


def _centroid(items: list[_CandidateObservation]) -> tuple[float, ...]:
    embeddings = [np.asarray(item.embedding, dtype=np.float32) for item in items if item.embedding is not None]
    if not embeddings:
        return ()
    centroid = np.mean(embeddings, axis=0)
    norm = float(np.linalg.norm(centroid))
    if norm <= 1e-12:
        return tuple(centroid.astype(float).tolist())
    return tuple((centroid / norm).astype(float).tolist())


def _representative_observation(items: list[_CandidateObservation]) -> _CandidateObservation:
    return max(items, key=lambda item: (item.confidence, item.bbox.area))


def _write_embedding_clusters(
    observations: list[_CandidateObservation],
    output_dir: Path,
    *,
    max_candidates: int,
    threshold: float = 0.35,
) -> list[VideoFaceCandidate]:
    clusters: list[dict[str, object]] = []
    for observation in observations:
        if observation.embedding is None:
            continue
        best_cluster: dict[str, object] | None = None
        best_score = -1.0
        for cluster in clusters:
            centroid = cluster["centroid"]
            if not isinstance(centroid, tuple):
                continue
            score = _embedding_similarity(observation.embedding, centroid)
            if score > best_score:
                best_score = score
                best_cluster = cluster
        if best_cluster is not None and best_score >= threshold:
            items = best_cluster["items"]
            if isinstance(items, list):
                items.append(observation)
                best_cluster["centroid"] = _centroid(items)
        else:
            clusters.append({"items": [observation], "centroid": observation.embedding})

    stable_clusters = [cluster for cluster in clusters if isinstance(cluster["items"], list) and len(cluster["items"]) >= 2]
    if stable_clusters:
        clusters = stable_clusters
    clusters.sort(
        key=lambda cluster: (
            len(cluster["items"]) if isinstance(cluster["items"], list) else 0,
            _representative_observation(cluster["items"]).confidence if isinstance(cluster["items"], list) else 0.0,
        ),
        reverse=True,
    )

    candidates: list[VideoFaceCandidate] = []
    for cluster in clusters[:max_candidates]:
        items = cluster["items"]
        if not isinstance(items, list) or not items:
            continue
        representative = _representative_observation(items)
        candidate_id = f"face_{len(candidates) + 1:04d}"
        image_path = output_dir / f"{candidate_id}.jpg"
        cv2.imwrite(str(image_path), representative.crop)
        candidates.append(
            VideoFaceCandidate(
                candidate_id=candidate_id,
                image_path=image_path,
                frame_index=representative.frame_index,
                bbox=representative.bbox,
                confidence=round(float(np.mean([item.confidence for item in items])), 4),
                embedding=_centroid(items),
                detector=representative.detector,
                cluster_size=len(items),
            )
        )
    return candidates


def _write_histogram_candidates(
    observations: list[_CandidateObservation],
    output_dir: Path,
    *,
    max_candidates: int,
) -> list[VideoFaceCandidate]:
    candidates: list[VideoFaceCandidate] = []
    seen_histograms: list[np.ndarray] = []
    for observation in observations:
        histogram = _crop_histogram(observation.crop)
        if _is_duplicate(histogram, seen_histograms):
            continue

        candidate_id = f"face_{len(candidates) + 1:04d}"
        image_path = output_dir / f"{candidate_id}.jpg"
        cv2.imwrite(str(image_path), observation.crop)
        candidates.append(
            VideoFaceCandidate(
                candidate_id=candidate_id,
                image_path=image_path,
                frame_index=observation.frame_index,
                bbox=observation.bbox,
                confidence=observation.confidence,
                detector=observation.detector,
            )
        )
        seen_histograms.append(histogram)
        if len(candidates) >= max_candidates:
            break
    return candidates


def _crop_histogram(crop: np.ndarray) -> np.ndarray:
    resized = cv2.resize(crop, (64, 64), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    histogram = cv2.calcHist([hsv], [0, 1], None, [24, 24], [0, 180, 0, 256])
    cv2.normalize(histogram, histogram, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    return histogram


def _is_duplicate(histogram: np.ndarray, seen_histograms: list[np.ndarray], threshold: float = 0.92) -> bool:
    return any(cv2.compareHist(histogram, seen, cv2.HISTCMP_CORREL) >= threshold for seen in seen_histograms)
