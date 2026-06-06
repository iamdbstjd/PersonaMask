from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import UploadFile
from fastapi import HTTPException, status

from app.core.config import Settings
from app.pipelines.frame_processor import decode_image_bytes
from app.schemas.allowlist import AllowlistDeleteData, AllowlistFaceData, AllowlistFaceListData


class AllowlistService:
    _lock = Lock()
    _items: dict[str, AllowlistFaceData] = {}

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.storage_dir = Path(settings.data_dir).resolve() / "allowlist"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    async def _read_image_upload(self, image: UploadFile) -> bytes:
        if image.content_type and not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "allowlist upload must be an image media type"},
            )
        content = await image.read(self.settings.max_allowlist_image_bytes + 1)
        if len(content) > self.settings.max_allowlist_image_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail={
                    "code": "IMAGE_TOO_LARGE",
                    "message": f"allowlist image upload must be <= {self.settings.max_allowlist_image_bytes} bytes",
                },
            )
        try:
            decode_image_bytes(content)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_IMAGE_FILE", "message": str(exc)},
            ) from exc
        return content

    async def register_face(self, *, image: UploadFile, label: str, note: str | None) -> AllowlistFaceData:
        person_id = f"person_{uuid4().hex[:8]}"
        suffix = Path(image.filename or "face.jpg").suffix or ".jpg"
        filename = f"{person_id}{suffix}"
        target_path = self.storage_dir / filename
        content = await self._read_image_upload(image)
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
