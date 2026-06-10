from __future__ import annotations

import contextlib
from dataclasses import dataclass, field
import io
import os
from pathlib import Path
from threading import Lock
from typing import Any
from typing import Callable
from typing import Iterable
from typing import Mapping
from typing import Sequence

import cv2
import numpy as np


@dataclass(frozen=True)
class FaceBox:
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def width(self) -> int:
        return max(1, self.x2 - self.x1)

    @property
    def height(self) -> int:
        return max(1, self.y2 - self.y1)

    @property
    def area(self) -> int:
        return self.width * self.height

    def as_list(self) -> list[int]:
        return [self.x1, self.y1, self.x2, self.y2]


@dataclass(frozen=True)
class FaceDetection:
    box: FaceBox
    confidence: float = 1.0
    embedding: tuple[float, ...] | None = None
    detector: str = "opencv_haar"


@dataclass(frozen=True)
class ProcessingDetections:
    faces_total: int
    faces_redacted: int
    plates_redacted: int
    text_regions_redacted: int
    faces_stylized: int = 0


@dataclass(frozen=True)
class ProcessingResult:
    image_bgr: np.ndarray
    detections: ProcessingDetections
    primary_face: FaceBox | None
    redacted_regions: tuple[FaceBox, ...] = ()
    candidate_matches: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class CandidateReference:
    candidate_id: str
    action: str
    image_bgr: np.ndarray
    embedding: tuple[float, ...] | None = None


@dataclass(frozen=True)
class CharacterStyleAsset:
    candidate_id: str
    image_bgr: np.ndarray
    engine: str
    prompt: str
    artifact_path: str | None = None


StyleTransformer = Callable[[np.ndarray], np.ndarray]


_FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
_INSIGHTFACE_LOCK = Lock()
_INSIGHTFACE_APP: Any | None = None
_INSIGHTFACE_FAILED = False
_INSIGHTFACE_DETECTOR = "insightface_buffalo_l"
_EMBEDDING_MATCH_THRESHOLD = 0.35
_HISTOGRAM_MATCH_THRESHOLD = 0.88
_INSIGHTFACE_MODULES = ("detection", "recognition")


def decode_image_bytes(frame_bytes: bytes) -> np.ndarray:
    if not frame_bytes:
        raise ValueError("frame payload is empty")
    array = np.frombuffer(frame_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("frame payload is not a decodable image")
    return image


def encode_jpeg(image_bgr: np.ndarray, jpeg_quality: float) -> bytes:
    quality = int(max(5, min(100, round(jpeg_quality * 100))))
    ok, encoded = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ValueError("failed to encode processed frame as jpeg")
    return encoded.tobytes()


def _detect_faces_opencv(image_bgr: np.ndarray) -> list[FaceBox]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    raw_faces = _FACE_CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(36, 36))
    faces: list[FaceBox] = []
    for x, y, w, h in raw_faces:
        faces.append(FaceBox(x1=int(x), y1=int(y), x2=int(x + w), y2=int(y + h)))
    faces.sort(key=lambda face: face.area, reverse=True)
    return faces


def _insightface_root() -> Path:
    return Path(os.getenv("PERSONAMASK_INSIGHTFACE_ROOT", "~/.insightface")).expanduser()


def _insightface_model_available(root: Path) -> bool:
    model_dir = root / "models" / os.getenv("PERSONAMASK_INSIGHTFACE_MODEL", "buffalo_l")
    return (model_dir / "det_10g.onnx").exists() and (model_dir / "w600k_r50.onnx").exists()


def _get_insightface_app() -> Any | None:
    global _INSIGHTFACE_APP, _INSIGHTFACE_FAILED
    detector_mode = os.getenv("PERSONAMASK_FACE_DETECTOR", "auto").lower()
    if detector_mode in {"opencv", "haar", "off"}:
        return None
    if _INSIGHTFACE_FAILED:
        return None

    with _INSIGHTFACE_LOCK:
        if _INSIGHTFACE_APP is not None:
            return _INSIGHTFACE_APP
        root = _insightface_root()
        if not _insightface_model_available(root):
            _INSIGHTFACE_FAILED = True
            return None
        try:
            from insightface.app import FaceAnalysis

            provider = os.getenv("PERSONAMASK_ONNXRUNTIME_PROVIDER", "CPUExecutionProvider")
            ctx_id = int(os.getenv("PERSONAMASK_INSIGHTFACE_CTX_ID", "0" if provider != "CPUExecutionProvider" else "-1"))
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                app = FaceAnalysis(
                    name=os.getenv("PERSONAMASK_INSIGHTFACE_MODEL", "buffalo_l"),
                    root=str(root),
                    allowed_modules=list(_INSIGHTFACE_MODULES),
                    providers=[provider],
                )
                app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        except Exception:
            _INSIGHTFACE_FAILED = True
            return None
        _INSIGHTFACE_APP = app
        return _INSIGHTFACE_APP


def identity_detector_available() -> bool:
    if not _insightface_model_available(_insightface_root()):
        return False
    try:
        import insightface  # noqa: F401
    except Exception:
        return False
    return True


def _normalize_embedding(embedding: Sequence[float] | np.ndarray | None) -> tuple[float, ...] | None:
    if embedding is None:
        return None
    array = np.asarray(embedding, dtype=np.float32)
    if array.size == 0:
        return None
    norm = float(np.linalg.norm(array))
    if norm <= 1e-12:
        return None
    return tuple((array / norm).astype(float).tolist())


def _box_from_xyxy(values: Sequence[float], width: int, height: int) -> FaceBox | None:
    x1, y1, x2, y2 = [int(round(value)) for value in values[:4]]
    x1 = max(0, min(width - 1, x1))
    x2 = max(1, min(width, x2))
    y1 = max(0, min(height - 1, y1))
    y2 = max(1, min(height, y2))
    if x2 <= x1 or y2 <= y1:
        return None
    return FaceBox(x1=x1, y1=y1, x2=x2, y2=y2)


def detect_face_details(image_bgr: np.ndarray) -> list[FaceDetection]:
    app = _get_insightface_app()
    if app is not None:
        height, width = image_bgr.shape[:2]
        detections: list[FaceDetection] = []
        try:
            raw_faces = app.get(image_bgr)
        except Exception:
            raw_faces = []
        for raw_face in raw_faces:
            box = _box_from_xyxy(raw_face.bbox, width, height)
            if box is None:
                continue
            detections.append(
                FaceDetection(
                    box=box,
                    confidence=float(getattr(raw_face, "det_score", 1.0) or 1.0),
                    embedding=_normalize_embedding(getattr(raw_face, "normed_embedding", None)),
                    detector=_INSIGHTFACE_DETECTOR,
                )
            )
        detections.sort(key=lambda face: face.box.area, reverse=True)
        return detections

    return [FaceDetection(box=face) for face in _detect_faces_opencv(image_bgr)]


def detect_faces(image_bgr: np.ndarray) -> list[FaceBox]:
    return [detection.box for detection in detect_face_details(image_bgr)]


def _largest_face(faces: Iterable[FaceBox]) -> FaceBox | None:
    return max(faces, key=lambda face: face.area, default=None)


def _crop_face_with_padding(image_bgr: np.ndarray, face: FaceBox) -> np.ndarray:
    height, width = image_bgr.shape[:2]
    pad_x = int(round(face.width * 0.18))
    pad_y = int(round(face.height * 0.18))
    x1 = max(0, face.x1 - pad_x)
    x2 = min(width, face.x2 + pad_x)
    y1 = max(0, face.y1 - pad_y)
    y2 = min(height, face.y2 + pad_y)
    if x2 <= x1 or y2 <= y1:
        return np.empty((0, 0, 3), dtype=image_bgr.dtype)
    return image_bgr[y1:y2, x1:x2]


def _candidate_histogram(crop: np.ndarray) -> np.ndarray | None:
    if crop.size == 0:
        return None
    resized = cv2.resize(crop, (64, 64), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    histogram = cv2.calcHist([hsv], [0, 1], None, [24, 24], [0, 180, 0, 256])
    cv2.normalize(histogram, histogram, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    return histogram


def _embedding_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    return float(np.dot(np.asarray(left, dtype=np.float32), np.asarray(right, dtype=np.float32)))


def _reference_embedding(reference: CandidateReference) -> tuple[float, ...] | None:
    if reference.embedding is not None:
        return reference.embedding
    detections = detect_face_details(reference.image_bgr)
    if not detections:
        return None
    return max(detections, key=lambda detection: detection.box.area).embedding


def _match_candidate_actions(
    image_bgr: np.ndarray,
    face_detections: Sequence[FaceDetection],
    references: Sequence[CandidateReference],
) -> dict[FaceBox, CandidateReference]:
    if not references:
        return {}

    reference_embeddings: list[tuple[CandidateReference, tuple[float, ...]]] = []
    reference_histograms: list[tuple[CandidateReference, np.ndarray]] = []
    for reference in references:
        embedding = _reference_embedding(reference)
        if embedding is not None:
            reference_embeddings.append((reference, embedding))
        else:
            histogram = _candidate_histogram(reference.image_bgr)
            if histogram is not None:
                reference_histograms.append((reference, histogram))

    scored_matches: list[tuple[float, FaceBox, CandidateReference]] = []
    for detection in face_detections:
        face = detection.box

        if detection.embedding is not None and reference_embeddings:
            best_reference: CandidateReference | None = None
            best_score = -1.0
            for reference, reference_embedding in reference_embeddings:
                score = _embedding_similarity(detection.embedding, reference_embedding)
                if score > best_score:
                    best_score = score
                    best_reference = reference
            if best_reference is not None and best_score >= _EMBEDDING_MATCH_THRESHOLD:
                scored_matches.append((best_score, face, best_reference))
            continue

        crop = _crop_face_with_padding(image_bgr, face)
        face_histogram = _candidate_histogram(crop)
        if face_histogram is not None:
            best_reference = None
            best_score = -1.0
            for reference, reference_histogram in reference_histograms:
                score = float(cv2.compareHist(face_histogram, reference_histogram, cv2.HISTCMP_CORREL))
                if score > best_score:
                    best_score = score
                    best_reference = reference
            if best_reference is not None and best_score >= _HISTOGRAM_MATCH_THRESHOLD:
                scored_matches.append((best_score, face, best_reference))

    matches: dict[FaceBox, CandidateReference] = {}
    used_candidate_ids: set[str] = set()
    for _, face, reference in sorted(scored_matches, key=lambda item: item[0], reverse=True):
        if face in matches or reference.candidate_id in used_candidate_ids:
            continue
        matches[face] = reference
        used_candidate_ids.add(reference.candidate_id)
    return matches


def _blur_region(image_bgr: np.ndarray, box: FaceBox) -> None:
    h, w = image_bgr.shape[:2]
    x1 = max(0, min(w - 1, box.x1))
    x2 = max(1, min(w, box.x2))
    y1 = max(0, min(h - 1, box.y1))
    y2 = max(1, min(h, box.y2))
    if x2 <= x1 or y2 <= y1:
        return

    roi = image_bgr[y1:y2, x1:x2]
    kernel_w = max(7, ((x2 - x1) // 5) | 1)
    kernel_h = max(7, ((y2 - y1) // 5) | 1)
    blurred = cv2.GaussianBlur(roi, (kernel_w, kernel_h), 0)
    image_bgr[y1:y2, x1:x2] = blurred


def _expand_face_region(
    box: FaceBox,
    image_bgr: np.ndarray,
    *,
    horizontal_ratio: float = 0.28,
    top_ratio: float = 0.42,
    bottom_ratio: float = 0.2,
) -> FaceBox:
    height, width = image_bgr.shape[:2]
    pad_x = int(round(box.width * horizontal_ratio))
    pad_top = int(round(box.height * top_ratio))
    pad_bottom = int(round(box.height * bottom_ratio))
    return FaceBox(
        x1=max(0, box.x1 - pad_x),
        y1=max(0, box.y1 - pad_top),
        x2=min(width, box.x2 + pad_x),
        y2=min(height, box.y2 + pad_bottom),
    )


def _apply_face_transform(image_bgr: np.ndarray, face: FaceBox, transformer: StyleTransformer) -> np.ndarray:
    output = image_bgr.copy()
    region = _expand_face_region(face, image_bgr)
    roi = output[region.y1:region.y2, region.x1:region.x2].copy()
    styled_roi = transformer(roi)

    relative_face = FaceBox(
        x1=face.x1 - region.x1,
        y1=face.y1 - region.y1,
        x2=face.x2 - region.x1,
        y2=face.y2 - region.y1,
    )
    mask = np.zeros(roi.shape[:2], dtype=np.uint8)
    center = (
        (relative_face.x1 + relative_face.x2) // 2,
        (relative_face.y1 + relative_face.y2) // 2,
    )
    axes = (
        max(1, int(round(relative_face.width * 0.85))),
        max(1, int(round(relative_face.height * 1.15))),
    )
    cv2.ellipse(mask, center, axes, 0, 0, 360, 255, thickness=-1)
    blur_kernel = max(5, ((min(roi.shape[:2]) // 8) | 1))
    mask = cv2.GaussianBlur(mask, (blur_kernel, blur_kernel), 0)
    mask_alpha = (mask.astype(np.float32) / 255.0)[..., None]

    blended = styled_roi.astype(np.float32) * mask_alpha + roi.astype(np.float32) * (1.0 - mask_alpha)
    output[region.y1:region.y2, region.x1:region.x2] = blended.astype(np.uint8)
    return output


def _detect_plate_candidates(image_bgr: np.ndarray) -> list[FaceBox]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edged = cv2.Canny(gray, threshold1=80, threshold2=160)
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates: list[FaceBox] = []
    height, width = gray.shape
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area < 350 or area > (width * height) // 5:
            continue
        aspect_ratio = w / max(1, h)
        if aspect_ratio < 2.0 or aspect_ratio > 6.0:
            continue
        if y < height * 0.25:
            continue
        candidates.append(FaceBox(x1=x, y1=y, x2=x + w, y2=y + h))
    candidates.sort(key=lambda box: box.area, reverse=True)
    return candidates[:2]


def _draw_privacy_avatar_overlay(image_bgr: np.ndarray) -> np.ndarray:
    color = cv2.bilateralFilter(image_bgr, 9, 90, 90)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 7)
    return cv2.bitwise_and(color, color, mask=edges)


def _fallback_style_transformer(_: str | None) -> StyleTransformer:
    return _draw_privacy_avatar_overlay


def _apply_face_asset(image_bgr: np.ndarray, face: FaceBox, asset: CharacterStyleAsset) -> np.ndarray:
    return _apply_face_transform(
        image_bgr,
        face,
        lambda roi: cv2.resize(asset.image_bgr, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_CUBIC),
    )


def apply_video_review_effects(
    image_bgr: np.ndarray,
    *,
    mode: str,
    blur_faces: bool,
    blur_plates: bool,
    blur_text: bool,
    character_id: str | None = None,
    candidate_references: Sequence[CandidateReference] | None = None,
    character_style_assets: Mapping[str, CharacterStyleAsset] | None = None,
) -> ProcessingResult:
    review_mode = "blur" if mode == "video_privacy" else mode
    output = image_bgr.copy()
    face_detections = detect_face_details(output)
    faces = [detection.box for detection in face_detections]
    primary = _largest_face(faces)
    references = tuple(candidate_references or ())
    style_assets = character_style_assets or {}
    candidate_matches = _match_candidate_actions(image_bgr, face_detections, references)
    faces_redacted = 0
    faces_stylized = 0
    redacted_regions: list[FaceBox] = []
    transform_faces: list[tuple[FaceBox, CharacterStyleAsset | None]] = []
    matched_counts: dict[str, int] = {}

    for face in faces:
        candidate_reference = candidate_matches.get(face)
        if candidate_reference is not None:
            matched_counts[candidate_reference.candidate_id] = matched_counts.get(candidate_reference.candidate_id, 0) + 1
            if candidate_reference.action in {"preserve", "track"}:
                continue
            if candidate_reference.action == "character":
                transform_faces.append((face, style_assets.get(candidate_reference.candidate_id)))
                faces_redacted += 1
                faces_stylized += 1
                redacted_regions.append(face)
                continue
            _blur_region(output, face)
            faces_redacted += 1
            redacted_regions.append(face)
            continue

        if blur_faces:
            _blur_region(output, face)
            faces_redacted += 1
            redacted_regions.append(face)

    fallback_transformer = _fallback_style_transformer(character_id)
    for face, asset in transform_faces:
        output = _apply_face_asset(output, face, asset) if asset is not None else _apply_face_transform(output, face, fallback_transformer)

    plate_boxes = _detect_plate_candidates(image_bgr) if blur_plates else []
    for plate in plate_boxes:
        _blur_region(output, plate)
        redacted_regions.append(plate)

    text_regions_redacted = 0
    if blur_text:
        height, width = output.shape[:2]
        text_band = FaceBox(x1=0, y1=0, x2=width, y2=max(1, int(height * 0.16)))
        _blur_region(output, text_band)
        redacted_regions.append(text_band)
        text_regions_redacted = 1

    return ProcessingResult(
        image_bgr=output,
        detections=ProcessingDetections(
            faces_total=len(faces),
            faces_redacted=faces_redacted,
            plates_redacted=len(plate_boxes),
            text_regions_redacted=text_regions_redacted,
            faces_stylized=faces_stylized,
        ),
        primary_face=primary,
        redacted_regions=tuple(redacted_regions),
        candidate_matches=matched_counts,
    )
