from __future__ import annotations

from json import JSONDecodeError, loads
from pathlib import Path
from typing import BinaryIO

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import Settings
from app.repositories.job_repository import JobRecord, job_repository
from app.schemas.videos import VideoJobCreateData, VideoJobCreateRequest, VideoJobData, VideoJobProgress, VideoJobResult


class VideoJobService:
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

    def _copy_upload(self, file: UploadFile, target_path: Path) -> None:
        source: BinaryIO = file.file
        source.seek(0)
        with target_path.open("wb") as out:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

    def _to_job_data(self, record: JobRecord) -> VideoJobData:
        progress = VideoJobProgress.model_validate(record.progress)
        result = None
        if record.result is not None:
            result = VideoJobResult.model_validate(record.result)
        return VideoJobData(job_id=record.job_id, status=record.status, progress=progress, result=result)

    async def create_job(self, *, file: UploadFile, raw_config: str | None) -> VideoJobCreateData:
        config = self._parse_config(raw_config)
        upload_path = self.upload_dir / (file.filename or "upload.mp4")
        self._copy_upload(file, upload_path)
        record = job_repository.create(
            config=config.model_dump(),
            upload_path=str(upload_path),
            filename=file.filename or upload_path.name,
            content_type=file.content_type,
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
            self._ensure_result_artifact(record)
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
            output_path.write_bytes(Path(record.upload_path).read_bytes())
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
