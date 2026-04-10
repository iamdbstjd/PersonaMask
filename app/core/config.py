from __future__ import annotations

from dataclasses import dataclass
import os
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "character-mask-privacy-api")
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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
