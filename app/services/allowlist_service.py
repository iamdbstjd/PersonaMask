from __future__ import annotations

from datetime import datetime, timezone
from json import JSONDecodeError, loads
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import UploadFile
from fastapi import HTTPException, status

from app.core.config import Settings
from app.pipelines.frame_processor import CandidateReference, FaceBox, decode_image_bytes, detect_face_details
from app.schemas.allowlist import (
    AllowlistDeleteData,
    AllowlistFaceData,
    AllowlistFaceListData,
    FacePoseEstimateData,
    FacePoseSlot,
)


POSE_SLOT_LABELS: dict[FacePoseSlot, str] = {
    "front": "정면",
    "left_45": "왼쪽 45도",
    "right_45": "오른쪽 45도",
    "left_profile": "왼쪽 측면",
    "right_profile": "오른쪽 측면",
}
POSE_SLOT_ORDER: tuple[FacePoseSlot, ...] = ("front", "left_45", "right_45", "left_profile", "right_profile")


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
        content = image.file.read(self.settings.max_allowlist_image_bytes + 1)
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

    def _parse_completed_slots(self, raw_slots: str | None) -> set[FacePoseSlot]:
        if not raw_slots:
            return set()
        try:
            decoded = loads(raw_slots)
        except JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_COMPLETED_SLOTS", "message": "completed_slots must be a JSON array."},
            ) from exc
        if not isinstance(decoded, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_COMPLETED_SLOTS", "message": "completed_slots must be a JSON array."},
            )
        return {slot for slot in decoded if slot in POSE_SLOT_LABELS}

    def _normalize_pose_slot(self, pose_slot: str | None) -> FacePoseSlot | None:
        if not pose_slot:
            return None
        if pose_slot not in POSE_SLOT_LABELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_POSE_SLOT", "message": "pose_slot is not a supported guided capture slot."},
            )
        return pose_slot  # type: ignore[return-value]

    def _estimate_pose_slot(self, image_bgr, face: FaceBox) -> tuple[FacePoseSlot, float]:
        _, width = image_bgr.shape[:2]
        center_x = (face.x1 + face.x2) / 2
        center_offset = 0.0 if width <= 0 else (center_x - (width / 2)) / (width / 2)
        aspect_ratio = face.width / max(1, face.height)
        face_width_ratio = face.width / max(1, width)

        if face_width_ratio < 0.16:
            return "front", 0.48
        if aspect_ratio >= 0.82 and abs(center_offset) <= 0.18:
            return "front", 0.88
        if aspect_ratio >= 0.68 and abs(center_offset) <= 0.48:
            return ("left_45" if center_offset < 0 else "right_45"), 0.74
        return ("left_profile" if center_offset < 0 else "right_profile"), 0.66

    async def estimate_face_pose(self, *, image: UploadFile, completed_slots: str | None) -> FacePoseEstimateData:
        content = await self._read_image_upload(image)
        image_bgr = decode_image_bytes(content)
        completed = self._parse_completed_slots(completed_slots)
        remaining_slots = [slot for slot in POSE_SLOT_ORDER if slot not in completed]
        detections = detect_face_details(image_bgr)

        if not detections:
            return FacePoseEstimateData(
                detected=False,
                completed_count=len(completed),
                next_slots=remaining_slots,
                guidance="얼굴을 화면 중앙에 맞춘 뒤 다시 캡처하세요.",
            )

        largest = max(detections, key=lambda detection: detection.box.area)
        pose_slot, confidence = self._estimate_pose_slot(image_bgr, largest.box)
        already_captured = pose_slot in completed
        if largest.box.width / max(1, image_bgr.shape[1]) < 0.16:
            guidance = "얼굴이 너무 작습니다. 카메라에 조금 더 가까이 다가가세요."
        elif already_captured:
            guidance = f"{POSE_SLOT_LABELS[pose_slot]} 슬롯은 이미 저장했습니다. 다른 각도로 천천히 고개를 돌려주세요."
        else:
            guidance = f"{POSE_SLOT_LABELS[pose_slot]} 참고 이미지로 저장할 수 있습니다."

        return FacePoseEstimateData(
            detected=True,
            pose_slot=pose_slot,
            pose_label=POSE_SLOT_LABELS[pose_slot],
            confidence=round(confidence * float(largest.confidence), 3),
            face_bbox=largest.box.as_list(),
            already_captured=already_captured,
            completed_count=len(completed),
            next_slots=remaining_slots,
            guidance=guidance,
        )

    async def register_face(
        self,
        *,
        image: UploadFile,
        label: str,
        note: str | None,
        pose_slot: str | None = None,
        enrollment_id: str | None = None,
    ) -> AllowlistFaceData:
        person_id = f"person_{uuid4().hex[:8]}"
        suffix = Path(image.filename or "face.jpg").suffix or ".jpg"
        filename = f"{person_id}{suffix}"
        target_path = self.storage_dir / filename
        content = await self._read_image_upload(image)
        normalized_pose_slot = self._normalize_pose_slot(pose_slot)
        target_path.write_bytes(content)

        item = AllowlistFaceData(
            person_id=person_id,
            label=label,
            note=note,
            filename=filename,
            enrollment_id=enrollment_id,
            pose_slot=normalized_pose_slot,
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

    def candidate_references(self) -> tuple[CandidateReference, ...]:
        with self._lock:
            items = list(self._items.values())

        references: list[CandidateReference] = []
        for item in items:
            target_path = self.storage_dir / item.filename
            if not target_path.exists():
                continue
            try:
                image_bgr = decode_image_bytes(target_path.read_bytes())
            except ValueError:
                continue
            references.append(
                CandidateReference(
                    candidate_id=item.person_id,
                    action="preserve",
                    image_bgr=image_bgr,
                )
            )
        return tuple(references)
