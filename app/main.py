from __future__ import annotations

import argparse
import json
from typing import Sequence

from fastapi import FastAPI
import uvicorn

from app.api.routers.allowlist import router as allowlist_router
from app.api.routers.diagnostics import router as diagnostics_router
from app.api.routers.health import router as health_router
from app.api.routers.presets import router as presets_router
from app.api.routers.realtime import router as realtime_router
from app.api.routers.videos import router as videos_router
from app.core.config import get_settings
from app.services.diagnostics_service import DiagnosticsService
from app.services.video_job_service import VideoJobService


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PersonaMask Video Review API",
        version="0.1.0",
        description="Saved-video privacy review API with candidate inspection, protected artifacts, and realtime preview support.",
    )
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(diagnostics_router, prefix=settings.api_prefix)
    app.include_router(presets_router, prefix=settings.api_prefix)
    app.include_router(allowlist_router, prefix=settings.api_prefix)
    app.include_router(realtime_router, prefix=settings.api_prefix)
    app.include_router(videos_router, prefix=settings.api_prefix)
    VideoJobService(settings).resume_pending_jobs()
    return app


def run_check() -> int:
    settings = get_settings()
    diagnostics = DiagnosticsService(settings).diagnostics_payload()
    print(json.dumps(diagnostics, ensure_ascii=False, indent=2))
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="PersonaMask Video Review backend")
    parser.add_argument("--check", action="store_true", help="Print runtime diagnostics and exit")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args(argv)

    if args.check:
        return run_check()

    uvicorn.run("app.main:create_app", factory=True, host=args.host, port=args.port, reload=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
