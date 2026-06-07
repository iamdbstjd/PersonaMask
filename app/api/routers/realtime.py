from __future__ import annotations

import json

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from app.core.config import get_settings
from app.services.allowlist_service import AllowlistService
from app.services.realtime_service import RealtimeService
from app.schemas.realtime import RealtimeSessionCreateRequest

router = APIRouter(tags=["realtime"])


def _request_id(request: Request, fallback: str) -> str:
    return request.headers.get("X-Request-Id", fallback)


@router.post("/realtime/sessions")
def create_realtime_session(payload: RealtimeSessionCreateRequest, request: Request) -> dict[str, object]:
    service = RealtimeService(get_settings())
    session = service.create_session(payload)
    return {"request_id": _request_id(request, "generated-rt-session-request"), "data": session.model_dump(), "error": None}


@router.delete("/realtime/sessions/{session_id}")
def delete_realtime_session(session_id: str, request: Request) -> dict[str, object]:
    service = RealtimeService(get_settings())
    deleted = service.delete_session(session_id)
    return {
        "request_id": _request_id(request, "generated-rt-session-delete-request"),
        "data": {"session_id": session_id, "deleted": deleted},
        "error": None,
    }


@router.post("/realtime/face-pose")
async def estimate_realtime_face_pose(
    request: Request,
    frame: UploadFile = File(...),
    completed_slots: str | None = Form(default=None),
) -> dict[str, object]:
    service = AllowlistService(get_settings())
    pose = await service.estimate_face_pose(image=frame, completed_slots=completed_slots)
    return {"request_id": _request_id(request, "generated-face-pose-request"), "data": pose.model_dump(), "error": None}


@router.post("/realtime/sessions/{session_id}/frames")
async def process_realtime_frame(
    session_id: str,
    request: Request,
    frame: UploadFile = File(...),
    meta: str | None = Form(default=None),
):
    service = RealtimeService(get_settings())
    result = await service.process_frame(session_id=session_id, frame=frame, raw_meta=meta)
    request_id = _request_id(request, f"req_frame_{result['frame_meta'].frame_id}")

    if result["response_mode"] == "json_base64":
        payload = {
            "request_id": request_id,
            "data": result["json_data"].model_dump(),
            "error": None,
        }
        return JSONResponse(content=payload)

    headers = {
        "X-Request-Id": request_id,
        "X-Frame-Meta": json.dumps(result["frame_meta"].model_dump(), ensure_ascii=False),
        "X-Trace-Latency-Ms": str(result["frame_meta"].server_latency_ms),
    }
    return Response(content=result["content"], media_type="image/jpeg", headers=headers)
