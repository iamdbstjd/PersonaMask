from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

FacePoseSlot = Literal["front", "left_45", "right_45", "left_profile", "right_profile"]


class AllowlistFaceData(BaseModel):
    person_id: str
    label: str
    note: str | None = None
    filename: str
    enrollment_id: str | None = None
    pose_slot: FacePoseSlot | None = None
    embedding_status: str = "created"
    created_at: datetime


class AllowlistFaceListData(BaseModel):
    items: list[AllowlistFaceData]


class FacePoseEstimateData(BaseModel):
    detected: bool
    pose_slot: FacePoseSlot | None = None
    pose_label: str | None = None
    confidence: float = 0.0
    face_bbox: list[int] | None = None
    already_captured: bool = False
    completed_count: int = 0
    required_count: int = 5
    next_slots: list[FacePoseSlot] = []
    guidance: str


class AllowlistDeleteData(BaseModel):
    person_id: str
    deleted: bool


class ApiEnvelope(BaseModel):
    request_id: str
    data: dict[str, Any] | BaseModel | None
    error: dict[str, Any] | None = None
