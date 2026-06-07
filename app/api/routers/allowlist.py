from __future__ import annotations

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.core.config import get_settings
from app.services.allowlist_service import AllowlistService

router = APIRouter(tags=["allowlist"])


def _request_id(request: Request, fallback: str) -> str:
    return request.headers.get("X-Request-Id", fallback)


@router.post("/allowlist/faces")
async def create_allowlist_face(
    request: Request,
    image: UploadFile = File(...),
    label: str = Form(...),
    note: str | None = Form(default=None),
    pose_slot: str = Form(default=""),
    enrollment_id: str = Form(default=""),
) -> dict[str, object]:
    service = AllowlistService(get_settings())
    item = await service.register_face(
        image=image,
        label=label,
        note=note,
        pose_slot=pose_slot or None,
        enrollment_id=enrollment_id or None,
    )
    return {"request_id": _request_id(request, "generated-allowlist-create-request"), "data": item.model_dump(), "error": None}


@router.get("/allowlist/faces")
async def list_allowlist_faces(request: Request) -> dict[str, object]:
    service = AllowlistService(get_settings())
    items = service.list_faces()
    return {"request_id": _request_id(request, "generated-allowlist-list-request"), "data": items.model_dump(), "error": None}


@router.delete("/allowlist/faces/{person_id}")
async def delete_allowlist_face(person_id: str, request: Request) -> dict[str, object]:
    service = AllowlistService(get_settings())
    deleted = service.delete_face(person_id)
    return {"request_id": _request_id(request, "generated-allowlist-delete-request"), "data": deleted.model_dump(), "error": None}
