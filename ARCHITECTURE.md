# ARCHITECTURE.md

작성일: 2026-04-10  
기준 문서: `plan.md`

## 1. 문서 목적

이 문서는 `plan.md`의 방향을 실제 구현 가능한 형태로 고정하기 위한 아키텍처 기준서다.
핵심 목표는 아래 2가지다.

1. 제품의 최종 구조를 **Character Mask + Privacy Redaction** 중심으로 명확히 정의한다.
2. 프론트엔드와 AI 백엔드가 바로 연동될 수 있도록 **API 통신 규격**을 표준화한다.

본 문서는 P0~P1 구현 기준 아키텍처를 우선 정의하며, P2(WebRTC/저지연 고도화)는 확장 항목으로 분리한다.

---

## 2. 제품 아키텍처 원칙

### 2-1. 제품 정체성
- 실사 얼굴 → 실사 얼굴 face swap은 범위에서 제외한다.
- 제품은 아래 3개 실행 모드로 구성한다.
  - `Character Mask Mode`
  - `Privacy Blur Mode`
  - `Video Privacy Batch`

### 2-2. 처리 원칙
- Character Mode는 **face swap이 아니라 landmark 기반 mask overlay/rendering** 으로 처리한다.
- Privacy Mode는 **보수적 redaction 우선** 원칙을 따른다.
- 실시간 웹캠은 **브라우저 캡처 + HTTP frame 업로드 + 서버 처리 + preview 갱신** 구조를 기본으로 한다.
- 배치 비디오는 **업로드 → 잡 생성 → 비동기 처리 → 결과 다운로드** 구조를 사용한다.
- 초기 단계에서는 단일 사용자/단일 머신 개발 흐름을 우선하고, 이후 세션 분리/분산 처리를 확장 가능하게 설계한다.

### 2-3. 기술 방향
- 프론트엔드: 브라우저 기반 웹 UI
- AI 백엔드: Python 기반 API 서버 + 모델 추론 파이프라인
- 배치 처리: 백그라운드 worker/job runner
- 계약 관리: OpenAPI + 공유 타입 정의

---

## 3. 권장 전체 디렉토리 구조

아래 구조를 루트 기준 표준 구조로 사용한다.

```text
.
├── ARCHITECTURE.md
├── plan.md
├── README.md
├── app/                             # Python AI backend package
│   ├── main.py                      # FastAPI entrypoint, `python -m app.main --check`
│   ├── api/
│   │   ├── deps.py
│   │   ├── errors.py
│   │   ├── middleware.py
│   │   └── routers/
│   │       ├── health.py
│   │       ├── presets.py
│   │       ├── realtime.py
│   │       ├── videos.py
│   │       ├── allowlist.py
│   │       └── diagnostics.py
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   ├── gpu.py
│   │   └── constants.py
│   ├── schemas/                     # Pydantic request/response models
│   │   ├── common.py
│   │   ├── realtime.py
│   │   ├── videos.py
│   │   ├── allowlist.py
│   │   └── diagnostics.py
│   ├── pipelines/
│   │   ├── character_pipeline.py
│   │   ├── privacy_pipeline.py
│   │   ├── video_pipeline.py
│   │   └── orchestrator.py
│   ├── detectors/
│   │   ├── face_detector.py         # InsightFace buffalo_l
│   │   ├── landmark_detector.py
│   │   ├── plate_detector.py
│   │   ├── text_region_detector.py
│   │   └── document_detector.py
│   ├── recognition/
│   │   ├── face_embedder.py
│   │   └── allowlist_matcher.py
│   ├── renderers/
│   │   ├── character_renderer.py
│   │   ├── preset_loader.py
│   │   └── compositor.py
│   ├── redactors/
│   │   ├── blur.py
│   │   ├── mosaic.py
│   │   └── policy.py
│   ├── services/
│   │   ├── realtime_service.py
│   │   ├── video_job_service.py
│   │   ├── allowlist_service.py
│   │   ├── storage_service.py
│   │   └── diagnostics_service.py
│   ├── workers/
│   │   ├── job_runner.py
│   │   └── video_worker.py
│   ├── repositories/
│   │   ├── job_repository.py
│   │   ├── allowlist_repository.py
│   │   └── session_repository.py
│   └── utils/
│       ├── image.py
│       ├── video.py
│       ├── time.py
│       └── ids.py
├── web/                             # Frontend application
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── character/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   ├── video/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── camera/
│   │   │   ├── uploader/
│   │   │   ├── preview/
│   │   │   ├── diagnostics/
│   │   │   └── common/
│   │   ├── features/
│   │   │   ├── character/
│   │   │   ├── privacy/
│   │   │   ├── video/
│   │   │   └── allowlist/
│   │   ├── services/
│   │   │   ├── api-client.ts
│   │   │   ├── realtime-api.ts
│   │   │   ├── video-api.ts
│   │   │   ├── allowlist-api.ts
│   │   │   └── diagnostics-api.ts
│   │   ├── hooks/
│   │   │   ├── useCameraStream.ts
│   │   │   ├── useRealtimeSession.ts
│   │   │   ├── useFrameUploader.ts
│   │   │   └── useVideoJob.ts
│   │   ├── store/
│   │   │   ├── session-store.ts
│   │   │   └── diagnostics-store.ts
│   │   ├── types/
│   │   └── lib/
│   └── public/
│       └── presets-preview/
├── contracts/                       # Frontend-backend single source of truth
│   ├── openapi.yaml
│   ├── realtime.schema.json
│   ├── video.schema.json
│   └── errors.schema.json
├── assets/
│   ├── presets/
│   │   ├── spider/
│   │   ├── bat/
│   │   └── anime_mask/
│   └── overlays/
├── models/
│   ├── insightface/buffalo_l/
│   ├── plates/
│   ├── text/
│   └── documents/
├── data/
│   ├── uploads/
│   ├── outputs/
│   ├── cache/
│   ├── diagnostics/
│   ├── allowlist/
│   └── jobs/
├── scripts/
│   ├── bootstrap_models.sh
│   ├── smoke_test_api.py
│   └── benchmark_realtime.py
├── tests/
│   ├── api/
│   ├── pipelines/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── api/
│   ├── presets/
│   └── troubleshooting/
├── requirements.txt
├── pyproject.toml
└── .env.example
```

---

## 4. 디렉토리별 책임 정의

### 4-1. `app/`
AI 백엔드의 실제 실행 코드다.
- `api/routers`: 외부 HTTP API 엔드포인트
- `schemas`: 계약 스키마
- `pipelines`: 모드별 추론 흐름
- `detectors`: 얼굴/번호판/문서/텍스트 검출
- `recognition`: 얼굴 임베딩 및 allowlist 비교
- `renderers`: 캐릭터 마스크 정렬/합성
- `redactors`: blur/mosaic/redaction 정책
- `workers`: 비디오 배치 비동기 처리

### 4-2. `web/`
사용자가 직접 쓰는 UI다.
- 카메라 접근
- 모드 선택
- 프리셋 선택
- 업로드/다운로드
- 진단 및 오류 표시

### 4-3. `contracts/`
프론트엔드-AI 백엔드 간의 **단일 진실 원본(Single Source of Truth)** 이다.
- OpenAPI 스펙 보관
- JSON Schema 보관
- 필요 시 TS 타입/Pydantic 모델 생성의 기준 사용

### 4-4. `assets/`
캐릭터 프리셋 렌더 리소스 저장소다.
- preset별 색상/anchor/shape 정의
- PNG/SVG/메타데이터 보관

### 4-5. `models/`
실행 모델 파일 보관 위치다.
- Git 추적 대상이 아니라 로컬/배포 환경에서 주입한다.

### 4-6. `data/`
실행 중 생성되는 가변 데이터 저장소다.
- 원본 업로드
- 결과물
- 잡 상태
- allowlist reference 이미지/embedding
- 진단 로그/샘플 프레임

---

## 5. 런타임 구성요소

### 5-1. 프론트엔드
역할:
- `getUserMedia()`로 카메라 획득
- 해상도 축소 및 JPEG/WebP 인코딩
- 프레임 전송 제어(FPS, interval, drop policy)
- 결과 프리뷰 표시
- 배치 업로드 및 상태 polling

### 5-2. AI API 서버
역할:
- 세션 생성/관리
- 실시간 프레임 처리
- allowlist 조회/매칭
- 배치 비디오 잡 생성/상태 제공
- 진단 정보 제공

### 5-3. 배치 Worker
역할:
- 업로드 비디오 디코딩
- 프레임 단위 감지 및 redaction
- 결과 인코딩
- 결과 파일 저장
- 잡 상태 갱신

### 5-4. 저장 계층
초기 단계는 로컬 파일 시스템으로 시작한다.
향후 확장 시 아래 치환 가능:
- `data/uploads`, `data/outputs` → S3/오브젝트 스토리지
- `jobs` → Redis/Postgres 기반 큐/메타데이터 저장

---

## 6. 모드별 처리 흐름

### 6-1. Character Mask Mode
1. 브라우저가 카메라 프레임 캡처
2. 프론트가 `realtime session`에 프레임 업로드
3. 서버가 얼굴 검출 + 랜드마크 추출
4. 가장 큰 얼굴 1명을 기준으로 preset anchor 정렬
5. renderer가 마스크/캐릭터 overlay 합성
6. 처리 프레임과 진단 메타데이터 반환
7. 프론트가 preview 갱신

### 6-2. Privacy Blur Mode
1. 브라우저 프레임 업로드
2. 서버가 얼굴/번호판/문서/텍스트 영역 검출
3. 얼굴은 allowlist embedding 매칭 수행
4. 비허용 영역은 blur/mosaic 적용
5. 처리 프레임과 redaction metadata 반환
6. 프론트가 preview 갱신

### 6-3. Video Privacy Batch
1. 프론트가 비디오 파일 업로드
2. 서버가 `job_id` 생성
3. worker가 비디오 전체 프레임 처리
4. 진행률/상태를 polling API로 노출
5. 완료 시 결과 다운로드 URL 제공

---

## 7. 프론트엔드 ↔ AI 백엔드 API 설계 원칙

### 7-1. 기본 규칙
- Base path: `/api/v1`
- 모든 응답은 `request_id`를 가져야 한다.
- JSON 응답은 snake_case를 기본으로 한다.
- 에러 응답 형식은 통일한다.
- 대용량 binary 전송은 `multipart/form-data` 업로드를 기본으로 한다.
- 실시간 웹캠은 **HTTP polling/frame POST 방식**을 P0 표준으로 한다.
- WebSocket/WebRTC는 P2 확장 항목으로 문서화만 하고 기본 계약에서는 제외한다.

### 7-2. 공통 헤더
#### 요청 헤더
- `X-Request-Id`: 선택, 없으면 서버 생성
- `X-Session-Id`: realtime frame 요청 시 필수

#### 응답 헤더
- `X-Request-Id`: 서버가 최종 request id 반환
- `X-Trace-Latency-Ms`: 선택, 처리 시간 진단용

### 7-3. 공통 성공 응답(JSON)

```json
{
  "request_id": "req_01",
  "data": {},
  "error": null
}
```

### 7-4. 공통 에러 응답(JSON)

```json
{
  "request_id": "req_01",
  "data": null,
  "error": {
    "code": "INVALID_PRESET",
    "message": "지원하지 않는 preset 입니다.",
    "details": {
      "preset": "unknown_mask"
    }
  }
}
```

---

## 8. API 목록

### 8-1. Health / Runtime

#### `GET /api/v1/health`
용도: 서버 상태 확인

응답 예시:
```json
{
  "request_id": "req_health_01",
  "data": {
    "status": "ok",
    "app_version": "0.1.0",
    "gpu": {
      "enabled": true,
      "provider": "CUDAExecutionProvider"
    }
  },
  "error": null
}
```

#### `GET /api/v1/diagnostics/runtime`
용도: 모델 로딩, GPU, preset, queue 상태 확인

---

### 8-2. Character Presets

#### `GET /api/v1/presets`
용도: 사용 가능한 캐릭터 preset 목록 조회

응답 예시:
```json
{
  "request_id": "req_presets_01",
  "data": {
    "items": [
      {
        "preset_id": "spider",
        "label": "Spider Mask",
        "mode": "character",
        "thumbnail_url": "/public/presets-preview/spider.png",
        "supports_realtime": true
      },
      {
        "preset_id": "bat",
        "label": "Bat Mask",
        "mode": "character",
        "thumbnail_url": "/public/presets-preview/bat.png",
        "supports_realtime": true
      }
    ]
  },
  "error": null
}
```

---

### 8-3. Allowlist

#### `POST /api/v1/allowlist/faces`
용도: 허용 얼굴 등록

요청: `multipart/form-data`
- `image`: 얼굴 이미지 파일
- `label`: 사용자 라벨
- `note`: 선택

응답:
```json
{
  "request_id": "req_allow_01",
  "data": {
    "person_id": "person_001",
    "label": "owner",
    "embedding_status": "created"
  },
  "error": null
}
```

#### `GET /api/v1/allowlist/faces`
용도: 등록 목록 조회

#### `DELETE /api/v1/allowlist/faces/{person_id}`
용도: 허용 얼굴 삭제

---

### 8-4. Realtime Session

#### `POST /api/v1/realtime/sessions`
용도: 실시간 모드 세션 생성

요청 JSON:
```json
{
  "mode": "character",
  "preset_id": "spider",
  "stream_profile": {
    "target_fps": 8,
    "frame_width": 960,
    "jpeg_quality": 0.72,
    "response_mode": "binary_jpeg"
  },
  "privacy_options": {
    "blur_faces": true,
    "blur_plates": false,
    "blur_text": false,
    "allowlist_enabled": false
  }
}
```

필드 규칙:
- `mode`: `character | privacy`
- `preset_id`: `mode=character`일 때 필수
- `stream_profile.response_mode`: `binary_jpeg | json_base64`

응답 JSON:
```json
{
  "request_id": "req_rt_session_01",
  "data": {
    "session_id": "rt_sess_001",
    "mode": "character",
    "accepted_profile": {
      "target_fps": 8,
      "frame_width": 960,
      "jpeg_quality": 0.72,
      "response_mode": "binary_jpeg"
    },
    "frame_endpoint": "/api/v1/realtime/sessions/rt_sess_001/frames",
    "expires_in_sec": 1800
  },
  "error": null
}
```

#### `DELETE /api/v1/realtime/sessions/{session_id}`
용도: 세션 종료

---

### 8-5. Realtime Frame Processing

#### `POST /api/v1/realtime/sessions/{session_id}/frames`
용도: 단일 프레임 처리

기본 요청 형식: `multipart/form-data`
- `frame`: JPEG/WebP binary
- `meta`: JSON string

`meta` 예시:
```json
{
  "frame_id": 153,
  "timestamp_ms": 1712712345678,
  "client_width": 960,
  "client_height": 540,
  "rotation_deg": 0,
  "mode": "privacy"
}
```

#### 응답 모드 A: `binary_jpeg` (권장 기본값)
- Content-Type: `image/jpeg`
- Header: `X-Frame-Meta`

`X-Frame-Meta` JSON 예시:
```json
{
  "frame_id": 153,
  "server_latency_ms": 84,
  "detections": {
    "faces_total": 2,
    "faces_redacted": 1,
    "plates_redacted": 0,
    "text_regions_redacted": 3
  },
  "primary_face": {
    "bbox": [120, 90, 320, 310],
    "preset_id": null
  }
}
```

#### 응답 모드 B: `json_base64` (디버그/호환용)
```json
{
  "request_id": "req_frame_153",
  "data": {
    "frame_id": 153,
    "mime_type": "image/jpeg",
    "processed_image_base64": "...",
    "server_latency_ms": 84,
    "detections": {
      "faces_total": 2,
      "faces_redacted": 1,
      "plates_redacted": 0,
      "text_regions_redacted": 3
    }
  },
  "error": null
}
```

#### 처리 규칙
- 프론트는 최신 요청만 유지하고, 이전 프레임 응답이 늦으면 버릴 수 있다.
- 서버는 세션별 순차 처리를 기본으로 하되, `frame_id`가 오래된 경우 drop 가능하다.
- Character Mode는 가장 큰 얼굴 1명만 처리한다.
- Privacy Mode는 검출된 모든 비허용 대상을 처리한다.

---

### 8-6. Video Upload / Batch Job

#### `POST /api/v1/videos/jobs`
용도: 배치 비디오 처리 잡 생성

요청: `multipart/form-data`
- `file`: 업로드 비디오
- `config`: JSON string

`config` 예시:
```json
{
  "mode": "video_privacy",
  "privacy_options": {
    "blur_faces": true,
    "blur_plates": true,
    "blur_text": true,
    "allowlist_enabled": true
  },
  "output_options": {
    "container": "mp4",
    "video_codec": "h264",
    "keep_audio": true
  }
}
```

응답:
```json
{
  "request_id": "req_job_01",
  "data": {
    "job_id": "job_001",
    "status": "queued",
    "status_endpoint": "/api/v1/videos/jobs/job_001",
    "cancel_endpoint": "/api/v1/videos/jobs/job_001/cancel"
  },
  "error": null
}
```

#### `GET /api/v1/videos/jobs/{job_id}`
용도: 잡 상태 조회

응답 예시:
```json
{
  "request_id": "req_job_status_01",
  "data": {
    "job_id": "job_001",
    "status": "processing",
    "progress": {
      "percent": 42,
      "processed_frames": 1260,
      "total_frames": 3000,
      "eta_sec": 48
    },
    "result": null
  },
  "error": null
}
```

완료 응답 예시:
```json
{
  "request_id": "req_job_status_02",
  "data": {
    "job_id": "job_001",
    "status": "completed",
    "progress": {
      "percent": 100,
      "processed_frames": 3000,
      "total_frames": 3000,
      "eta_sec": 0
    },
    "result": {
      "download_url": "/api/v1/videos/jobs/job_001/result",
      "preview_thumbnail_url": "/data/outputs/job_001-thumb.jpg",
      "expires_at": "2026-04-11T00:00:00Z"
    }
  },
  "error": null
}
```

#### `GET /api/v1/videos/jobs/{job_id}/result`
용도: 결과 파일 다운로드

#### `POST /api/v1/videos/jobs/{job_id}/cancel`
용도: 작업 취소

---

## 9. 프론트엔드 상태 모델

프론트엔드는 아래 상태를 명확히 분리해야 한다.

### 9-1. Realtime UI 상태
- `idle`
- `camera_loading`
- `session_starting`
- `streaming`
- `degraded`
- `error`

### 9-2. Batch Job 상태
- `idle`
- `uploading`
- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

### 9-3. Diagnostics 표시 항목
- API 연결 여부
- GPU 사용 여부
- 현재 모드
- 현재 preset
- 최근 latency ms
- 최근 detection count
- 마지막 오류 메시지

---

## 10. 실시간 성능 계약

P0/P1 기준으로 아래를 기본 목표로 한다.

### 10-1. 업로드 프로파일
- 기본 프레임 폭: `960px`
- 기본 target FPS: `6~10`
- JPEG 품질: `0.65~0.78`
- 클라이언트는 백프레셔 발생 시 프레임 드롭 허용

### 10-2. 서버 응답 목표
- 실시간 단일 프레임 평균 latency: `<= 150ms` 목표
- 95p latency: `<= 250ms` 목표
- batch job은 프론트 blocking 없이 polling 기반 처리

### 10-3. 실패 시 동작
- 얼굴 검출 실패 시 Character Mode는 원본 프레임 반환 가능
- Privacy Mode는 검출 실패 부위가 의심되면 보수적 blur 우선 정책 적용
- 모델 일시 실패 시 프론트는 경고 badge 표시

---

## 11. 데이터 계약 세부 규칙

### 11-1. 좌표계
모든 bbox/landmark 좌표는 **처리 대상 프레임 기준 픽셀 좌표**를 사용한다.
- bbox 형식: `[x1, y1, x2, y2]`
- landmark 형식: `[[x, y], ...]`

### 11-2. 시간값
- API 본문 시간 필드는 ISO 8601 UTC 문자열 사용
- frame timing은 `timestamp_ms`(epoch ms) 사용 가능

### 11-3. 파일 포맷
- 입력 이미지: `image/jpeg`, `image/webp`, 선택적으로 `image/png`
- 입력 비디오: `video/mp4`, `video/quicktime`, `video/webm`
- 출력 비디오는 기본 `mp4(h264+aac passthrough or copy)`

### 11-4. 버전 정책
- path versioning: `/api/v1`
- 비호환 변경 시 `/api/v2`
- 필드 추가는 하위 호환으로 간주

---

## 12. 보안 및 운영 가정

초기 구현은 로컬/내부 사용을 전제로 한다.
그래도 아래 원칙은 유지한다.

- 업로드 파일 크기 제한 적용
- 허용 MIME type 검사
- 결과 파일 만료 정책 적용
- allowlist 원본 이미지 접근 제한
- 진단 API는 내부 모드에서만 상세 정보 반환 가능
- 로그에는 원본 이미지 base64 전체 저장 금지

---

## 13. 테스트 관점에서 필요한 검증 축

### 13-1. API 계약 테스트
- OpenAPI 스펙과 실제 응답 일치 여부
- 에러 포맷 일관성
- 필수 필드 누락 시 검증 오류 확인

### 13-2. Realtime 통합 테스트
- webcam frame 업로드 성공
- session 생성/종료 성공
- latency 헤더 반환 확인
- preset별 Character Mode 응답 확인

### 13-3. Batch 통합 테스트
- 업로드 → queued → processing → completed 상태 전이
- 결과 다운로드 가능 여부
- 실패 시 적절한 에러 코드 반환

### 13-4. 모델 품질 테스트
- 미등록 얼굴 blur
- allowlist 얼굴 pass
- 번호판 blur
- 문서/텍스트 blur
- Character preset 정렬 안정성

---

## 14. 우선 구현 순서와 구조 반영

`plan.md` 기준으로 실제 구현 순서는 아래처럼 구조에 맵핑한다.

### Phase 1. 문서/구조 고정
- `ARCHITECTURE.md`
- `contracts/openapi.yaml`
- `app/main.py`
- `web/src/app/*` 라우트 뼈대

### Phase 2. Webcam Privacy MVP
- `app/api/routers/realtime.py`
- `app/pipelines/privacy_pipeline.py`
- `app/recognition/allowlist_matcher.py`
- `web/src/features/privacy/*`

### Phase 3. Video Privacy MVP
- `app/api/routers/videos.py`
- `app/workers/video_worker.py`
- `app/pipelines/video_pipeline.py`
- `web/src/features/video/*`

### Phase 4. Character Mask MVP
- `app/pipelines/character_pipeline.py`
- `app/renderers/character_renderer.py`
- `assets/presets/spider`
- `assets/presets/bat`
- `web/src/features/character/*`

### Phase 5. 성능/진단 고도화
- `app/api/routers/diagnostics.py`
- `scripts/benchmark_realtime.py`
- `web/src/components/diagnostics/*`

---

## 15. 결론

이 프로젝트의 기준 구조는 다음처럼 요약된다.

- **웹 프론트엔드(`web/`)**: 카메라, 모드 선택, 업로드, preview, diagnostics 담당
- **Python AI 백엔드(`app/`)**: detection, recognition, rendering, redaction, batch job 담당
- **계약 계층(`contracts/`)**: 프론트-백엔드 통신 규격의 단일 진실 원본
- **모델/에셋/데이터(`models/`, `assets/`, `data/`)**: 실행 리소스와 결과물 저장

P0 기준 통신 방식은 다음으로 고정한다.

1. **실시간 웹캠**: `session 생성 → frame multipart 업로드 → 처리 프레임 반환`
2. **배치 비디오**: `파일 업로드 → job 생성 → polling → 결과 다운로드`
3. **allowlist**: `등록/조회/삭제 API`로 관리
4. **character preset**: `preset 목록 조회 + preset_id 기반 session 구성`

이 구조로 가면 `plan.md`의 Milestone C/D/G/L/N을 한 구조 안에서 일관되게 구현할 수 있다.
