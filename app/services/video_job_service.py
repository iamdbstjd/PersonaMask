from __future__ import annotations

from json import JSONDecodeError, loads
from pathlib import Path
import re
import shutil
from typing import BinaryIO
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import Settings
from app.pipelines.video_processor import VideoProcessingError, probe_video, process_video_privacy
from app.repositories.job_repository import JobRecord, job_repository
from app.schemas.videos import (
    VideoCandidateAnalysisData,
    VideoFaceCandidateData,
    VideoJobCreateData,
    VideoJobCreateRequest,
    VideoJobData,
    VideoJobProgress,
    VideoJobResult,
)
from app.services.video_candidate_service import extract_video_face_candidates


class VideoJobService:
    SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
    MAX_UPLOAD_BYTES = 1024 * 1024 * 1024  # 1GB safety cap for local skeleton runtime
    SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.upload_dir = Path(settings.data_dir).resolve() / "uploads"
        self.output_dir = Path(settings.data_dir).resolve() / "outputs"
        self.candidate_dir = Path(settings.data_dir).resolve() / "candidates"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.candidate_dir.mkdir(parents=True, exist_ok=True)

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

    def _validate_video_upload(self, file: UploadFile, safe_filename: str) -> None:
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

    def _to_job_data(self, record: JobRecord) -> VideoJobData:
        progress = VideoJobProgress.model_validate(record.progress)
        result = None
        if record.result is not None:
            result = VideoJobResult.model_validate(record.result)
        return VideoJobData(job_id=record.job_id, status=record.status, progress=progress, result=result)

    async def create_job(self, *, file: UploadFile, raw_config: str | None) -> VideoJobCreateData:
        config = self._parse_config(raw_config)
        safe_filename = self._sanitize_filename(file.filename, "upload.mp4")
        self._validate_video_upload(file, safe_filename)

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

    async def create_candidate_analysis(self, *, file: UploadFile) -> VideoCandidateAnalysisData:
        safe_filename = self._sanitize_filename(file.filename, "upload.mp4")
        self._validate_video_upload(file, safe_filename)
        analysis_id = f"analysis_{uuid4().hex[:10]}"
        analysis_dir = self.candidate_dir / analysis_id
        faces_dir = analysis_dir / "faces"
        analysis_dir.mkdir(parents=True, exist_ok=True)
        upload_path = analysis_dir / safe_filename

        try:
            self._copy_upload(file, upload_path)
            _, _, width, height = probe_video(upload_path)
            if width <= 0 or height <= 0:
                raise VideoProcessingError("unable to infer video dimensions")
            candidates = extract_video_face_candidates(upload_path, faces_dir)
        except HTTPException:
            shutil.rmtree(analysis_dir, ignore_errors=True)
            raise
        except (VideoProcessingError, ValueError) as exc:
            shutil.rmtree(analysis_dir, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_VIDEO_FILE", "message": str(exc)},
            ) from exc

        return VideoCandidateAnalysisData(
            analysis_id=analysis_id,
            source_filename=safe_filename,
            candidates=[
                VideoFaceCandidateData(
                    candidate_id=candidate.candidate_id,
                    image_url=f"/api/v1/videos/candidates/{analysis_id}/{candidate.candidate_id}",
                    frame_index=candidate.frame_index,
                    bbox=candidate.bbox.as_list(),
                    confidence=candidate.confidence,
                )
                for candidate in candidates
            ],
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
        expected_artifacts = [
            output_path.with_name(f"{output_path.stem}-thumb.jpg"),
            output_path.with_name(f"{output_path.stem}-contact-sheet.jpg"),
            output_path.with_name(f"{output_path.stem}-qa-report.json"),
            output_path.with_name(f"{output_path.stem}-qa-report.md"),
        ]
        has_current_result = isinstance(record.result, dict) and "qa_summary" in record.result
        needs_processing = not output_path.exists() or not has_current_result or any(not path.exists() for path in expected_artifacts)

        if needs_processing:
            config = record.config
            privacy = config.get("privacy_options", {}) if isinstance(config, dict) else {}
            summary = process_video_privacy(
                upload_path=Path(record.upload_path),
                output_path=output_path,
                mode=str(config.get("mode", "video_privacy")) if isinstance(config, dict) else "video_privacy",
                blur_faces=bool(privacy.get("blur_faces", True)),
                blur_plates=bool(privacy.get("blur_plates", True)),
                blur_text=bool(privacy.get("blur_text", True)),
                allowlist_enabled=bool(privacy.get("allowlist_enabled", False)),
                character_id=str(config.get("character_id")) if isinstance(config, dict) and config.get("character_id") else None,
                analysis_id=str(config.get("analysis_id")) if isinstance(config, dict) and config.get("analysis_id") else None,
                candidate_actions=config.get("candidate_actions", {}) if isinstance(config, dict) else {},
            )
            expires_at = record.result.get("expires_at") if isinstance(record.result, dict) else None
            result_payload = {
                "download_url": f"/api/v1/videos/jobs/{record.job_id}/result",
                "preview_thumbnail_url": f"/api/v1/videos/jobs/{record.job_id}/thumbnail" if summary.preview_thumbnail else None,
                "contact_sheet_url": f"/api/v1/videos/jobs/{record.job_id}/contact-sheet" if summary.contact_sheet else None,
                "qa_report_json_url": f"/api/v1/videos/jobs/{record.job_id}/qa-report.json",
                "qa_report_markdown_url": f"/api/v1/videos/jobs/{record.job_id}/qa-report.md",
                "expires_at": expires_at,
                "qa_summary": {
                    "processed_frames": summary.processed_frames,
                    "detection_totals": summary.detection_totals,
                    "average_blur_reduction_pct": summary.average_blur_reduction_pct,
                    "suspect_frame_count": len(summary.suspect_frames),
                },
            }
            job_repository.update_status(
                record.job_id,
                status="completed",
                progress={
                    "percent": 100,
                    "processed_frames": summary.processed_frames,
                    "total_frames": max(summary.processed_frames, int(record.progress.get("total_frames", summary.processed_frames))),
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

    def build_job_artifact_response(self, job_id: str, artifact: str) -> FileResponse:
        record = job_repository.get(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        if record.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "JOB_NOT_READY", "message": "Video job artifact is not ready yet."},
            )
        output_path = self._ensure_result_artifact(record)
        artifact_path, media_type, filename = self._artifact_path(output_path, artifact)
        if not artifact_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "ARTIFACT_NOT_FOUND", "message": "Video job artifact was not found."},
            )
        return FileResponse(path=artifact_path, filename=filename, media_type=media_type)

    def _artifact_path(self, output_path: Path, artifact: str) -> tuple[Path, str, str]:
        if artifact == "thumbnail":
            path = output_path.with_name(f"{output_path.stem}-thumb.jpg")
            return path, "image/jpeg", path.name
        if artifact == "contact-sheet":
            path = output_path.with_name(f"{output_path.stem}-contact-sheet.jpg")
            return path, "image/jpeg", path.name
        if artifact == "qa-report.json":
            path = output_path.with_name(f"{output_path.stem}-qa-report.json")
            return path, "application/json", path.name
        if artifact == "qa-report.md":
            path = output_path.with_name(f"{output_path.stem}-qa-report.md")
            return path, "text/markdown", path.name
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": "Video job artifact was not found."},
        )

    def build_candidate_response(self, analysis_id: str, candidate_id: str) -> FileResponse:
        if not self.SAFE_ID.fullmatch(analysis_id) or not self.SAFE_ID.fullmatch(candidate_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CANDIDATE_NOT_FOUND", "message": "Video candidate was not found."},
            )
        candidate_path = (self.candidate_dir / analysis_id / "faces" / f"{candidate_id}.jpg").resolve()
        faces_dir = (self.candidate_dir / analysis_id / "faces").resolve()
        if not candidate_path.is_relative_to(faces_dir) or not candidate_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CANDIDATE_NOT_FOUND", "message": "Video candidate was not found."},
            )
        return FileResponse(path=candidate_path, media_type="image/jpeg")
