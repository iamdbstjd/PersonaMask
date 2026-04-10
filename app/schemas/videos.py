from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


VideoJobMode = Literal["video_privacy"]
VideoJobStatus = Literal["queued", "processing", "completed", "failed", "cancelled"]


class VideoPrivacyOptions(BaseModel):
    blur_faces: bool = True
    blur_plates: bool = True
    blur_text: bool = True
    allowlist_enabled: bool = False


class VideoOutputOptions(BaseModel):
    container: str = "mp4"
    video_codec: str = "h264"
    keep_audio: bool = True


class VideoJobCreateRequest(BaseModel):
    mode: VideoJobMode = "video_privacy"
    privacy_options: VideoPrivacyOptions = Field(default_factory=VideoPrivacyOptions)
    output_options: VideoOutputOptions = Field(default_factory=VideoOutputOptions)


class VideoJobProgress(BaseModel):
    percent: int = Field(default=0, ge=0, le=100)
    processed_frames: int = Field(default=0, ge=0)
    total_frames: int = Field(default=0, ge=0)
    eta_sec: int = Field(default=0, ge=0)


class VideoJobResult(BaseModel):
    download_url: str
    preview_thumbnail_url: str | None = None
    expires_at: datetime | None = None


class VideoJobData(BaseModel):
    job_id: str
    status: VideoJobStatus
    progress: VideoJobProgress
    result: VideoJobResult | None = None


class VideoJobCreateData(BaseModel):
    job_id: str
    status: VideoJobStatus
    status_endpoint: str
    cancel_endpoint: str


class ApiEnvelope(BaseModel):
    request_id: str
    data: dict[str, Any] | BaseModel | None
    error: dict[str, Any] | None = None
