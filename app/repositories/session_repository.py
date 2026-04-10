from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any
from uuid import uuid4


@dataclass
class SessionRecord:
    session_id: str
    mode: str
    preset_id: str | None
    stream_profile: dict[str, Any]
    privacy_options: dict[str, Any]
    expires_at: datetime
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_frame_meta: dict[str, Any] | None = None


class SessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}
        self._lock = Lock()

    def create(
        self,
        *,
        mode: str,
        preset_id: str | None,
        stream_profile: dict[str, Any],
        privacy_options: dict[str, Any],
        ttl_seconds: int = 1800,
    ) -> SessionRecord:
        record = SessionRecord(
            session_id=f"rt_sess_{uuid4().hex[:8]}",
            mode=mode,
            preset_id=preset_id,
            stream_profile=deepcopy(stream_profile),
            privacy_options=deepcopy(privacy_options),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
        )
        with self._lock:
            self._sessions[record.session_id] = record
        return record

    def get(self, session_id: str) -> SessionRecord | None:
        with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            if record.expires_at <= datetime.now(timezone.utc):
                self._sessions.pop(session_id, None)
                return None
            return record

    def delete(self, session_id: str) -> bool:
        with self._lock:
            return self._sessions.pop(session_id, None) is not None

    def touch_frame(self, session_id: str, frame_meta: dict[str, Any]) -> SessionRecord | None:
        with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            record.last_frame_meta = deepcopy(frame_meta)
            return record


session_repository = SessionRepository()
