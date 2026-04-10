from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import Settings
from app.schemas.allowlist import AllowlistDeleteData, AllowlistFaceData, AllowlistFaceListData


class AllowlistService:
    _lock = Lock()
    _items: dict[str, AllowlistFaceData] = {}

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.storage_dir = Path(settings.data_dir).resolve() / "allowlist"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    async def register_face(self, *, image: UploadFile, label: str, note: str | None) -> AllowlistFaceData:
        person_id = f"person_{uuid4().hex[:8]}"
        suffix = Path(image.filename or "face.jpg").suffix or ".jpg"
        filename = f"{person_id}{suffix}"
        target_path = self.storage_dir / filename
        content = await image.read()
        target_path.write_bytes(content)

        item = AllowlistFaceData(
            person_id=person_id,
            label=label,
            note=note,
            filename=filename,
            created_at=datetime.now(timezone.utc),
        )
        with self._lock:
            self._items[person_id] = item
        return item

    def list_faces(self) -> AllowlistFaceListData:
        with self._lock:
            items = sorted(self._items.values(), key=lambda item: item.created_at, reverse=True)
        return AllowlistFaceListData(items=list(items))

    def delete_face(self, person_id: str) -> AllowlistDeleteData:
        with self._lock:
            item = self._items.pop(person_id, None)
        if item is not None:
            target_path = self.storage_dir / item.filename
            if target_path.exists():
                target_path.unlink()
        return AllowlistDeleteData(person_id=person_id, deleted=item is not None)
