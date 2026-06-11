from __future__ import annotations

import base64
import binascii
import json
from json import JSONDecodeError, loads
from pathlib import Path
import re
import secrets
import shutil
import threading
from typing import Any, BinaryIO
from uuid import uuid4

import cv2
from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import ValidationError

from app.core.config import Settings
from app.pipelines.frame_processor import CandidateReference, decode_image_bytes
from app.pipelines.video_processor import VideoProcessingError, probe_video, process_video_privacy
from app.repositories.job_repository import JobRecord, job_repository
from app.schemas.videos import (
    VideoCandidateAnalysisData,
    VideoFaceCandidateData,
    VideoJobCreateData,
    VideoJobCreateRequest,
    VideoJobData,
    VideoJobProgress,
    VideoJobResult,
)
from app.services.video_candidate_service import VideoFaceCandidate, extract_video_face_candidates


class VideoJobService:
    SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
    MAX_UPLOAD_BYTES = 1024 * 1024 * 1024  # 1GB safety cap for local skeleton runtime
    MAX_REFERENCE_IMAGE_BYTES = 3 * 1024 * 1024
    MAX_REVIEW_CANDIDATES = 5
    ALLOWED_FACE_SLOTS = {"front", "left45", "right45", "leftSide", "rightSide"}
    SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")
    _processing_lock = threading.Lock()
    _processing_jobs: set[str] = set()

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.upload_dir = Path(settings.data_dir).resolve() / "uploads"
        self.output_dir = Path(settings.data_dir).resolve() / "outputs"
        self.candidate_dir = Path(settings.data_dir).resolve() / "candidates"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.candidate_dir.mkdir(parents=True, exist_ok=True)
        job_repository.configure_storage(settings.data_dir)

    def _parse_config(self, raw_config: str | None) -> VideoJobCreateRequest:
        if not raw_config:
            return VideoJobCreateRequest()
        try:
            return VideoJobCreateRequest.model_validate(loads(raw_config))
        except (JSONDecodeError, ValidationError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_CONFIG", "message": "config must be valid video job JSON.", "details": {"error": str(exc)}},
            ) from exc

    def _sanitize_filename(self, filename: str | None, fallback: str) -> str:
        base = Path(filename or fallback).name
        sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
        return sanitized or fallback

    def _copy_upload(self, file: UploadFile, target_path: Path) -> int:
        source: BinaryIO = file.file
        source.seek(0)
        total_bytes = 0
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with target_path.open("wb") as out:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > self.MAX_UPLOAD_BYTES:
                    target_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail={
                            "code": "VIDEO_TOO_LARGE",
                            "message": f"video upload must be <= {self.MAX_UPLOAD_BYTES} bytes",
                        },
                    )
                out.write(chunk)
        return total_bytes

    def _validate_access_token(self, expected: str, provided: str | None) -> None:
        if not provided or not secrets.compare_digest(expected, provided):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ACCESS_TOKEN_REQUIRED", "message": "A valid access token is required for this video artifact."},
            )

    def _output_path(self, record: JobRecord) -> Path:
        stem = Path(record.filename).stem or "result"
        return self.output_dir / record.job_id / f"{stem}.mp4"

    def resume_pending_jobs(self) -> None:
        for record in job_repository.list_by_status({"queued"}):
            self._schedule_processing(record.job_id)

    def _validate_video_upload(self, file: UploadFile, safe_filename: str) -> None:
        suffix = Path(safe_filename).suffix.lower()
        if suffix not in self.SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "UNSUPPORTED_VIDEO_FORMAT",
                    "message": f"unsupported extension '{suffix or '(none)'}'; expected one of {sorted(self.SUPPORTED_EXTENSIONS)}",
                },
            )
        if file.content_type and not file.content_type.startswith("video/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "multipart file must be a video media type"},
            )

    def _validate_candidate_analysis_token(self, analysis_id: str | None, access_token: str | None) -> None:
        if not analysis_id:
            return
        manifest = self._read_candidate_manifest(analysis_id)
        if manifest is None or not isinstance(manifest.get("access_token"), str):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CANDIDATE_ANALYSIS_NOT_FOUND", "message": "Candidate analysis was not found."},
            )
        self._validate_access_token(str(manifest["access_token"]), access_token)

    def _to_job_data(self, record: JobRecord) -> VideoJobData:
        progress = VideoJobProgress.model_validate(record.progress)
        result = None
        if record.result is not None:
            result = VideoJobResult.model_validate(record.result)
        return VideoJobData(job_id=record.job_id, status=record.status, progress=progress, result=result)

    async def create_job(self, *, file: UploadFile, raw_config: str | None) -> VideoJobCreateData:
        config = self._parse_config(raw_config)
        self._validate_candidate_analysis_token(config.analysis_id, config.candidate_access_token)
        config_payload = config.model_dump()
        try:
            allowed_face_images = self._decode_allowed_face_reference_items(config_payload)
        except VideoProcessingError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_ALLOWED_FACE_REFERENCE", "message": str(exc)},
            ) from exc
        safe_filename = self._sanitize_filename(file.filename, "upload.mp4")
        self._validate_video_upload(file, safe_filename)

        job_id = f"job_{uuid4().hex[:8]}"
        access_token = secrets.token_urlsafe(24)
        upload_path = self.upload_dir / job_id / safe_filename
        self._copy_upload(file, upload_path)
        try:
            total_frames, _, width, height = probe_video(upload_path)
        except VideoProcessingError as exc:
            shutil.rmtree(upload_path.parent, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_VIDEO_FILE", "message": str(exc)},
            ) from exc
        if width <= 0 or height <= 0:
            shutil.rmtree(upload_path.parent, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_VIDEO_FILE", "message": "unable to infer video dimensions"},
            )
        try:
            persisted_config = self._build_persisted_config(
                job_id=job_id,
                config_payload=config_payload,
                allowed_face_images=allowed_face_images,
            )
        except VideoProcessingError as exc:
            shutil.rmtree(upload_path.parent, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_ALLOWED_FACE_REFERENCE", "message": str(exc)},
            ) from exc

        record = job_repository.create(
            job_id=job_id,
            config=persisted_config,
            upload_path=str(upload_path),
            filename=safe_filename,
            content_type=file.content_type,
            access_token=access_token,
            total_frames=total_frames if total_frames > 0 else 3000,
        )
        self._schedule_processing(record.job_id)
        return VideoJobCreateData(
            job_id=record.job_id,
            status=record.status,
            access_token=record.access_token,
            status_endpoint=f"/api/v1/videos/jobs/{record.job_id}",
            cancel_endpoint=f"/api/v1/videos/jobs/{record.job_id}/cancel",
        )

    async def create_candidate_analysis(self, *, file: UploadFile) -> VideoCandidateAnalysisData:
        safe_filename = self._sanitize_filename(file.filename, "upload.mp4")
        self._validate_video_upload(file, safe_filename)
        analysis_id = f"analysis_{uuid4().hex[:10]}"
        access_token = secrets.token_urlsafe(24)
        analysis_dir = self.candidate_dir / analysis_id
        faces_dir = analysis_dir / "faces"
        analysis_dir.mkdir(parents=True, exist_ok=True)
        upload_path = analysis_dir / safe_filename

        try:
            self._copy_upload(file, upload_path)
            _, _, width, height = probe_video(upload_path)
            if width <= 0 or height <= 0:
                raise VideoProcessingError("unable to infer video dimensions")
            candidates = extract_video_face_candidates(upload_path, faces_dir, max_candidates=self.MAX_REVIEW_CANDIDATES)
        except HTTPException:
            shutil.rmtree(analysis_dir, ignore_errors=True)
            raise
        except (VideoProcessingError, ValueError) as exc:
            shutil.rmtree(analysis_dir, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_VIDEO_FILE", "message": str(exc)},
            ) from exc

        candidate_items = [
            VideoFaceCandidateData(
                candidate_id=candidate.candidate_id,
                image_url=f"/api/v1/videos/candidates/{analysis_id}/{candidate.candidate_id}",
                frame_index=candidate.frame_index,
                bbox=candidate.bbox.as_list(),
                confidence=candidate.confidence,
            )
            for candidate in candidates
        ]
        self._write_candidate_manifest(
            analysis_dir=analysis_dir,
            access_token=access_token,
            source_filename=safe_filename,
            candidates=candidates,
            candidate_items=candidate_items,
        )

        return VideoCandidateAnalysisData(
            analysis_id=analysis_id,
            access_token=access_token,
            source_filename=safe_filename,
            candidates=candidate_items,
        )

    def _write_candidate_manifest(
        self,
        *,
        analysis_dir: Path,
        access_token: str,
        source_filename: str,
        candidates: list[VideoFaceCandidate],
        candidate_items: list[VideoFaceCandidateData],
    ) -> None:
        candidate_records: list[dict[str, object]] = []
        for candidate, candidate_item in zip(candidates, candidate_items):
            record = candidate_item.model_dump()
            if candidate.embedding is not None:
                record["embedding"] = list(candidate.embedding)
            record["detector"] = candidate.detector
            record["cluster_size"] = candidate.cluster_size
            candidate_records.append(record)
        payload = {
            "access_token": access_token,
            "source_filename": source_filename,
            "candidates": candidate_records,
        }
        (analysis_dir / "analysis.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _read_candidate_manifest(self, analysis_id: str) -> dict[str, object] | None:
        if not self.SAFE_ID.fullmatch(analysis_id):
            return None
        manifest_path = self.candidate_dir / analysis_id / "analysis.json"
        if not manifest_path.exists():
            return None
        try:
            return loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, JSONDecodeError):
            return None

    def get_job(self, job_id: str, access_token: str | None) -> VideoJobData:
        record = job_repository.get(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        self._validate_access_token(record.access_token, access_token)
        return self._to_job_data(record)

    def cancel_job(self, job_id: str, access_token: str | None) -> VideoJobData:
        current = job_repository.get(job_id)
        if current is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        self._validate_access_token(current.access_token, access_token)
        record = job_repository.cancel(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        return self._to_job_data(record)

    def _schedule_processing(self, job_id: str) -> None:
        with self._processing_lock:
            if job_id in self._processing_jobs:
                return
            self._processing_jobs.add(job_id)
        thread = threading.Thread(target=self._process_job, args=(job_id,), daemon=True)
        thread.start()

    def _process_job(self, job_id: str) -> None:
        try:
            record = job_repository.try_mark_processing(job_id)
            if record is None:
                return
            try:
                output_path = self._build_result_artifact(record)
                current = job_repository.get(job_id)
                if current is not None and current.status == "cancelled":
                    return
                if not output_path.exists():
                    raise VideoProcessingError("render completed without an output artifact")
            except VideoProcessingError as exc:
                current = job_repository.get(job_id)
                if current is not None and current.status != "cancelled":
                    job_repository.update_status(
                        job_id,
                        status="failed",
                        error={"code": "VIDEO_PROCESSING_FAILED", "message": str(exc)},
                    )
        finally:
            with self._processing_lock:
                self._processing_jobs.discard(job_id)

    def _load_candidate_references(self, config: dict[str, object]) -> list[CandidateReference]:
        analysis_id = config.get("analysis_id")
        candidate_access_token = config.get("candidate_access_token")
        candidate_actions = config.get("candidate_actions", {})
        if not isinstance(analysis_id, str) or not self.SAFE_ID.fullmatch(analysis_id):
            return []
        if not isinstance(candidate_actions, dict):
            return []
        if not isinstance(candidate_access_token, str):
            raise VideoProcessingError("candidate analysis access token is required for candidate rendering")
        manifest = self._read_candidate_manifest(analysis_id)
        if manifest is None or not isinstance(manifest.get("access_token"), str):
            raise VideoProcessingError("candidate analysis manifest was not found")
        if not secrets.compare_digest(str(manifest["access_token"]), candidate_access_token):
            raise VideoProcessingError("candidate analysis access token is invalid")

        faces_dir = (self.candidate_dir / analysis_id / "faces").resolve()
        candidate_records = {
            str(item.get("candidate_id")): item
            for item in manifest.get("candidates", [])
            if isinstance(item, dict) and isinstance(item.get("candidate_id"), str)
        }
        references: list[CandidateReference] = []
        for candidate_id, action in candidate_actions.items():
            if not isinstance(candidate_id, str) or not self.SAFE_ID.fullmatch(candidate_id):
                continue
            if action not in {"preserve", "character", "blur", "track"}:
                continue
            candidate_path = (faces_dir / f"{candidate_id}.jpg").resolve()
            if not candidate_path.is_relative_to(faces_dir) or not candidate_path.exists():
                continue
            image_bgr = cv2.imread(str(candidate_path))
            if image_bgr is None:
                continue
            embedding = None
            candidate_record = candidate_records.get(candidate_id)
            if candidate_record is not None:
                raw_embedding = candidate_record.get("embedding")
                if isinstance(raw_embedding, list):
                    try:
                        embedding = tuple(float(value) for value in raw_embedding)
                    except (TypeError, ValueError):
                        embedding = None
            references.append(CandidateReference(candidate_id=candidate_id, action=str(action), image_bgr=image_bgr, embedding=embedding))
        return references

    def _decode_reference_image_data(self, image_data: str):
        if "," in image_data:
            prefix, image_data = image_data.split(",", 1)
            if not prefix.lower().startswith("data:image/") or ";base64" not in prefix.lower():
                raise VideoProcessingError("allowed face reference must be a base64 image data URL")
        try:
            payload = base64.b64decode(image_data, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise VideoProcessingError("allowed face reference image is not valid base64") from exc
        if not payload:
            raise VideoProcessingError("allowed face reference image is empty")
        if len(payload) > self.MAX_REFERENCE_IMAGE_BYTES:
            raise VideoProcessingError(f"allowed face reference image must be <= {self.MAX_REFERENCE_IMAGE_BYTES} bytes")
        try:
            return decode_image_bytes(payload)
        except ValueError as exc:
            raise VideoProcessingError("allowed face reference image is not decodable") from exc

    def _decode_allowed_face_reference_items(self, config: dict[str, object]) -> list[tuple[str, Any]]:
        raw_references = config.get("allowed_face_references", [])
        if raw_references in (None, []):
            return []
        if not isinstance(raw_references, list):
            raise VideoProcessingError("allowed_face_references must be a list")

        references: list[tuple[str, Any]] = []
        seen_slots: set[str] = set()
        for item in raw_references[: self.MAX_REVIEW_CANDIDATES]:
            if not isinstance(item, dict):
                raise VideoProcessingError("allowed face reference must be an object")
            slot = item.get("slot")
            image_data = item.get("image_data")
            if not isinstance(slot, str) or slot not in self.ALLOWED_FACE_SLOTS:
                raise VideoProcessingError("allowed face reference slot is invalid")
            if slot in seen_slots:
                continue
            if not isinstance(image_data, str):
                raise VideoProcessingError("allowed face reference image_data is required")
            references.append((slot, self._decode_reference_image_data(image_data)))
            seen_slots.add(slot)
        return references

    def _load_allowed_face_reference_paths(self, config: dict[str, object]) -> list[tuple[str, Any]]:
        raw_references = config.get("allowed_face_reference_paths", [])
        if raw_references in (None, []):
            return []
        if not isinstance(raw_references, list):
            raise VideoProcessingError("allowed_face_reference_paths must be a list")

        references: list[tuple[str, Any]] = []
        seen_slots: set[str] = set()
        for item in raw_references[: self.MAX_REVIEW_CANDIDATES]:
            if not isinstance(item, dict):
                raise VideoProcessingError("allowed face reference path must be an object")
            slot = item.get("slot")
            path_text = item.get("path")
            if not isinstance(slot, str) or slot not in self.ALLOWED_FACE_SLOTS:
                raise VideoProcessingError("allowed face reference slot is invalid")
            if slot in seen_slots:
                continue
            if not isinstance(path_text, str):
                raise VideoProcessingError("allowed face reference path is required")
            reference_path = Path(path_text).resolve()
            if not reference_path.is_relative_to(self.upload_dir):
                raise VideoProcessingError("allowed face reference path is outside the upload directory")
            image_bgr = cv2.imread(str(reference_path))
            if image_bgr is None:
                raise VideoProcessingError("allowed face reference image is not readable")
            references.append((slot, image_bgr))
            seen_slots.add(slot)
        return references

    def _load_allowed_face_references(self, config: dict[str, object]) -> list[CandidateReference]:
        image_items = [
            *self._decode_allowed_face_reference_items(config),
            *self._load_allowed_face_reference_paths(config),
        ]
        return [
            CandidateReference(
                candidate_id="allowed_face",
                action="preserve",
                image_bgr=image_bgr,
            )
            for _, image_bgr in image_items
        ]

    def _build_persisted_config(
        self,
        *,
        job_id: str,
        config_payload: dict[str, object],
        allowed_face_images: list[tuple[str, Any]],
    ) -> dict[str, object]:
        persisted_config = dict(config_payload)
        if not allowed_face_images:
            return persisted_config

        reference_dir = self.upload_dir / job_id / "allowed-faces"
        reference_dir.mkdir(parents=True, exist_ok=True)
        persisted_paths: list[dict[str, str]] = []
        for slot, image_bgr in allowed_face_images:
            reference_path = reference_dir / f"{slot}.jpg"
            if not cv2.imwrite(str(reference_path), image_bgr):
                raise VideoProcessingError("allowed face reference image could not be stored")
            persisted_paths.append({"slot": slot, "path": str(reference_path)})

        persisted_config["allowed_face_references"] = []
        persisted_config["allowed_face_reference_paths"] = persisted_paths
        return persisted_config

    def _build_result_artifact(self, record: JobRecord) -> Path:
        output_path = self._output_path(record)
        expected_artifacts = [
            output_path.with_name(f"{output_path.stem}-thumb.jpg"),
            output_path.with_name(f"{output_path.stem}-contact-sheet.jpg"),
            output_path.with_name(f"{output_path.stem}-qa-report.json"),
            output_path.with_name(f"{output_path.stem}-qa-report.md"),
        ]
        has_current_result = isinstance(record.result, dict) and "qa_summary" in record.result
        needs_processing = not output_path.exists() or not has_current_result or any(not path.exists() for path in expected_artifacts)

        if not needs_processing:
            return output_path

        config = record.config
        privacy = config.get("privacy_options", {}) if isinstance(config, dict) else {}
        candidate_actions = config.get("candidate_actions", {}) if isinstance(config, dict) else {}
        candidate_references = self._load_candidate_references(config) if isinstance(config, dict) else []
        allowed_face_references = self._load_allowed_face_references(config) if isinstance(config, dict) else []
        report_candidate_actions = candidate_actions.copy() if isinstance(candidate_actions, dict) else {}
        if allowed_face_references:
            report_candidate_actions.setdefault("allowed_face", "preserve")
        summary = process_video_privacy(
            upload_path=Path(record.upload_path),
            output_path=output_path,
            settings=self.settings,
            mode=str(config.get("mode", "video_privacy")) if isinstance(config, dict) else "video_privacy",
            blur_faces=bool(privacy.get("blur_faces", True)),
            blur_plates=bool(privacy.get("blur_plates", True)),
            blur_text=bool(privacy.get("blur_text", True)),
            character_id=str(config.get("character_id")) if isinstance(config, dict) and config.get("character_id") else None,
            analysis_id=str(config.get("analysis_id")) if isinstance(config, dict) and config.get("analysis_id") else None,
            candidate_actions=report_candidate_actions,
            candidate_references=[*candidate_references, *allowed_face_references],
        )
        expires_at = record.result.get("expires_at") if isinstance(record.result, dict) else None
        result_payload = {
            "download_url": f"/api/v1/videos/jobs/{record.job_id}/result",
            "preview_thumbnail_url": f"/api/v1/videos/jobs/{record.job_id}/thumbnail" if summary.preview_thumbnail else None,
            "contact_sheet_url": f"/api/v1/videos/jobs/{record.job_id}/contact-sheet" if summary.contact_sheet else None,
            "qa_report_json_url": f"/api/v1/videos/jobs/{record.job_id}/qa-report.json",
            "qa_report_markdown_url": f"/api/v1/videos/jobs/{record.job_id}/qa-report.md",
            "expires_at": expires_at,
            "qa_summary": {
                "processed_frames": summary.processed_frames,
                "detection_totals": summary.detection_totals,
                "average_blur_reduction_pct": summary.average_blur_reduction_pct,
                "suspect_frame_count": len(summary.suspect_frames),
                "candidate_enforcement": summary.candidate_enforcement,
                "character_style": summary.character_style,
            },
        }
        job_repository.complete(
            record.job_id,
            progress={
                "percent": 100,
                "processed_frames": summary.processed_frames,
                "total_frames": max(summary.processed_frames, int(record.progress.get("total_frames", summary.processed_frames))),
                "eta_sec": 0,
            },
            result=result_payload,
        )
        return output_path

    def build_result_response(self, job_id: str, access_token: str | None) -> FileResponse:
        record = job_repository.get(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        self._validate_access_token(record.access_token, access_token)
        if record.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "JOB_NOT_READY", "message": "Video job result is not ready yet."},
            )
        output_path = self._output_path(record)
        if not output_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "ARTIFACT_NOT_FOUND", "message": "Video job result was not found."},
            )
        return FileResponse(path=output_path, filename=output_path.name, media_type="video/mp4")

    def build_job_artifact_response(self, job_id: str, artifact: str, access_token: str | None) -> FileResponse:
        record = job_repository.get(job_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "JOB_NOT_FOUND", "message": "Video job was not found."},
            )
        self._validate_access_token(record.access_token, access_token)
        if record.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "JOB_NOT_READY", "message": "Video job artifact is not ready yet."},
            )
        output_path = self._output_path(record)
        artifact_path, media_type, filename = self._artifact_path(output_path, artifact)
        if not artifact_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "ARTIFACT_NOT_FOUND", "message": "Video job artifact was not found."},
            )
        return FileResponse(path=artifact_path, filename=filename, media_type=media_type)

    def _artifact_path(self, output_path: Path, artifact: str) -> tuple[Path, str, str]:
        if artifact == "thumbnail":
            path = output_path.with_name(f"{output_path.stem}-thumb.jpg")
            return path, "image/jpeg", path.name
        if artifact == "contact-sheet":
            path = output_path.with_name(f"{output_path.stem}-contact-sheet.jpg")
            return path, "image/jpeg", path.name
        if artifact == "qa-report.json":
            path = output_path.with_name(f"{output_path.stem}-qa-report.json")
            return path, "application/json", path.name
        if artifact == "qa-report.md":
            path = output_path.with_name(f"{output_path.stem}-qa-report.md")
            return path, "text/markdown", path.name
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ARTIFACT_NOT_FOUND", "message": "Video job artifact was not found."},
        )

    def build_candidate_response(self, analysis_id: str, candidate_id: str, access_token: str | None) -> FileResponse:
        if not self.SAFE_ID.fullmatch(analysis_id) or not self.SAFE_ID.fullmatch(candidate_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CANDIDATE_NOT_FOUND", "message": "Video candidate was not found."},
            )
        manifest = self._read_candidate_manifest(analysis_id)
        if manifest is None or not isinstance(manifest.get("access_token"), str):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CANDIDATE_NOT_FOUND", "message": "Video candidate was not found."},
            )
        self._validate_access_token(str(manifest["access_token"]), access_token)
        candidate_path = (self.candidate_dir / analysis_id / "faces" / f"{candidate_id}.jpg").resolve()
        faces_dir = (self.candidate_dir / analysis_id / "faces").resolve()
        if not candidate_path.is_relative_to(faces_dir) or not candidate_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CANDIDATE_NOT_FOUND", "message": "Video candidate was not found."},
            )
        return FileResponse(path=candidate_path, media_type="image/jpeg")
