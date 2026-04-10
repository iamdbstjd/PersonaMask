from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.services.diagnostics_service import DiagnosticsService

router = APIRouter(tags=["diagnostics"])


@router.get("/diagnostics/runtime")
def get_runtime_diagnostics(request: Request) -> dict[str, object]:
    settings = get_settings()
    payload = DiagnosticsService(settings).diagnostics_payload()
    return {
        "request_id": request.headers.get("X-Request-Id", "generated-diagnostics-request"),
        "data": payload,
        "error": None,
    }
