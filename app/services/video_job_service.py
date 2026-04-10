from __future__ import annotations

from json import JSONDecodeError, loads
from pathlib import Path
import re
from typing import BinaryIO

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import Settings
from app.pipelines.video_processor import VideoProcessingError, probe_video, process_video_privacy
from app.repositories.job_repository import JobRecord, job_repository
from app.schemas.videos import VideoJobCreateData, VideoJobCreateRequest, VideoJobData, VideoJobProgress, VideoJobResult


class VideoJobService:
    SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
    MAX_UPLOAD_BYTES = 1024 * 1024 * 1024  # 1GB safety cap for local skeleton runtime

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.upload_dir = Path(settings.data_dir).resolve() / "uploads"
        self.output_dir = Path(settings.data_dir).resolve() / "outputs"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _parse_config(self, raw_config: str | None) -> VideoJobCreateRequest:
        if not raw_config:
            return VideoJobCreateRequest()
        try:
            return VideoJobCreateRequest.model_validate(loads(raw_config))
        except JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_CONFIG", "message": "config must be valid JSON.", "details": {"error": str(exc)}},
            ) from exc

    def _sanitize_filename(self, filename: str | None, fallback: str) -> str:
        base = Path(filename or fallback).name
        sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
        return sanitized or fallback

    def _copy_upload(self, file: UploadFile, target_path: Path) -> int:
        source: BinaryIO = file.file
        source.seek(0)
        total_bytes = 0
        with target_path.open("wb") as out:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > self.MAX_UPLOAD_BYTES:
                    target_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail={
                            "code": "VIDEO_TOO_LARGE",
                            "message": f"video upload must be <= {self.MAX_UPLOAD_BYTES} bytes",
                        },
                    )
                out.write(chunk)
        return total_bytes

    def _to_job_data(self, record: JobRecord) -> VideoJobData:
        progress = VideoJobProgress.model_validate(record.progress)
        result = None
        if record.result is not None:
            result = VideoJobResult.model_validate(record.result)
        return VideoJobData(job_id=record.job_id, status=record.status, progress=progress, result=result)

    async def create_job(self, *, file: UploadFile, raw_config: str | None) -> VideoJobCreateData:
        config = self._parse_config(raw_config)
        safe_filename = self._sanitize_filename(file.filename, "upload.mp4")
        suffix = Path(safe_filename).suffix.lower()
        if suffix not in self.SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "UNSUPPORTED_VIDEO_FORMAT",
                    "message": f"unsupported extension '{suffix or '(none)'}'; expected one of {sorted(self.SUPPORTED_EXTENSIONS)}",
                },
            )
        if file.content_type and not file.content_type.startswith("video/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "multipart file must be a video media type"},
            )

        upload_path = self.upload_dir / safe_filename
        self._copy_upload(file, upload_path)
        try:
            total_frames, _, width, height = probe_video(upload_path)
        except VideoProcessingError as exc:
            upload_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_VIDEO_FILE", "message": str(exc)},
            ) from exc
        if width <= 0 or height <= 0:
            upload_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_VIDEO_FILE", "message": "unable to infer video dimensions"},
            )

        record = job_repository.create(
            config=config.model_dump(),
            upload_path=str(upload_path),
            filename=safe_filename,
            content_type=file.content_type,
            total_frames=total_frames if total_frames > 0 else 3000,
        )
        return VideoJobCreateData(
            job_id=record.job_id,
            status=record.status,
            status_endpoint=f"/api/v1/videos/jobs/{record.job_id}",
            cancel_endpoint=f"/api/v1/videos/jobs/{record.job_id}/cancel",
        )

    def get_job(self, job_id: str) -> VideoJobData:
        record = job_repository.advance(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        if record.status == "completed":
            try:
                self._ensure_result_artifact(record)
            except VideoProcessingError as exc:
                updated = job_repository.update_status(
                    record.job_id,
                    status="failed",
                    error={"code": "VIDEO_PROCESSING_FAILED", "message": str(exc)},
                )
                if updated is not None:
                    record = updated
        return self._to_job_data(record)

    def cancel_job(self, job_id: str) -> VideoJobData:
        record = job_repository.cancel(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        return self._to_job_data(record)

    def _ensure_result_artifact(self, record: JobRecord) -> Path:
        output_path = self.output_dir / f"{record.job_id}-{record.filename}"
        if not output_path.exists():
            config = record.config
            privacy = config.get("privacy_options", {}) if isinstance(config, dict) else {}
            processed_frames, preview_thumbnail = process_video_privacy(
                upload_path=Path(record.upload_path),
                output_path=output_path,
                blur_faces=bool(privacy.get("blur_faces", True)),
                blur_plates=bool(privacy.get("blur_plates", True)),
                blur_text=bool(privacy.get("blur_text", True)),
                allowlist_enabled=bool(privacy.get("allowlist_enabled", False)),
            )
            expires_at = record.result.get("expires_at") if isinstance(record.result, dict) else None
            result_payload = {
                "download_url": f"/api/v1/videos/jobs/{record.job_id}/result",
                "preview_thumbnail_url": f"/data/outputs/{preview_thumbnail}" if preview_thumbnail else None,
                "expires_at": expires_at,
            }
            job_repository.update_status(
                record.job_id,
                status="completed",
                progress={
                    "percent": 100,
                    "processed_frames": processed_frames,
                    "total_frames": max(processed_frames, int(record.progress.get("total_frames", processed_frames))),
                    "eta_sec": 0,
                },
                result=result_payload,
            )
        return output_path

    def build_result_response(self, job_id: str) -> FileResponse:
        record = job_repository.get(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        if record.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "JOB_NOT_READY", "message": "Video job result is not ready yet."},
            )
        output_path = self._ensure_result_artifact(record)
        return FileResponse(path=output_path, filename=output_path.name, media_type=record.content_type or "video/mp4")
