from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(tags=["presets"])

PRESETS = [
    {
        "preset_id": "spider",
        "label": "Spider Mask",
        "mode": "character",
        "thumbnail_url": "/presets-preview/spider.png",
        "supports_realtime": True,
    },
    {
        "preset_id": "bat",
        "label": "Bat Mask",
        "mode": "character",
        "thumbnail_url": "/presets-preview/bat.png",
        "supports_realtime": True,
    },
    {
        "preset_id": "anime_mask",
        "label": "Anime Mask",
        "mode": "character",
        "thumbnail_url": "/presets-preview/anime-mask.png",
        "supports_realtime": True,
    },
]


@router.get("/presets")
def list_presets(request: Request) -> dict[str, object]:
    return {
        "request_id": request.headers.get("X-Request-Id", "generated-presets-request"),
        "data": {"items": PRESETS},
        "error": None,
    }
