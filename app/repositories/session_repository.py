from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
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
        self._storage_file: Path | None = None

    def configure_storage(self, data_dir: str) -> None:
        storage_file = Path(data_dir).resolve() / "state" / "sessions.json"
        with self._lock:
            if self._storage_file == storage_file:
                return
            self._storage_file = storage_file
            self._storage_file.parent.mkdir(parents=True, exist_ok=True)
            self._sessions = self._load_locked()

    def _load_locked(self) -> dict[str, SessionRecord]:
        if self._storage_file is None or not self._storage_file.exists():
            return {}
        try:
            raw_items = json.loads(self._storage_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

        sessions: dict[str, SessionRecord] = {}
        if not isinstance(raw_items, list):
            return sessions
        now = datetime.now(timezone.utc)
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            try:
                record = SessionRecord(
                    session_id=str(item["session_id"]),
                    mode=str(item["mode"]),
                    preset_id=item.get("preset_id"),
                    stream_profile=deepcopy(item.get("stream_profile", {})),
                    privacy_options=deepcopy(item.get("privacy_options", {})),
                    expires_at=datetime.fromisoformat(str(item["expires_at"])),
                    created_at=datetime.fromisoformat(str(item["created_at"])),
                    last_frame_meta=deepcopy(item.get("last_frame_meta")),
                )
            except (KeyError, TypeError, ValueError):
                continue
            if record.expires_at > now:
                sessions[record.session_id] = record
        return sessions

    def _persist_locked(self) -> None:
        if self._storage_file is None:
            return
        payload = [
            {
                "session_id": record.session_id,
                "mode": record.mode,
                "preset_id": record.preset_id,
                "stream_profile": deepcopy(record.stream_profile),
                "privacy_options": deepcopy(record.privacy_options),
                "expires_at": record.expires_at.isoformat(),
                "created_at": record.created_at.isoformat(),
                "last_frame_meta": deepcopy(record.last_frame_meta),
            }
            for record in self._sessions.values()
        ]
        self._storage_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

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
            self._persist_locked()
            return deepcopy(record)

    def get(self, session_id: str) -> SessionRecord | None:
        with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            if record.expires_at <= datetime.now(timezone.utc):
                self._sessions.pop(session_id, None)
                self._persist_locked()
                return None
            return deepcopy(record)

    def delete(self, session_id: str) -> bool:
        with self._lock:
            deleted = self._sessions.pop(session_id, None) is not None
            if deleted:
                self._persist_locked()
            return deleted

    def touch_frame(self, session_id: str, frame_meta: dict[str, Any]) -> SessionRecord | None:
        with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            record.last_frame_meta = deepcopy(frame_meta)
            self._persist_locked()
            return deepcopy(record)


session_repository = SessionRepository()
