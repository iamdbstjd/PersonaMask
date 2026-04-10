from __future__ import annotations

import os
import shutil
import subprocess
from typing import Any


def _read_nvidia_smi() -> dict[str, Any]:
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        return {"available": False, "reason": "nvidia-smi not found"}

    command = [
        nvidia_smi,
        "--query-gpu=name,driver_version,memory.total",
        "--format=csv,noheader",
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        return {
            "available": False,
            "reason": completed.stderr.strip() or "nvidia-smi failed",
        }

    gpus = []
    for line in completed.stdout.strip().splitlines():
        if not line.strip():
            continue
        parts = [part.strip() for part in line.split(",")]
        name, driver_version, memory_total = (parts + ["", "", ""])[:3]
        gpus.append(
            {
                "name": name,
                "driver_version": driver_version,
                "memory_total": memory_total,
            }
        )

    return {"available": bool(gpus), "gpus": gpus}


def probe_runtime() -> dict[str, Any]:
    providers: list[str] = []
    import_error: str | None = None

    try:
        import onnxruntime as ort  # type: ignore

        providers = list(ort.get_available_providers())
    except Exception as exc:  # pragma: no cover - defensive fallback
        import_error = str(exc)

    nvidia = _read_nvidia_smi()
    cuda_enabled = "CUDAExecutionProvider" in providers

    return {
        "python_executable": os.sys.executable,
        "conda_env": os.getenv("CONDA_DEFAULT_ENV"),
        "available_providers": providers,
        "cuda_enabled": cuda_enabled,
        "onnxruntime_import_error": import_error,
        "nvidia": nvidia,
    }
