from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AllowlistFaceData(BaseModel):
    person_id: str
    label: str
    note: str | None = None
    filename: str
    embedding_status: str = "created"
    created_at: datetime


class AllowlistFaceListData(BaseModel):
    items: list[AllowlistFaceData]


class AllowlistDeleteData(BaseModel):
    person_id: str
    deleted: bool


class ApiEnvelope(BaseModel):
    request_id: str
    data: dict[str, Any] | BaseModel | None
    error: dict[str, Any] | None = None
