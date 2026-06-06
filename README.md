# PersonaMask

Saved-video privacy review console built with FastAPI and Next.js.

PersonaMask lets an operator upload a video, inspect detected face candidates, choose how each identity should be handled, render the redacted video, and download QA artifacts that explain what happened.

## Preview

![PersonaMask video review UI](docs/assets/video-review-ui.png)

## What It Does

- **Candidate Review Board**: samples the uploaded video, clusters face candidates, and lets the operator choose `preserve`, `character`, `blur`, or `track`.
- **Decision-aware rendering**: applies candidate decisions during render using InsightFace/ArcFace cosine matching when embeddings are available, with an OpenCV fallback.
- **Redaction QA Report**: creates `qa-report.json`, `qa-report.md`, and a before/after contact sheet after rendering.
- **Protected artifacts**: candidate crops, result videos, contact sheets, and QA reports require the issued `X-Access-Token`.
- **GPU path**: supports ONNX Runtime CUDA execution on the local RTX 3090 server through `scripts/run_gpu_server.sh`.
- **Realtime preview**: keeps realtime camera privacy preview as a calibration/support lane.

## Stack

- Backend: FastAPI, OpenCV, ONNX Runtime, optional InsightFace/ArcFace
- Frontend: Next.js App Router, React, TypeScript
- Contracts: `contracts/openapi.yaml`, `contracts/video.schema.json`
- Runtime data: `data/uploads`, `data/outputs`, `data/candidates`, local state files

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

GPU backend on the `bys` conda environment:

```bash
./scripts/run_gpu_server.sh
```

The GPU script sets the CUDA provider, InsightFace context, cuDNN library path, and starts the API on `127.0.0.1:8001` by default. Use `PORT=8002 ./scripts/run_gpu_server.sh` when 8001 is already occupied.

Frontend:

```bash
cd web
npm install
npm run dev
```

Default frontend: `http://127.0.0.1:3000`

## Video Review Flow

1. Upload a source video.
2. Run candidate face analysis.
3. Select a decision for each face candidate.
4. Submit the render job.
5. Poll job status until completion.
6. Download the rendered video, contact sheet, and QA reports.

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

## Realtime Preview

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

GPU/identity-related values:

```bash
USE_GPU=1
EXECUTION_PROVIDERS=CUDAExecutionProvider,CPUExecutionProvider
PERSONAMASK_FACE_DETECTOR=auto
PERSONAMASK_ONNXRUNTIME_PROVIDER=CUDAExecutionProvider
PERSONAMASK_INSIGHTFACE_CTX_ID=0
PERSONAMASK_INSIGHTFACE_ROOT=/home/bys0626/.insightface
PERSONAMASK_INSIGHTFACE_MODEL=buffalo_l
```

## Verify

Backend:

```bash
NO_ALBUMENTATIONS_UPDATE=1 MPLCONFIGDIR=/tmp/matplotlib PYTHONPYCACHEPREFIX=/tmp/pycache \
  conda run --no-capture-output -n bys python -m unittest discover -s tests -v
```

Frontend:

```bash
npm --prefix web run typecheck
npm --prefix web run lint
```

`tests/test_video_identity_quality.py` uses a local `test_video.mp4` when present. Keep that video local when it contains real people; it is not required for public source checkout.

## License

MIT License. See [`LICENSE`](./LICENSE).
