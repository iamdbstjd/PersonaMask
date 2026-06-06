from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4


@dataclass
class JobRecord:
    job_id: str
    status: str
    config: dict[str, Any]
    upload_path: str
    filename: str
    content_type: str | None
    access_token: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    progress: dict[str, Any] = field(
        default_factory=lambda: {
            "percent": 0,
            "processed_frames": 0,
            "total_frames": 3000,
            "eta_sec": 90,
        }
    )
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


class JobRepository:
    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._lock = Lock()
        self._storage_file: Path | None = None

    def configure_storage(self, data_dir: str) -> None:
        storage_file = Path(data_dir).resolve() / "state" / "jobs.json"
        with self._lock:
            if self._storage_file == storage_file:
                return
            self._storage_file = storage_file
            self._storage_file.parent.mkdir(parents=True, exist_ok=True)
            self._jobs = self._load_locked()

    def _load_locked(self) -> dict[str, JobRecord]:
        if self._storage_file is None or not self._storage_file.exists():
            return {}
        try:
            raw_items = json.loads(self._storage_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

        jobs: dict[str, JobRecord] = {}
        if not isinstance(raw_items, list):
            return jobs
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            try:
                status = str(item["status"])
                if status == "processing":
                    status = "queued"
                record = JobRecord(
                    job_id=str(item["job_id"]),
                    status=status,
                    config=deepcopy(item.get("config", {})),
                    upload_path=str(item["upload_path"]),
                    filename=str(item["filename"]),
                    content_type=item.get("content_type"),
                    access_token=str(item["access_token"]),
                    created_at=datetime.fromisoformat(str(item["created_at"])),
                    updated_at=datetime.fromisoformat(str(item["updated_at"])),
                    progress=deepcopy(item.get("progress", {})),
                    result=deepcopy(item.get("result")),
                    error=deepcopy(item.get("error")),
                )
            except (KeyError, TypeError, ValueError):
                continue
            jobs[record.job_id] = record
        return jobs

    def _persist_locked(self) -> None:
        if self._storage_file is None:
            return
        payload = [
            {
                "job_id": record.job_id,
                "status": record.status,
                "config": deepcopy(record.config),
                "upload_path": record.upload_path,
                "filename": record.filename,
                "content_type": record.content_type,
                "access_token": record.access_token,
                "created_at": record.created_at.isoformat(),
                "updated_at": record.updated_at.isoformat(),
                "progress": deepcopy(record.progress),
                "result": deepcopy(record.result),
                "error": deepcopy(record.error),
            }
            for record in self._jobs.values()
        ]
        self._storage_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def create(
        self,
        *,
        job_id: str | None = None,
        config: dict[str, Any],
        upload_path: str,
        filename: str,
        content_type: str | None,
        access_token: str,
        total_frames: int = 3000,
    ) -> JobRecord:
        record = JobRecord(
            job_id=job_id or f"job_{uuid4().hex[:8]}",
            status="queued",
            config=deepcopy(config),
            upload_path=upload_path,
            filename=filename,
            content_type=content_type,
            access_token=access_token,
            progress={
                "percent": 0,
                "processed_frames": 0,
                "total_frames": max(1, int(total_frames or 1)),
                "eta_sec": 90,
            },
        )
        with self._lock:
            self._jobs[record.job_id] = record
            self._persist_locked()
            return deepcopy(record)

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            record = self._jobs.get(job_id)
            return deepcopy(record) if record is not None else None

    def update_status(
        self,
        job_id: str,
        *,
        status: str,
        progress: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        error: dict[str, Any] | None = None,
    ) -> JobRecord | None:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None:
                return None
            record.status = status
            if progress is not None:
                record.progress = deepcopy(progress)
            if result is not None:
                record.result = deepcopy(result)
            if error is not None:
                record.error = deepcopy(error)
            record.updated_at = datetime.now(timezone.utc)
            self._persist_locked()
            return deepcopy(record)

    def try_mark_processing(self, job_id: str) -> JobRecord | None:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None or record.status != "queued":
                return None
            total_frames = int(record.progress.get("total_frames", 1))
            record.status = "processing"
            record.progress = {
                "percent": 1,
                "processed_frames": 0,
                "total_frames": total_frames,
                "eta_sec": max(1, int(total_frames / 30)),
            }
            record.updated_at = datetime.now(timezone.utc)
            self._persist_locked()
            return deepcopy(record)

    def complete(
        self,
        job_id: str,
        *,
        progress: dict[str, Any],
        result: dict[str, Any],
    ) -> JobRecord | None:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None:
                return None
            if record.status == "cancelled":
                return deepcopy(record)
            record.status = "completed"
            record.progress = deepcopy(progress)
            record.result = deepcopy(result)
            record.error = None
            record.updated_at = datetime.now(timezone.utc)
            self._persist_locked()
            return deepcopy(record)

    def cancel(self, job_id: str) -> JobRecord | None:
        total_frames = 3000
        current = self.get(job_id)
        if current is not None:
            total_frames = int(current.progress.get("total_frames", 3000))
        return self.update_status(
            job_id,
            status="cancelled",
            progress={"percent": 0, "processed_frames": 0, "total_frames": total_frames, "eta_sec": 0},
        )

    def get_queue_depth(self) -> int:
        with self._lock:
            return sum(1 for record in self._jobs.values() if record.status in {"queued", "processing"})

    def list_by_status(self, statuses: set[str]) -> list[JobRecord]:
        with self._lock:
            return [deepcopy(record) for record in self._jobs.values() if record.status in statuses]


job_repository = JobRepository()
