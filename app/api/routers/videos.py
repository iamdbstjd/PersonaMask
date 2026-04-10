from __future__ import annotations

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.core.config import get_settings
from app.services.video_job_service import VideoJobService

router = APIRouter(tags=["videos"])


def _request_id(request: Request, fallback: str) -> str:
    return request.headers.get("X-Request-Id", fallback)


@router.post("/videos/jobs")
async def create_video_job(
    request: Request,
    file: UploadFile = File(...),
    config: str | None = Form(default=None),
) -> dict[str, object]:
    service = VideoJobService(get_settings())
    job = await service.create_job(file=file, raw_config=config)
    return {"request_id": _request_id(request, "generated-video-job-request"), "data": job.model_dump(), "error": None}


@router.get("/videos/jobs/{job_id}")
def get_video_job(job_id: str, request: Request) -> dict[str, object]:
    service = VideoJobService(get_settings())
    job = service.get_job(job_id)
    return {"request_id": _request_id(request, "generated-video-job-status-request"), "data": job.model_dump(), "error": None}


@router.get("/videos/jobs/{job_id}/result")
def download_video_job_result(job_id: str):
    service = VideoJobService(get_settings())
    return service.build_result_response(job_id)


@router.post("/videos/jobs/{job_id}/cancel")
def cancel_video_job(job_id: str, request: Request) -> dict[str, object]:
    service = VideoJobService(get_settings())
    job = service.cancel_job(job_id)
    return {"request_id": _request_id(request, "generated-video-job-cancel-request"), "data": job.model_dump(), "error": None}
