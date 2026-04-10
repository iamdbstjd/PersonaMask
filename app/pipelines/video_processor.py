from __future__ import annotations

from pathlib import Path

import cv2

from app.pipelines.frame_processor import apply_privacy_effects


class VideoProcessingError(RuntimeError):
    pass


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
) -> tuple[int, str | None]:
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

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break

            result = apply_privacy_effects(
                frame,
                blur_faces=blur_faces,
                blur_plates=blur_plates,
                blur_text=blur_text,
                allowlist_enabled=allowlist_enabled,
            )
            writer.write(result.image_bgr)
            processed_frames += 1

            if processed_frames == 1:
                thumb_path = output_path.with_name(f"{output_path.stem}-thumb.jpg")
                cv2.imwrite(str(thumb_path), result.image_bgr)
                preview_thumbnail = thumb_path.name
    finally:
        capture.release()
        writer.release()

    if processed_frames == 0:
        raise VideoProcessingError("input video has no readable frames")

    return processed_frames, preview_thumbnail
