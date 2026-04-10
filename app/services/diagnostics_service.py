from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.core.gpu import probe_runtime
from app.repositories.job_repository import job_repository


class DiagnosticsService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _paths(self) -> dict[str, str]:
        return {
            "repo_root": str(Path.cwd()),
            "models_dir": str(Path(self.settings.models_dir).resolve()),
            "data_dir": str(Path(self.settings.data_dir).resolve()),
        }

    def health_payload(self) -> dict[str, Any]:
        runtime = probe_runtime()
        return {
            "status": "ok",
            "app_name": self.settings.app_name,
            "app_env": self.settings.app_env,
            "gpu": {
                "enabled": runtime["cuda_enabled"],
                "available_providers": runtime["available_providers"],
                "nvidia": runtime["nvidia"],
            },
        }

    def diagnostics_payload(self) -> dict[str, Any]:
        runtime = probe_runtime()
        gpu_status = "ready" if runtime.get("cuda_enabled") else "cpu_only"
        api_status = "healthy"
        runtime_status = "ready"
        queue_depth = job_repository.get_queue_depth()
        return {
            "status": "ok",
            "api_status": api_status,
            "gpu_status": gpu_status,
            "runtime_status": runtime_status,
            "queue_depth": queue_depth,
            "settings": {
                "app_name": self.settings.app_name,
                "app_env": self.settings.app_env,
                "api_prefix": self.settings.api_prefix,
                "use_gpu": self.settings.use_gpu,
                "execution_providers": list(self.settings.execution_providers),
            },
            "runtime": runtime,
            "paths": self._paths(),
        }
