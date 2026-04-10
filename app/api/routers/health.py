from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.services.diagnostics_service import DiagnosticsService

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health(request: Request) -> dict[str, object]:
    settings = get_settings()
    payload = DiagnosticsService(settings).health_payload()
    return {
        "request_id": request.headers.get("X-Request-Id", "generated-health-request"),
        "data": payload,
        "error": None,
    }
