# Implementation Readiness

작성일: 2026-04-10  
작성자: worker-2 (구현준비/통합 lane)

기준 문서:
- `ARCHITECTURE.md`
- `plan.md`
- `web/README.md`
- `AI_BACKEND_WORKER2_PLAN.md`
- `contracts/openapi.yaml`

## 1. 목적

이 문서는 현재 저장소 상태에서 `app/`, `web/`, `contracts/`를 **실제로 병렬 구현 가능한 작업 단위**로 재구성하고,
각 단위의 **파일 소유권**, **선후관계**, **구현 순서**, **통합 리스크**를 고정하기 위한 준비 문서다.

핵심 목표는 아래 두 가지다.

1. worker-1 / worker-2 / worker-3가 같은 파일을 동시에 건드리지 않고 병렬 전진할 수 있게 한다.
2. `contracts -> app/web 구현 -> 통합 검증` 순서가 무너지지 않도록 최소 의존관계를 잠근다.

## 2. 현재 readiness 스냅샷

### 현재 확인된 상태
- `contracts/openapi.yaml`만 존재하며 P0 API skeleton은 이미 작성되어 있다.
- `web/src/**`는 `.gitkeep` 위주의 placeholder 상태다.
- `app/` 디렉토리는 아직 생성되지 않았다.
- 따라서 현재 병렬 구현은 **문서/계약 선행 + 디렉토리/골격 생성 + 기능별 lane 분리**가 핵심이다.

### 해석
- 가장 먼저 잠가야 하는 것은 `contracts/`의 공통 응답/envelope, realtime/video 상태 전이, multipart 규칙이다.
- `web/`와 `app/`은 계약이 잠기면 서로 다른 파일 집합에서 동시에 구현 가능하다.
- Character Mode는 P0 범위이지만, 현재 저장소 상태상 **privacy/video 경로를 먼저 고정하고 character는 backend hook + frontend preview 준비 단계로 분리**하는 것이 안전하다.

## 3. 파일 소유권 원칙

| 영역 | 소유 lane | 주 파일/디렉토리 | 비고 |
| --- | --- | --- | --- |
| 계약 원본 | worker-3 | `contracts/openapi.yaml`, `contracts/*.schema.json` | 프론트/백엔드 공통 SSOT |
| 백엔드 런타임 | worker-2 | `app/main.py`, `app/core/**`, `app/api/**`, `app/services/**`, `app/pipelines/**`, `app/workers/**`, `app/repositories/**` | Python/FastAPI/GPU/runtime |
| 프론트엔드 UI/브라우저 | worker-1 | `web/src/app/**`, `web/src/components/**`, `web/src/features/**`, `web/src/hooks/**`, `web/src/store/**`, `web/src/lib/**`, `web/public/**` | Next/Web UI + browser capture |
| 경계 문서/정렬 | worker-2 주도, 전원 참고 | `docs/implementation/**`, `docs/api/**`, `docs/frontend/**` | 구현 기준/통합 체크포인트 |

### 충돌 방지 규칙
- worker-1은 `contracts/`를 직접 확장하지 않고 필요한 필드 요구사항을 worker-3에 전달한다.
- worker-2도 `contracts/`의 의미 변경은 직접 확정하지 않고 worker-3와 정렬한다.
- worker-3는 `web/`나 `app/` 구현 대신 계약/검증 기준만 잠근다.
- 공통 파일 충돌 가능성이 가장 큰 곳은 `contracts/openapi.yaml` 하나이며, 여기만 사실상 **single writer**로 운영한다.

## 4. 병렬 구현 단위 (권장 WBS)

### Unit C0. 공통 계약 잠금
- 소유: worker-3
- 파일:
  - `contracts/openapi.yaml`
  - `contracts/errors.schema.json`
  - `contracts/realtime.schema.json`
  - `contracts/video.schema.json`
- 목표:
  - `request_id/data/error` envelope 고정
  - `snake_case` JSON 규칙 고정
  - `binary_jpeg | json_base64` realtime 응답 모드 고정
  - video job 상태 전이 `queued -> processing -> completed|failed|cancelled` 고정
- 선행성: 전체 구현의 최우선
- 병렬 가능성: 문서/디렉토리 scaffold와는 병렬 가능, 실제 API client/router 세부 구현의 기준점 역할

### Unit A0. 백엔드 프로젝트 골격 생성
- 소유: worker-2
- 파일:
  - `app/main.py`
  - `app/__init__.py`
  - `app/api/__init__.py`
  - `app/api/routers/__init__.py`
  - `app/core/__init__.py`
  - `app/services/__init__.py`
  - `app/pipelines/__init__.py`
  - `app/workers/__init__.py`
  - `app/repositories/__init__.py`
- 목표:
  - `python -m app.main --check`가 가능한 최소 import graph 확보
  - 이후 health/diagnostics/realtime/video 작업이 들어갈 파일 경로를 미리 만든다.
- 선행성: `app/`이 비어 있으므로 backend lane의 실질적 1순위
- 병렬 가능성: C0와 병렬 가능

### Unit W0. 프론트엔드 앱 셸/라우트 생성
- 소유: worker-1
- 파일:
  - `web/src/app/layout.tsx`
  - `web/src/app/page.tsx`
  - `web/src/app/character/page.tsx`
  - `web/src/app/privacy/page.tsx`
  - `web/src/app/video/page.tsx`
  - `web/src/app/settings/page.tsx`
- 목표:
  - 제품 모드 진입점과 navigation shell 확보
  - contracts/app 미완성 상태에서도 독립적으로 화면 구조 작업 가능
- 선행성: 낮음
- 병렬 가능성: C0, A0와 완전 병렬 가능

### Unit C1. 읽기 전용/저위험 계약 구체화
- 소유: worker-3
- 파일:
  - `contracts/openapi.yaml`
  - 필요 시 `contracts/errors.schema.json`
- 범위:
  - `GET /health`
  - `GET /diagnostics/runtime`
  - `GET /presets`
- 목표:
  - 초기 앱 셸, diagnostics panel, preset selector가 의존하는 low-risk 응답을 먼저 고정
- 선행성: C0 다음
- 병렬 가능성: A1, W1 착수 조건

### Unit A1. 런타임 self-check + diagnostics backend
- 소유: worker-2
- 파일:
  - `app/core/config.py`
  - `app/core/gpu.py`
  - `app/services/diagnostics_service.py`
  - `app/api/routers/health.py`
  - `app/api/routers/diagnostics.py`
  - `app/api/routers/presets.py`
- 목표:
  - C1 계약에 맞춰 health/diagnostics/presets를 먼저 구현
  - GPU/provider/model/data dir readiness를 진단 payload로 노출
- 선행성: A0 + C1 이후
- 병렬 가능성: W1과 병렬 가능

### Unit W1. 프론트엔드 공통 서비스/diagnostics/preset 소비층
- 소유: worker-1
- 파일:
  - `web/src/services/api-client.ts`
  - `web/src/services/diagnostics-api.ts`
  - `web/src/components/diagnostics/**`
  - `web/src/features/character/**`
  - `web/src/store/diagnostics-store.ts`
- 목표:
  - health/diagnostics/presets 읽기 경로를 먼저 연결
  - 카메라/업로드 전에 앱이 준비상태를 보여줄 수 있게 한다.
- 선행성: C1 이후 권장
- 병렬 가능성: A1과 병렬 가능

### Unit C2. Realtime/allowlist/video batch 계약 잠금
- 소유: worker-3
- 파일:
  - `contracts/openapi.yaml`
  - `contracts/realtime.schema.json`
  - `contracts/video.schema.json`
- 범위:
  - `POST /realtime/sessions`
  - `DELETE /realtime/sessions/{session_id}`
  - `POST /realtime/sessions/{session_id}/frames`
  - `GET/POST/DELETE /allowlist/faces`
  - `POST /videos/jobs`
  - `GET /videos/jobs/{job_id}`
  - `GET /videos/jobs/{job_id}/result`
  - `POST /videos/jobs/{job_id}/cancel`
- 목표:
  - 프레임 업로드 meta JSON, session header, job config, result payload를 고정
- 선행성: C0 이후, 실질적으로 A2/W2의 직접 선행

### Unit A2. Realtime privacy path 구현
- 소유: worker-2
- 파일:
  - `app/schemas/realtime.py`
  - `app/services/realtime_service.py`
  - `app/pipelines/privacy_pipeline.py`
  - `app/api/routers/realtime.py`
  - 필요 시 `app/redactors/**`, `app/detectors/**`, `app/repositories/session_repository.py`
- 목표:
  - session create/close
  - frame upload -> detection/redaction -> jpeg/json response
  - allowlist 적용 가능 구조 확보
- 선행성: A0 + C2
- 병렬 가능성: W2와 병렬 가능

### Unit W2. Realtime UI/camera uploader path 구현
- 소유: worker-1
- 파일:
  - `web/src/hooks/useCameraStream.ts`
  - `web/src/hooks/useRealtimeSession.ts`
  - `web/src/hooks/useFrameUploader.ts`
  - `web/src/services/realtime-api.ts`
  - `web/src/components/camera/**`
  - `web/src/components/preview/**`
  - `web/src/features/privacy/**`
  - `web/src/store/session-store.ts`
- 목표:
  - getUserMedia -> session 생성 -> frame 업로드 -> preview 갱신 루프 구성
- 선행성: C2
- 병렬 가능성: A2와 병렬 가능하되 mock payload 또는 agreed contract fixture 필요

### Unit A3. Video batch backend lifecycle 구현
- 소유: worker-2
- 파일:
  - `app/services/video_job_service.py`
  - `app/pipelines/video_pipeline.py`
  - `app/workers/job_runner.py`
  - `app/workers/video_worker.py`
  - `app/repositories/job_repository.py`
  - `app/api/routers/videos.py`
- 목표:
  - job create/status/cancel/result lifecycle skeleton 확보
  - 실제 모델 연결 전에도 상태 전이와 결과 파일 경로를 검증 가능하게 한다.
- 선행성: A0 + C2
- 병렬 가능성: W3(video UI)와 병렬 가능

### Unit W3. Video batch UI 구현
- 소유: worker-1
- 파일:
  - `web/src/services/video-api.ts`
  - `web/src/hooks/useVideoJob.ts`
  - `web/src/components/uploader/**`
  - `web/src/features/video/**`
  - `web/src/app/video/page.tsx`
- 목표:
  - file upload -> polling -> result download UI 구성
- 선행성: C2
- 병렬 가능성: A3와 병렬 가능

### Unit A4/W4. Character mode 최소 통합
- 소유:
  - backend hook: worker-2
  - preview/render UI: worker-1
- backend 파일:
  - `app/pipelines/character_pipeline.py`
  - 필요 시 `app/renderers/**`
- frontend 파일:
  - `web/src/features/character/**`
  - `web/src/app/character/page.tsx`
  - `web/public/presets-preview/**`
- 목표:
  - P0에서는 backend가 landmark/anchor 기반 hook까지만 제공
  - WebGL/Three.js는 frontend preview/rendering 경계 안에서만 사용
- 선행성: C2 + preset 계약 + realtime 세션 경로
- 병렬 가능성: privacy/video보다 우선순위는 낮고, privacy path가 열린 뒤 착수 권장

## 5. 선후관계 요약

## 반드시 먼저 잠겨야 하는 것
1. `contracts/`의 공통 envelope/헤더/MIME/상태 전이
2. `app/` 골격 생성
3. `web/` route/app shell 생성

## 가장 안전한 병렬 시작 조합
- worker-3: `C0 -> C1`
- worker-2: `A0 -> A1`
- worker-1: `W0 -> W1`

이 조합은 같은 파일 충돌이 없고, 가장 빠르게 **초기 통합 가능 상태**를 만든다.

## 두 번째 병렬 조합
- worker-3: `C2`
- worker-2: `A2 + A3`
- worker-1: `W2 + W3`

이 시점부터는 `mock/fake payload`가 아니라 실제 계약 fixture를 기준으로 개발해야 한다.

## 마지막 통합 조합
- worker-2: `A4`
- worker-1: `W4`
- worker-3: contract drift 점검 및 schema 보강

## 6. 권장 구현 순서

### Phase 1. 계약/골격 준비
1. `contracts` 공통 응답 규칙 잠금
2. `app/` 디렉토리 및 엔트리포인트 골격 생성
3. `web/` route/app shell 생성

### Phase 2. 읽기 전용 경로 우선 통합
4. health/diagnostics/presets 계약 확정
5. diagnostics/presets backend 구현
6. diagnostics/preset UI 연결

### Phase 3. realtime privacy 경로
7. realtime/allowlist 계약 확정
8. realtime session + frame backend 구현
9. camera/session/frame uploader UI 구현
10. contract fixture 기반 통합 점검

### Phase 4. video batch 경로
11. video job 계약 확정
12. job lifecycle backend 구현
13. upload/polling/download UI 구현
14. status/result 통합 점검

### Phase 5. character lane 최소화
15. character preset + session 조건 확정
16. backend anchor/hook 구현
17. frontend preview/render integration 구현

## 7. 통합 체크포인트

### Checkpoint A. Diagnostics Ready
- backend `health/diagnostics/presets` 응답이 계약과 일치한다.
- frontend가 런타임 준비상태와 preset 목록을 렌더링한다.

### Checkpoint B. Realtime Ready
- session 생성 payload와 frame meta 형식이 고정된다.
- `binary_jpeg` 또는 `json_base64` 한 가지를 우선 기본 응답으로 선택하고 양쪽 구현이 동일하게 따른다.
- latency/diagnostics header 처리 방식이 합의된다.

### Checkpoint C. Video Ready
- upload form-data와 `config` JSON string 규칙이 고정된다.
- polling status enum과 결과 다운로드 URL 규칙이 고정된다.

### Checkpoint D. Character Ready
- `mode=character`에서 `preset_id` requirement가 프론트/백엔드에 동일하게 반영된다.
- WebGL/Three.js는 privacy/video 경로로 퍼지지 않는다.

## 8. 주요 리스크와 대응

| 리스크 | 설명 | 영향 | 대응 |
| --- | --- | --- | --- |
| `app/` 부재 | backend 구현 경로가 아직 없다 | worker-2 착수 지연 | A0를 계약 세부 구현보다 먼저 수행 |
| 계약 단일 writer 미준수 | 여러 worker가 `contracts/openapi.yaml`을 동시에 수정할 수 있다 | 충돌/드리프트 | worker-3 단독 소유 유지, 나머지는 요구사항만 전달 |
| realtime 응답 모드 혼선 | `binary_jpeg` vs `json_base64` 처리 기준이 흔들릴 수 있다 | 프론트/백엔드 동시 재작업 | 기본 모드 1개를 우선 고정하고 보조 모드는 fallback으로 추가 |
| allowlist/diagnostics payload 확장 | worker-2 내부 모델과 worker-3 계약 스키마가 어긋날 수 있다 | 구현-계약 mismatch | fixture/예시 payload를 `contracts/` 또는 docs에 함께 관리 |
| Character 범위 확장 | WebGL/Three.js가 privacy/video 영역까지 퍼질 수 있다 | 일정/복잡도 증가 | character lane 한정 원칙 유지 |
| video result 저장 규칙 미정 | download URL, thumbnail, expiry 정책이 늦게 정해질 수 있다 | UI/worker 재수정 | C2에서 result object를 먼저 고정 |
| 상태 전이 불일치 | queued/processing/completed/failed/cancelled 처리 차이 | polling bug | worker-3가 enum을 먼저 고정하고 worker-2가 repository/service 테스트로 검증 |

## 9. 이번 팀 턴 기준 바로 실행 가능한 next actions

### worker-3
1. `contracts/openapi.yaml`의 envelope/headers/realtime/video 상태 전이를 최우선으로 잠근다.
2. `contracts/realtime.schema.json`, `contracts/video.schema.json`, `contracts/errors.schema.json`을 추가한다.

### worker-2
1. `app/` 최소 골격과 `app.main --check` 경로를 먼저 만든다.
2. `health/diagnostics/presets`부터 구현해 frontend의 첫 통합 지점을 만든다.

### worker-1
1. `web/src/app/*` 라우트와 공통 layout/navigation을 먼저 만든다.
2. diagnostics/presets 소비 UI를 먼저 연결하고, camera uploader는 realtime 계약 고정 후 진입한다.

## 10. 결론

현재 저장소의 실제 readiness는 **contracts skeleton 1개 + web placeholder + app 부재** 상태다.
따라서 가장 안전한 병렬 전략은 `contracts 선행 잠금 -> app/web 골격 생성 -> diagnostics/preset 통합 -> realtime/video -> character` 순서를 유지하는 것이다.

이 순서를 지키면 worker 간 파일 충돌을 최소화하면서도, 가장 빨리 사용자에게 보이는 초기 통합 결과를 만들 수 있다.
