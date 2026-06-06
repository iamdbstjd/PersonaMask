from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


VideoJobMode = Literal["video_privacy", "blur", "preserve", "character"]
VideoJobStatus = Literal["queued", "processing", "completed", "failed", "cancelled"]
CandidateAction = Literal["preserve", "character", "blur", "track"]


class VideoPrivacyOptions(BaseModel):
    blur_faces: bool = True
    blur_plates: bool = True
    blur_text: bool = True
    allowlist_enabled: bool = False


class VideoOutputOptions(BaseModel):
    container: Literal["mp4"] = "mp4"
    video_codec: Literal["mp4v"] = "mp4v"
    keep_audio: bool = False


class VideoJobCreateRequest(BaseModel):
    mode: VideoJobMode = "blur"
    character_id: str | None = None
    analysis_id: str | None = None
    candidate_access_token: str | None = None
    candidate_actions: dict[str, CandidateAction] = Field(default_factory=dict)
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
    contact_sheet_url: str | None = None
    qa_report_json_url: str | None = None
    qa_report_markdown_url: str | None = None
    qa_summary: dict[str, Any] | None = None
    expires_at: datetime | None = None


class VideoJobData(BaseModel):
    job_id: str
    status: VideoJobStatus
    progress: VideoJobProgress
    result: VideoJobResult | None = None


class VideoJobCreateData(BaseModel):
    job_id: str
    status: VideoJobStatus
    access_token: str
    status_endpoint: str
    cancel_endpoint: str


class VideoFaceCandidateData(BaseModel):
    candidate_id: str
    image_url: str
    frame_index: int
    bbox: list[int]
    confidence: float = 1.0


class VideoCandidateAnalysisData(BaseModel):
    analysis_id: str
    access_token: str
    source_filename: str
    candidates: list[VideoFaceCandidateData]


class ApiEnvelope(BaseModel):
    request_id: str
    data: dict[str, Any] | BaseModel | None
    error: dict[str, Any] | None = None
