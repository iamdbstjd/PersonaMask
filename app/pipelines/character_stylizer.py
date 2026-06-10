from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from threading import Lock
from typing import Any

import cv2
import numpy as np

from app.core.config import Settings
from app.pipelines.frame_processor import CandidateReference, CharacterStyleAsset


_PIPELINE_LOCK = Lock()
_PIPELINE_CACHE: dict[tuple[str, str, bool], Any] = {}


@dataclass(frozen=True)
class CharacterStyleBuildResult:
    assets: dict[str, CharacterStyleAsset]
    report: dict[str, Any]


def build_character_style_assets(
    *,
    references: tuple[CandidateReference, ...],
    output_dir: Path,
    settings: Settings,
    preset_id: str | None,
) -> CharacterStyleBuildResult:
    character_references = tuple(reference for reference in references if reference.action == "character")
    report_items: list[dict[str, Any]] = []
    assets: dict[str, CharacterStyleAsset] = {}

    if not character_references:
        return CharacterStyleBuildResult(
            assets={},
            report={
                "enabled": False,
                "preset_id": preset_id,
                "model": settings.diffusion_model,
                "generated_count": 0,
                "items": [],
                "warnings": [],
            },
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    warnings: list[str] = []

    for reference in character_references:
        styled_image, engine, warning = stylize_face_crop(reference.image_bgr, settings=settings, preset_id=preset_id)
        if warning:
            warnings.append(f"{reference.candidate_id}: {warning}")

        artifact_path = output_dir / f"{_safe_filename(reference.candidate_id)}-character-style.jpg"
        cv2.imwrite(str(artifact_path), styled_image)
        asset = CharacterStyleAsset(
            candidate_id=reference.candidate_id,
            image_bgr=styled_image,
            engine=engine,
            prompt=_prompt_for_preset(preset_id),
            artifact_path=str(artifact_path),
        )
        assets[reference.candidate_id] = asset
        report_items.append(
            {
                "candidate_id": reference.candidate_id,
                "engine": engine,
                "artifact": artifact_path.name,
                "prompt": asset.prompt,
            }
        )

    return CharacterStyleBuildResult(
        assets=assets,
        report={
            "enabled": True,
            "preset_id": preset_id,
            "model": settings.diffusion_model,
            "generated_count": len(assets),
            "items": report_items,
            "warnings": warnings,
        },
    )


def stylize_face_crop(image_bgr: np.ndarray, *, settings: Settings, preset_id: str | None) -> tuple[np.ndarray, str, str | None]:
    if settings.diffusion_enabled:
        try:
            return _stylize_with_diffusion(image_bgr, settings=settings, preset_id=preset_id), "diffusion_img2img", None
        except Exception as exc:
            fallback = _opencv_privacy_avatar(image_bgr, preset_id)
            return fallback, "opencv_privacy_avatar_fallback", str(exc)

    return _opencv_privacy_avatar(image_bgr, preset_id), "opencv_privacy_avatar_fallback", "diffusion disabled by configuration"


def _stylize_with_diffusion(image_bgr: np.ndarray, *, settings: Settings, preset_id: str | None) -> np.ndarray:
    if not settings.diffusion_model.strip():
        raise RuntimeError("PERSONAMASK_DIFFUSION_MODEL is empty")

    from PIL import Image
    import torch
    from diffusers import AutoPipelineForImage2Image

    device = settings.diffusion_device
    torch_dtype = torch.float16 if device == "cuda" else torch.float32
    cache_key = (settings.diffusion_model, device, settings.diffusion_local_files_only)

    with _PIPELINE_LOCK:
        pipeline = _PIPELINE_CACHE.get(cache_key)
        if pipeline is None:
            pipeline = AutoPipelineForImage2Image.from_pretrained(
                settings.diffusion_model,
                torch_dtype=torch_dtype,
                local_files_only=settings.diffusion_local_files_only,
            )
            pipeline = pipeline.to(device)
            _PIPELINE_CACHE[cache_key] = pipeline

    original_height, original_width = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(image_rgb).resize((512, 512), Image.Resampling.LANCZOS)
    result = pipeline(
        prompt=_prompt_for_preset(preset_id),
        negative_prompt="realistic identity, exact face likeness, text, watermark, logo, low quality",
        image=pil_image,
        strength=max(0.2, min(0.95, settings.diffusion_strength)),
        guidance_scale=max(1.0, min(15.0, settings.diffusion_guidance_scale)),
        num_inference_steps=max(4, min(80, settings.diffusion_steps)),
    )
    styled_rgb = np.asarray(result.images[0].resize((original_width, original_height), Image.Resampling.LANCZOS))
    return cv2.cvtColor(styled_rgb, cv2.COLOR_RGB2BGR)


def _prompt_for_preset(preset_id: str | None) -> str:
    preset = (preset_id or "anime_portrait").lower()
    prompts = {
        "clay_avatar": "privacy preserving clay character avatar, soft studio lighting, simplified facial identity, clean background",
        "comic_ink": "privacy preserving comic ink character portrait, bold line art, flat colors, anonymized face",
        "anime_portrait": "privacy preserving animated character portrait, clean cel shading, anonymized face, expressive but not identifiable",
    }
    return prompts.get(preset, prompts["anime_portrait"])


def _opencv_privacy_avatar(image_bgr: np.ndarray, preset_id: str | None) -> np.ndarray:
    preset = (preset_id or "anime_portrait").lower()
    smoothed = cv2.bilateralFilter(image_bgr, 11, 90, 90)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 7)
    cartoon = cv2.bitwise_and(smoothed, smoothed, mask=edges)

    if preset == "clay_avatar":
        tint = np.full_like(cartoon, (188, 172, 220))
        return cv2.addWeighted(cartoon, 0.62, tint, 0.38, 0)
    if preset == "comic_ink":
        boosted = cv2.convertScaleAbs(cartoon, alpha=1.25, beta=8)
        return cv2.bilateralFilter(boosted, 5, 50, 50)

    tint = np.full_like(cartoon, (220, 180, 136))
    return cv2.addWeighted(cartoon, 0.72, tint, 0.28, 0)


def _safe_filename(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value).strip("_") or "candidate"
