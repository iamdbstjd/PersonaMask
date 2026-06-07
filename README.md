# PersonaMask

PersonaMask is a saved-video privacy review console built with FastAPI and Next.js.

The main workflow is simple: upload a video, review detected face candidates, choose how each identity should be handled, render the redacted video, and download QA artifacts that explain the result.

## Preview

![PersonaMask video review UI](docs/assets/video-review-ui.png)

## Current UI

The video review screen is organized as a quiet two-column workspace:

- Left side: source video upload and the candidate review board.
- Right side: one render panel for required settings, progress, QA downloads, and runtime status.
- QA results stay collapsed until the operator needs the rendered output or reports.

This keeps the primary flow focused on upload, candidate analysis, render submission, and artifact review.

## Core Features

- **Candidate Review Board**: samples uploaded videos, extracts face candidates, and supports `preserve`, `character`, `blur`, and `track` decisions.
- **Decision-aware rendering**: applies candidate decisions during render when identity embeddings are available.
- **Redaction QA Report**: generates `qa-report.json`, `qa-report.md`, and a before/after contact sheet after rendering.
- **Protected artifacts**: candidate crops, rendered videos, contact sheets, and QA reports require the issued `X-Access-Token`.
- **Realtime preview**: keeps the camera-based privacy preview as a support and calibration lane.

## Face Detection Status

Use InsightFace `buffalo_l` for candidate review quality.

Recent local check with `test_video.mp4` in the `bys` conda environment:

- Video: 312 frames, 1080x1920, about 30 FPS.
- Candidate extraction: 3 identity candidates.
- Candidate cluster sizes: 28, 18, 17.
- Sampled frames: 52.
- Frames with detected faces: 40 of 52.
- Candidate match rate when a face was detected: 100%.
- `tests.test_video_identity_quality` passed.

OpenCV Haar fallback is only a degraded fallback. On the same video it over-extracted 6 candidates, produced no embeddings, and matched only 8 of 34 face-positive sampled frames. Do not treat the fallback path as production-quality identity review.

## Stack

- Backend: FastAPI, OpenCV, ONNX Runtime, optional InsightFace/ArcFace.
- Frontend: Next.js App Router, React, TypeScript.
- Contracts: `contracts/openapi.yaml`, `contracts/video.schema.json`.
- Runtime data: `data/uploads`, `data/outputs`, `data/candidates`, local state files.

## Run Locally

Backend:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.main --check
python -m app.main --host 127.0.0.1 --port 8001
```

Frontend:

```bash
cd web
npm install
npm run dev
```

Default frontend: `http://127.0.0.1:3000`

## Video Review API

Important endpoints:

- `POST /api/v1/videos/candidates`
- `GET /api/v1/videos/candidates/{analysis_id}/{candidate_id}` with `X-Access-Token`
- `POST /api/v1/videos/jobs`
- `GET /api/v1/videos/jobs/{job_id}` with `X-Access-Token`
- `POST /api/v1/videos/jobs/{job_id}/cancel` with `X-Access-Token`
- `GET /api/v1/videos/jobs/{job_id}/result` with `X-Access-Token`
- `GET /api/v1/videos/jobs/{job_id}/contact-sheet` with `X-Access-Token`
- `GET /api/v1/videos/jobs/{job_id}/qa-report.json` with `X-Access-Token`
- `GET /api/v1/videos/jobs/{job_id}/qa-report.md` with `X-Access-Token`

Candidate action meanings:

- `preserve`: keep this identity visible.
- `character`: replace this identity with the selected character style.
- `blur`: redact this identity.
- `track`: keep this identity tracked across frames for review.

## Realtime Preview API

Realtime endpoints remain available for privacy preview and calibration:

- `GET /api/v1/health`
- `GET /api/v1/diagnostics/runtime`
- `GET /api/v1/presets`
- `POST /api/v1/realtime/sessions`
- `POST /api/v1/realtime/sessions/{session_id}/frames`
- `DELETE /api/v1/realtime/sessions/{session_id}`
- `POST /api/v1/allowlist/faces`
- `GET /api/v1/allowlist/faces`
- `DELETE /api/v1/allowlist/faces/{person_id}`

## Environment

Common backend values are documented in `.env.example`.

Identity-related values:

```bash
PERSONAMASK_FACE_DETECTOR=auto
PERSONAMASK_INSIGHTFACE_ROOT=/home/bys0626/.insightface
PERSONAMASK_INSIGHTFACE_MODEL=buffalo_l
PERSONAMASK_ONNXRUNTIME_PROVIDER=CPUExecutionProvider
PERSONAMASK_INSIGHTFACE_CTX_ID=-1
```

Use `CUDAExecutionProvider` only after the host GPU driver and ONNX Runtime CUDA path are verified. If InsightFace initialization fails, the code currently falls back to OpenCV, which is lower quality.

## Verify

Backend:

```bash
NO_ALBUMENTATIONS_UPDATE=1 MPLCONFIGDIR=/tmp/matplotlib PYTHONPYCACHEPREFIX=/tmp/pycache \
  conda run --no-capture-output -n bys python -m unittest discover -s tests -v
```

Targeted face detection regression:

```bash
NO_ALBUMENTATIONS_UPDATE=1 MPLCONFIGDIR=/tmp/matplotlib \
  conda run --no-capture-output -n bys python -m unittest tests.test_video_identity_quality -v
```

Frontend:

```bash
npm --prefix web run typecheck
npm --prefix web run lint
```

`tests/test_video_identity_quality.py` uses a local `test_video.mp4` when present. Keep that video local when it contains real people; it is not required for public source checkout.

## License

MIT License. See [`LICENSE`](./LICENSE).
