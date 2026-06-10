from __future__ import annotations

from dataclasses import dataclass
import os
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "personamask-video-api")
    app_env: str = os.getenv("APP_ENV", "development")
    api_prefix: str = os.getenv("API_PREFIX", "/api/v1")
    models_dir: str = os.getenv("MODELS_DIR", "./models")
    data_dir: str = os.getenv("DATA_DIR", "./data")
    use_gpu: bool = os.getenv("USE_GPU", "1") not in {"0", "false", "False"}
    execution_providers: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv(
            "EXECUTION_PROVIDERS",
            "CUDAExecutionProvider,CPUExecutionProvider",
        ).split(",")
        if item.strip()
    )
    diffusion_enabled: bool = os.getenv("PERSONAMASK_DIFFUSION_ENABLED", "1") not in {"0", "false", "False"}
    diffusion_model: str = os.getenv("PERSONAMASK_DIFFUSION_MODEL", "runwayml/stable-diffusion-v1-5")
    diffusion_local_files_only: bool = os.getenv("PERSONAMASK_DIFFUSION_LOCAL_ONLY", "1") not in {"0", "false", "False"}
    diffusion_device: str = os.getenv("PERSONAMASK_DIFFUSION_DEVICE", "cuda" if use_gpu else "cpu")
    diffusion_steps: int = int(os.getenv("PERSONAMASK_DIFFUSION_STEPS", "18"))
    diffusion_strength: float = float(os.getenv("PERSONAMASK_DIFFUSION_STRENGTH", "0.62"))
    diffusion_guidance_scale: float = float(os.getenv("PERSONAMASK_DIFFUSION_GUIDANCE_SCALE", "6.5"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
