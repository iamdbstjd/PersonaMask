from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ErrorObject(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class HealthPayload(BaseModel):
    status: str
    app_name: str
    app_env: str
    gpu: dict[str, Any]


class DiagnosticsPayload(BaseModel):
    status: str
    settings: dict[str, Any]
    runtime: dict[str, Any]
    paths: dict[str, str]


class PresetItem(BaseModel):
    preset_id: str
    label: str
    mode: str = Field(default="character")
    thumbnail_url: str
    supports_realtime: bool = True
