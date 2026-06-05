# PersonaMask Video Review

Saved-video privacy review 콘솔 프로젝트입니다.

이 저장소는 기존 character mask/realtime 중심 스캐폴딩을 **저장 영상 프라이버시 검토 콘솔** 방향으로 전환한 FastAPI + Next.js 프로젝트입니다.
현재 기준으로 핵심 흐름은 다음 세 가지입니다.

- 저장 영상 후보 얼굴 분석 (`/api/v1/videos/candidates`)
- 저장 영상 렌더 작업 처리 (`/api/v1/videos/jobs/*`)
- 실시간 카메라 프리뷰 (`/api/v1/realtime/*`)

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [UI Preview](#ui-preview)
3. [파일 구조](#파일-구조)
4. [아키텍처](#아키텍처)
5. [사용자 가이드](#사용자-가이드)
6. [개발자 가이드](#개발자-가이드)
7. [API 요약](#api-요약)

---

## 프로젝트 개요

### 목표

- 저장 영상을 업로드하고 얼굴 후보를 먼저 검토할 수 있는 리뷰 흐름 제공
- 작업자가 보존할 사람/표현 방식을 결정한 뒤 `blur`, `preserve`, `character` 모드로 결과 영상을 렌더
- 실시간 카메라는 주 제품 흐름이 아니라 preview/calibration lane으로 유지
- 프론트엔드/백엔드 계약을 `contracts/openapi.yaml` 중심으로 관리

### 현재 상태

- 백엔드: health/diagnostics/presets/allowlist/realtime/videos + 후보 얼굴 분석 API
- 프론트엔드: overview/realtime preview/video review/settings 콘솔 + 후보 리뷰 보드
- 처리 파이프라인: 현재는 OpenCV baseline이며, YOLO/ArcFace/정교한 tracker는 이후 확장 대상
- 비디오 모드:
  - `blur`: 모든 얼굴/번호판/텍스트를 보수적으로 redaction
  - `preserve`: allowlist 정책이 켜진 경우 primary face를 보존하고 나머지는 blur
  - `character`: allowlist 정책이 켜진 경우 primary face를 캐릭터 스타일로 대체하고 나머지는 blur
- 렌더 완료 후 자동 생성:
  - `qa-report.json`: 처리 프레임 수, 검출/리댁션 합계, blur 강도, 누락 의심 구간, 후보 액션
  - `qa-report.md`: 사람이 읽기 쉬운 Redaction QA Report
  - contact sheet: redaction 전후 프레임 샘플 비교 이미지

---

## UI Preview

![PersonaMask saved video review UI](docs/assets/video-review-ui.png)

---

## 파일 구조

```text
.
├─ .env.example
├─ .gitignore
├─ requirements.txt
├─ app/
│  ├─ main.py
│  ├─ api/
│  │  └─ routers/
│  │     ├─ health.py
│  │     ├─ diagnostics.py
│  │     ├─ presets.py
│  │     ├─ allowlist.py
│  │     ├─ realtime.py
│  │     └─ videos.py
│  ├─ core/
│  │  ├─ config.py
│  │  └─ gpu.py
│  ├─ repositories/
│  │  ├─ session_repository.py
│  │  └─ job_repository.py
│  ├─ schemas/
│  │  ├─ common.py
│  │  ├─ allowlist.py
│  │  ├─ realtime.py
│  │  └─ videos.py
│  └─ services/
│     ├─ diagnostics_service.py
│     ├─ allowlist_service.py
│     ├─ video_candidate_service.py
│     ├─ realtime_service.py
│     └─ video_job_service.py
├─ contracts/
│  ├─ openapi.yaml
│  ├─ errors.schema.json
│  ├─ realtime.schema.json
│  └─ video.schema.json
└─ web/
   ├─ public/
   │  └─ presets-preview/
   └─ src/
      ├─ app/
      │  ├─ page.tsx
      │  ├─ layout.tsx
      │  ├─ character/page.tsx
      │  ├─ privacy/page.tsx
      │  ├─ video/page.tsx
      │  └─ settings/page.tsx
      ├─ components/
      │  ├─ camera/
      │  ├─ common/
      │  ├─ diagnostics/
      │  ├─ preview/
      │  └─ uploader/
      ├─ features/
      │  ├─ character/
      │  ├─ privacy/
      │  ├─ video/
      │  └─ allowlist/
      ├─ hooks/
      ├─ services/
      ├─ store/
      ├─ lib/
      └─ types/
```

---

## 아키텍처 (Mermaid)

### 1) 시스템 컴포넌트 아키텍처

```mermaid
flowchart LR
    User["사용자 브라우저"] --> WebUI["Web Console<br/>web/src/app + features"]

    WebUI -->|HTTP| API["FastAPI<br/>app/main.py"]

    API --> Health[Health/Diagnostics Router]
    API --> Presets[Presets Router]
    API --> Allowlist[Allowlist Router]
    API --> Realtime[Realtime Router]
    API --> Videos[Video Router]

    Realtime --> SessionRepo[(Session Repository)]
    Videos --> CandidateAnalysis[Candidate Analysis<br/>sample frames and face crops]
    Videos --> JobRepo[(Job Repository)]
    Videos --> VideoPipeline[Video Review Pipeline<br/>blur / preserve / character]

    Realtime --> DataDir[(data/uploads, data/outputs)]
    Videos --> DataDir

    API --> Contracts["contracts/openapi.yaml<br/>JSON Schemas"]
```

### 2) 백엔드 내부 계층 아키텍처

```mermaid
flowchart TB
    subgraph Entry[Entry]
      Main["app/main.py<br/>create_app(), check mode"]
    end

    subgraph Router[API Routers]
      R1[health.py]
      R2[diagnostics.py]
      R3[presets.py]
      R4[allowlist.py]
      R5[realtime.py]
      R6[videos.py]
    end

    subgraph Service[Services]
      S1[diagnostics_service.py]
      S2[allowlist_service.py]
      S3[realtime_service.py]
      S4[video_job_service.py]
      S5[video_candidate_service.py]
    end

    subgraph Repo[Repositories]
      DB1[session_repository.py]
      DB2[job_repository.py]
    end

    subgraph Schema[Schemas]
      M1[common.py]
      M2[allowlist.py]
      M3[realtime.py]
      M4[videos.py]
    end

    Main --> Router
    Router --> Service
    Service --> Repo
    Router --> Schema
    Service --> Schema
```

### 3) 실시간 프레임 처리 시퀀스

```mermaid
sequenceDiagram
    participant U as Browser
    participant A as FastAPI
    participant S as RealtimeService
    participant R as SessionRepository

    U->>A: POST /api/v1/realtime/sessions
    A->>S: create_session(payload)
    S->>R: create(...)
    R-->>S: session_id
    S-->>A: RealtimeSessionData
    A-->>U: session 정보 응답

    loop 프레임 업로드 반복
      U->>A: POST /realtime/sessions/{id}/frames
      A->>S: process_frame(session_id, frame, meta)
      S->>R: get(session_id)
      S->>R: touch_frame(...)
      S-->>A: binary_jpeg 또는 json_base64
      A-->>U: 처리 프레임 + 메타
    end

    U->>A: DELETE /realtime/sessions/{id}
    A->>S: delete_session(id)
    S->>R: delete(id)
    A-->>U: 삭제 결과
```

### 4) 비디오 배치 작업 상태 전이

```mermaid
stateDiagram-v2
    [*] --> queued: create_job
    queued --> processing: get_job() poll
    processing --> completed: advance 완료
    processing --> failed: 오류 발생
    queued --> cancelled: cancel_job
    processing --> cancelled: cancel_job
    completed --> [*]
    failed --> [*]
    cancelled --> [*]
```

---

## 사용자 가이드

> 현재 프로젝트는 **개발자/테스터용 스켈레톤** 중심입니다.

### 1) 준비

```bash
cd /path/to/PersonaMask
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2) 런타임 점검

```bash
python -m app.main --check
```

- GPU provider, 환경값, 기본 상태를 JSON으로 출력합니다.

### 3) 서버 실행

```bash
python -m app.main --host 127.0.0.1 --port 8001
```

### 4) 웹 콘솔 실행

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

- 기본 웹 콘솔 주소: `http://127.0.0.1:3000`
- 기본 API 프록시 대상: `http://127.0.0.1:8001` (`BACKEND_ORIGIN`)

### 5) 기본 API 확인

```bash
curl http://127.0.0.1:8001/api/v1/health
curl http://127.0.0.1:8001/api/v1/diagnostics/runtime
curl http://127.0.0.1:8001/api/v1/presets
```

### 6) 실시간 세션 빠른 테스트

```bash
# 세션 생성
curl -X POST http://127.0.0.1:8001/api/v1/realtime/sessions \
  -H 'Content-Type: application/json' \
  -d '{
        "mode":"privacy",
        "stream_profile":{"target_fps":10,"response_mode":"binary_jpeg"},
        "privacy_options":{"allowlist_enabled":false,"blur_plates":true,"blur_text":true}
      }'
```

### 7) 저장 영상 리뷰 빠른 테스트

```bash
curl -X POST http://127.0.0.1:8001/api/v1/videos/candidates \
  -F 'file=@sample.mp4'
```

```bash
curl -X POST http://127.0.0.1:8001/api/v1/videos/jobs \
  -F 'file=@sample.mp4' \
  -F 'config={"mode":"preserve","analysis_id":"analysis_demo","candidate_actions":{"face_0001":"preserve","face_0002":"blur"},"privacy_options":{"blur_faces":true,"blur_plates":true,"blur_text":true,"allowlist_enabled":true}}'
```

작업 완료 후 status 응답의 `result`에는 다음 다운로드 경로가 함께 포함됩니다.

- `download_url`: 렌더 결과 영상
- `contact_sheet_url`: redaction 전후 contact sheet
- `qa_report_json_url`: 기계 판독용 QA 리포트
- `qa_report_markdown_url`: 리뷰 공유용 Markdown 리포트

---

## 개발자 가이드

### 1) 개발 원칙

- API 계약 우선: `contracts/openapi.yaml`을 기준으로 라우터/스키마/프론트 호출부를 맞춥니다.
- 계층 분리 유지:
  - Router: 입출력 바인딩
  - Service: 유스케이스/비즈니스 로직
  - Repository: 상태 저장/조회
  - Schema: 타입/검증

### 2) 새 API 추가 절차

1. `contracts/openapi.yaml`에 엔드포인트/스키마 정의
2. `app/schemas/*`에 대응 모델 추가
3. `app/services/*`에 로직 추가
4. `app/api/routers/*`에서 라우팅 연결
5. `web/src/services/*` 및 필요한 훅/스토어 연결

### 3) 프론트엔드 작업 절차

1. `web/src/app/*`에서 라우트 엔트리 작성
2. `web/src/features/*`에서 화면 단위 조합
3. `web/src/components/*`에서 재사용 UI 분리
4. `web/src/hooks/*`와 `web/src/services/*`로 로직 분리
5. `web/src/store/*`로 상태 통합

### 4) 권장 검증 체크

```bash
python -m app.main --check
python -m compileall app
cd web && npm run typecheck && npm run build
```

필요 시:

- API 수동 호출(curl)
- Realtime frame 업로드 시나리오 확인
- Video job create/status/cancel/result 흐름 확인

### 5) 커밋 규칙 (권장)

- 제목: 영어 conventional style (`feat:`, `fix:`, `docs:`, `chore:`)
- 본문: 변경 배경/제약/검증 내용을 한글로 구체적으로 작성

---

## API 요약

### 공통

- Base URL: `http://<host>:<port>/api/v1`
- 응답 형태(대부분):

```json
{
  "request_id": "...",
  "data": {"...": "..."},
  "error": null
}
```

### 엔드포인트

- `GET /health`
- `GET /diagnostics/runtime`
- `GET /presets`
- `POST /allowlist/faces`
- `GET /allowlist/faces`
- `DELETE /allowlist/faces/{person_id}`
- `POST /realtime/sessions`
- `DELETE /realtime/sessions/{session_id}`
- `POST /realtime/sessions/{session_id}/frames`
- `POST /videos/candidates`
- `GET /videos/candidates/{analysis_id}/{candidate_id}`
- `POST /videos/jobs`
- `GET /videos/jobs/{job_id}`
- `POST /videos/jobs/{job_id}/cancel`
- `GET /videos/jobs/{job_id}/result`
- `GET /videos/jobs/{job_id}/thumbnail`
- `GET /videos/jobs/{job_id}/contact-sheet`
- `GET /videos/jobs/{job_id}/qa-report.json`
- `GET /videos/jobs/{job_id}/qa-report.md`

### 후보 리뷰 보드

웹 콘솔의 saved-video workflow는 업로드 후 후보 얼굴을 카드로 보여주고 후보별 액션을 config에 반영합니다.

- `preserve`: 이 후보를 보존 대상으로 표시
- `character`: 이 후보를 캐릭터 대체 대상으로 표시
- `blur`: 이 후보를 redaction 대상으로 표시
- `track`: 모든 프레임 추적이 필요한 후보로 표시

현재 renderer는 OpenCV baseline이므로 후보별 identity tracking은 아직 실제 매칭 엔진으로 연결되지 않았습니다. 후보 액션은 렌더 모드/allowlist 설정과 QA 리포트에 반영되며, 실제 프레임 전체 ID 추적은 이후 YOLO/ArcFace/tracker 통합 단계입니다.

### 비디오 렌더 모드

- `blur`: allowlist와 무관하게 모든 얼굴을 redaction 대상으로 처리
- `preserve`: allowlist 정책이 켜진 경우 primary face를 보존하고 나머지는 redaction
- `character`: allowlist 정책이 켜진 경우 primary face를 캐릭터 스타일로 대체하고 나머지는 redaction
- `video_privacy`: 기존 호환용 legacy alias이며 `blur`로 처리

---

## 라이선스

현재 별도 LICENSE 파일은 포함하지 않았습니다.
필요 시 정책 확정 후 추가하세요.
