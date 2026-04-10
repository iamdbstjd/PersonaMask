from __future__ import annotations

import base64
from json import JSONDecodeError, loads
from time import perf_counter
from typing import Any

from fastapi import HTTPException, UploadFile, status

from app.repositories.session_repository import session_repository
from app.schemas.realtime import (
    DetectionCounts,
    FrameMeta,
    FrameResultMeta,
    JsonFrameData,
    PrimaryFace,
    RealtimeSessionCreateRequest,
    RealtimeSessionData,
)


class RealtimeService:
    def create_session(self, payload: RealtimeSessionCreateRequest) -> RealtimeSessionData:
        if payload.mode == "character" and not payload.preset_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_PRESET", "message": "preset_id is required for character mode."},
            )

        record = session_repository.create(
            mode=payload.mode,
            preset_id=payload.preset_id,
            stream_profile=payload.stream_profile.model_dump(),
            privacy_options=payload.privacy_options.model_dump(),
        )
        return RealtimeSessionData(
            session_id=record.session_id,
            mode=payload.mode,
            accepted_profile=payload.stream_profile,
            frame_endpoint=f"/api/v1/realtime/sessions/{record.session_id}/frames",
            expires_in_sec=1800,
        )

    def delete_session(self, session_id: str) -> bool:
        return session_repository.delete(session_id)

    def _load_meta(self, raw_meta: str | None, fallback_mode: str) -> FrameMeta:
        if not raw_meta:
            return FrameMeta(mode=fallback_mode)
        try:
            data = loads(raw_meta)
        except JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_META", "message": "meta must be valid JSON.", "details": {"error": str(exc)}},
            ) from exc
        if "mode" not in data or data["mode"] is None:
            data["mode"] = fallback_mode
        return FrameMeta.model_validate(data)

    async def process_frame(self, *, session_id: str, frame: UploadFile, raw_meta: str | None) -> dict[str, Any]:
        session = session_repository.get(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Realtime session was not found or expired."},
            )

        started = perf_counter()
        meta = self._load_meta(raw_meta, session.mode)
        frame_bytes = await frame.read()
        server_latency_ms = max(1, int((perf_counter() - started) * 1000))

        faces_total = 1 if frame_bytes else 0
        allowlist_enabled = bool(session.privacy_options.get("allowlist_enabled", False))
        detections = DetectionCounts(
            faces_total=faces_total,
            faces_redacted=1 if session.mode == "privacy" and faces_total and not allowlist_enabled else 0,
            plates_redacted=1 if session.mode == "privacy" and session.privacy_options.get("blur_plates") else 0,
            text_regions_redacted=1 if session.mode == "privacy" and session.privacy_options.get("blur_text") else 0,
        )
        primary_face = PrimaryFace(bbox=[120, 90, 320, 310], preset_id=session.preset_id if session.mode == "character" else None)
        result_meta = FrameResultMeta(
            frame_id=meta.frame_id,
            server_latency_ms=server_latency_ms,
            detections=detections,
            primary_face=primary_face,
            mode=session.mode,
            session_id=session.session_id,
        )
        session_repository.touch_frame(session_id, result_meta.model_dump())

        return {
            "response_mode": session.stream_profile.get("response_mode", "binary_jpeg"),
            "content": frame_bytes,
            "frame_meta": result_meta,
            "json_data": JsonFrameData(
                frame_id=meta.frame_id,
                processed_image_base64=base64.b64encode(frame_bytes).decode("ascii"),
                server_latency_ms=server_latency_ms,
                detections=detections,
                primary_face=primary_face,
            ),
        }
