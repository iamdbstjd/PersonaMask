from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


RealtimeMode = Literal["character", "privacy"]
ResponseMode = Literal["binary_jpeg", "json_base64"]


class StreamProfile(BaseModel):
    target_fps: int = Field(default=8, ge=1, le=30)
    frame_width: int = Field(default=960, ge=160, le=4096)
    jpeg_quality: float = Field(default=0.72, ge=0.1, le=1.0)
    response_mode: ResponseMode = "binary_jpeg"


class PrivacyOptions(BaseModel):
    blur_faces: bool = True
    blur_plates: bool = False
    blur_text: bool = False
    allowlist_enabled: bool = False


class RealtimeSessionCreateRequest(BaseModel):
    mode: RealtimeMode
    preset_id: str | None = None
    stream_profile: StreamProfile = Field(default_factory=StreamProfile)
    privacy_options: PrivacyOptions = Field(default_factory=PrivacyOptions)


class RealtimeSessionData(BaseModel):
    session_id: str
    mode: RealtimeMode
    accepted_profile: StreamProfile
    frame_endpoint: str
    expires_in_sec: int = 1800


class FrameMeta(BaseModel):
    frame_id: int = Field(default=0, ge=0)
    timestamp_ms: int | None = None
    client_width: int | None = None
    client_height: int | None = None
    rotation_deg: int = 0
    mode: RealtimeMode | None = None


class DetectionCounts(BaseModel):
    faces_total: int = 0
    faces_redacted: int = 0
    plates_redacted: int = 0
    text_regions_redacted: int = 0


class PrimaryFace(BaseModel):
    bbox: list[int] | None = None
    preset_id: str | None = None


class FrameResultMeta(BaseModel):
    frame_id: int
    server_latency_ms: int
    detections: DetectionCounts
    primary_face: PrimaryFace | None = None
    mode: RealtimeMode
    session_id: str


class JsonFrameData(BaseModel):
    frame_id: int
    mime_type: str = "image/jpeg"
    processed_image_base64: str
    server_latency_ms: int
    detections: DetectionCounts
    primary_face: PrimaryFace | None = None


class ApiEnvelope(BaseModel):
    request_id: str
    data: dict[str, Any] | BaseModel | None
    error: dict[str, Any] | None = None
