from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
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

    def create(
        self,
        *,
        config: dict[str, Any],
        upload_path: str,
        filename: str,
        content_type: str | None,
        total_frames: int = 3000,
    ) -> JobRecord:
        record = JobRecord(
            job_id=f"job_{uuid4().hex[:8]}",
            status="queued",
            config=deepcopy(config),
            upload_path=upload_path,
            filename=filename,
            content_type=content_type,
            progress={
                "percent": 0,
                "processed_frames": 0,
                "total_frames": max(1, int(total_frames or 1)),
                "eta_sec": 90,
            },
        )
        with self._lock:
            self._jobs[record.job_id] = record
        return record

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

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
            return record

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

    def advance(self, job_id: str) -> JobRecord | None:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None or record.status in {"completed", "failed", "cancelled"}:
                return record

            age = (datetime.now(timezone.utc) - record.created_at).total_seconds()
            if age < 1.0:
                total_frames = int(record.progress.get("total_frames", 3000))
                record.status = "queued"
                record.progress = {
                    "percent": 5,
                    "processed_frames": max(1, int(total_frames * 0.05)),
                    "total_frames": total_frames,
                    "eta_sec": 80,
                }
            elif age < 2.0:
                total_frames = int(record.progress.get("total_frames", 3000))
                record.status = "processing"
                record.progress = {
                    "percent": 45,
                    "processed_frames": max(1, int(total_frames * 0.45)),
                    "total_frames": total_frames,
                    "eta_sec": 40,
                }
            else:
                total_frames = int(record.progress.get("total_frames", 3000))
                record.status = "completed"
                record.progress = {
                    "percent": 100,
                    "processed_frames": total_frames,
                    "total_frames": total_frames,
                    "eta_sec": 0,
                }
                if record.result is None:
                    expires_at = datetime.now(timezone.utc) + timedelta(days=1)
                    record.result = {
                        "download_url": f"/api/v1/videos/jobs/{job_id}/result",
                        "preview_thumbnail_url": f"/data/outputs/{job_id}-thumb.jpg",
                        "expires_at": expires_at,
                    }
            record.updated_at = datetime.now(timezone.utc)
            return record

    def get_queue_depth(self) -> int:
        with self._lock:
            return sum(1 for record in self._jobs.values() if record.status in {"queued", "processing"})


job_repository = JobRepository()
