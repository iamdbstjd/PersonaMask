from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.pipelines.frame_processor import apply_video_review_effects
from app.pipelines.frame_processor import FaceBox


class VideoProcessingError(RuntimeError):
    pass


@dataclass(frozen=True)
class VideoProcessingSummary:
    processed_frames: int
    preview_thumbnail: str | None
    contact_sheet: str | None
    qa_report_json: str
    qa_report_markdown: str
    detection_totals: dict[str, int]
    average_blur_reduction_pct: float | None
    suspect_frames: list[dict[str, Any]]


def _open_capture(path: Path) -> cv2.VideoCapture:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        capture.release()
        raise VideoProcessingError(f"unable to open video: {path.name}")
    return capture


def probe_video(path: Path) -> tuple[int, float, int, int]:
    capture = _open_capture(path)
    try:
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    finally:
        capture.release()
    return frame_count, fps, width, height


def process_video_privacy(
    *,
    upload_path: Path,
    output_path: Path,
    blur_faces: bool,
    blur_plates: bool,
    blur_text: bool,
    allowlist_enabled: bool,
    mode: str = "video_privacy",
    character_id: str | None = None,
    analysis_id: str | None = None,
    candidate_actions: dict[str, str] | None = None,
) -> VideoProcessingSummary:
    capture = _open_capture(upload_path)

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 24.0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    if width <= 0 or height <= 0:
        capture.release()
        raise VideoProcessingError("invalid frame size from input video")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_path), fourcc, fps if fps > 0 else 24.0, (width, height))
    if not writer.isOpened():
        capture.release()
        raise VideoProcessingError("unable to initialize video writer")

    processed_frames = 0
    preview_thumbnail: str | None = None
    frame_total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    sample_interval = max(1, frame_total // 6) if frame_total > 0 else 1
    contact_samples: list[tuple[int, np.ndarray, np.ndarray]] = []
    blur_reductions: list[float] = []
    suspect_frames: list[dict[str, Any]] = []
    detection_totals = {
        "faces_total": 0,
        "faces_redacted": 0,
        "plates_redacted": 0,
        "text_regions_redacted": 0,
    }

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break

            source_frame = frame.copy()
            result = apply_video_review_effects(
                frame,
                mode=mode,
                blur_faces=blur_faces,
                blur_plates=blur_plates,
                blur_text=blur_text,
                allowlist_enabled=allowlist_enabled,
                character_id=character_id,
            )
            writer.write(result.image_bgr)
            frame_index = processed_frames
            processed_frames += 1
            detection_totals["faces_total"] += result.detections.faces_total
            detection_totals["faces_redacted"] += result.detections.faces_redacted
            detection_totals["plates_redacted"] += result.detections.plates_redacted
            detection_totals["text_regions_redacted"] += result.detections.text_regions_redacted

            blur_reduction = _blur_reduction_pct(source_frame, result.image_bgr, result.redacted_regions)
            if blur_reduction is not None:
                blur_reductions.append(blur_reduction)

            suspect_reasons = _suspect_reasons(
                mode=mode,
                allowlist_enabled=allowlist_enabled,
                faces_total=result.detections.faces_total,
                faces_redacted=result.detections.faces_redacted,
                primary_face=bool(result.primary_face),
                blur_reduction_pct=blur_reduction,
            )
            if suspect_reasons:
                suspect_frames.append(
                    {
                        "frame_index": frame_index,
                        "reasons": suspect_reasons,
                        "faces_total": result.detections.faces_total,
                        "faces_redacted": result.detections.faces_redacted,
                        "blur_reduction_pct": blur_reduction,
                    }
                )

            if len(contact_samples) < 6 and (frame_index == 0 or frame_index % sample_interval == 0):
                contact_samples.append((frame_index, source_frame, result.image_bgr.copy()))

            if processed_frames == 1:
                thumb_path = output_path.with_name(f"{output_path.stem}-thumb.jpg")
                cv2.imwrite(str(thumb_path), result.image_bgr)
                preview_thumbnail = thumb_path.name
    finally:
        capture.release()
        writer.release()

    if processed_frames == 0:
        raise VideoProcessingError("input video has no readable frames")

    contact_sheet = _write_contact_sheet(output_path, contact_samples)
    average_blur_reduction_pct = round(sum(blur_reductions) / len(blur_reductions), 2) if blur_reductions else None
    report_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_filename": upload_path.name,
        "result_filename": output_path.name,
        "mode": mode,
        "character_id": character_id,
        "analysis_id": analysis_id,
        "candidate_actions": candidate_actions or {},
        "processed_frames": processed_frames,
        "detection_totals": detection_totals,
        "average_blur_reduction_pct": average_blur_reduction_pct,
        "suspect_frames": suspect_frames[:50],
        "artifacts": {
            "preview_thumbnail": preview_thumbnail,
            "contact_sheet": contact_sheet,
        },
    }
    report_json = output_path.with_name(f"{output_path.stem}-qa-report.json")
    report_markdown = output_path.with_name(f"{output_path.stem}-qa-report.md")
    report_json.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    report_markdown.write_text(_markdown_report(report_payload), encoding="utf-8")

    return VideoProcessingSummary(
        processed_frames=processed_frames,
        preview_thumbnail=preview_thumbnail,
        contact_sheet=contact_sheet,
        qa_report_json=report_json.name,
        qa_report_markdown=report_markdown.name,
        detection_totals=detection_totals,
        average_blur_reduction_pct=average_blur_reduction_pct,
        suspect_frames=suspect_frames[:50],
    )


def _blur_reduction_pct(before: np.ndarray, after: np.ndarray, boxes: tuple[FaceBox, ...]) -> float | None:
    reductions: list[float] = []
    for box in boxes:
        before_roi = _box_roi(before, box)
        after_roi = _box_roi(after, box)
        if before_roi.size == 0 or after_roi.size == 0:
            continue
        before_score = _sharpness(before_roi)
        after_score = _sharpness(after_roi)
        if before_score <= 0.001:
            continue
        reductions.append(max(0.0, min(100.0, (before_score - after_score) / before_score * 100.0)))
    if not reductions:
        return None
    return round(sum(reductions) / len(reductions), 2)


def _box_roi(frame: np.ndarray, box: FaceBox) -> np.ndarray:
    height, width = frame.shape[:2]
    x1 = max(0, min(width - 1, box.x1))
    x2 = max(1, min(width, box.x2))
    y1 = max(0, min(height - 1, box.y1))
    y2 = max(1, min(height, box.y2))
    if x2 <= x1 or y2 <= y1:
        return np.empty((0, 0, 3), dtype=frame.dtype)
    return frame[y1:y2, x1:x2]


def _sharpness(frame: np.ndarray) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _suspect_reasons(
    *,
    mode: str,
    allowlist_enabled: bool,
    faces_total: int,
    faces_redacted: int,
    primary_face: bool,
    blur_reduction_pct: float | None,
) -> list[str]:
    review_mode = "blur" if mode == "video_privacy" else mode
    allowed_faces = 1 if allowlist_enabled and primary_face and review_mode in {"preserve", "character"} else 0
    expected_redactions = max(0, faces_total - allowed_faces)
    reasons: list[str] = []
    if faces_redacted < expected_redactions:
        reasons.append("expected_face_redaction_count_not_met")
    if blur_reduction_pct is not None and blur_reduction_pct < 25.0 and faces_redacted > 0:
        reasons.append("low_blur_strength")
    return reasons


def _write_contact_sheet(output_path: Path, samples: list[tuple[int, np.ndarray, np.ndarray]]) -> str | None:
    if not samples:
        return None
    rows = []
    for frame_index, before, after in samples:
        before_tile = _labeled_tile(before, f"F{frame_index} before")
        after_tile = _labeled_tile(after, f"F{frame_index} after")
        rows.append(cv2.hconcat([before_tile, after_tile]))
    sheet = cv2.vconcat(rows)
    sheet_path = output_path.with_name(f"{output_path.stem}-contact-sheet.jpg")
    cv2.imwrite(str(sheet_path), sheet)
    return sheet_path.name


def _labeled_tile(frame: np.ndarray, label: str, width: int = 220) -> np.ndarray:
    height, original_width = frame.shape[:2]
    scale = width / max(1, original_width)
    resized = cv2.resize(frame, (width, max(1, int(round(height * scale)))), interpolation=cv2.INTER_AREA)
    label_band = np.full((28, width, 3), (248, 250, 252), dtype=np.uint8)
    cv2.putText(label_band, label, (8, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (15, 23, 42), 1, cv2.LINE_AA)
    return cv2.vconcat([label_band, resized])


def _markdown_report(payload: dict[str, Any]) -> str:
    totals = payload["detection_totals"]
    suspects = payload["suspect_frames"]
    lines = [
        "# Redaction QA Report",
        "",
        f"- Generated at: {payload['generated_at']}",
        f"- Source: {payload['source_filename']}",
        f"- Result: {payload['result_filename']}",
        f"- Mode: {payload['mode']}",
        f"- Processed frames: {payload['processed_frames']}",
        f"- Faces detected: {totals['faces_total']}",
        f"- Faces redacted: {totals['faces_redacted']}",
        f"- Plates redacted: {totals['plates_redacted']}",
        f"- Text regions redacted: {totals['text_regions_redacted']}",
        f"- Average blur reduction pct: {payload['average_blur_reduction_pct']}",
        f"- Suspect frame count: {len(suspects)}",
        "",
        "## Suspect Frames",
        "",
    ]
    if not suspects:
        lines.append("No suspect frames were flagged by the baseline QA heuristics.")
    else:
        for suspect in suspects[:20]:
            reasons = ", ".join(suspect["reasons"])
            lines.append(f"- Frame {suspect['frame_index']}: {reasons}")
    lines.append("")
    return "\n".join(lines)
