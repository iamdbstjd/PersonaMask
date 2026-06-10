from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(tags=["presets"])

PRESETS = [
    {
        "preset_id": "anime_portrait",
        "label": "애니메이션 초상",
        "mode": "character",
        "thumbnail_url": "/presets-preview/anime-portrait.png",
        "engine": "diffusion_img2img",
    },
    {
        "preset_id": "clay_avatar",
        "label": "클레이 아바타",
        "mode": "character",
        "thumbnail_url": "/presets-preview/clay-avatar.png",
        "engine": "diffusion_img2img",
    },
    {
        "preset_id": "comic_ink",
        "label": "코믹 잉크",
        "mode": "character",
        "thumbnail_url": "/presets-preview/comic-ink.png",
        "engine": "diffusion_img2img",
    },
]


@router.get("/presets")
def list_presets(request: Request) -> dict[str, object]:
    return {
        "request_id": request.headers.get("X-Request-Id", "generated-presets-request"),
        "data": {"items": PRESETS},
        "error": None,
    }
