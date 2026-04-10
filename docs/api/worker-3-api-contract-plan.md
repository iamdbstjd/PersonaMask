# Worker-3 API·계약·검증 계획

기준 문서:
- `ARCHITECTURE.md`
- `plan.md`

## 1. worker-3 책임 범위

worker-3은 프론트엔드(`web/`)와 AI 백엔드(`app/`) 사이의 계약 계층을 먼저 고정하는 역할을 맡는다.
현재 문서 기준 소유 범위는 다음 3개다.

1. `contracts/openapi.yaml`
   - P0 표준 API surface를 단일 진실 원본으로 관리
2. 프론트-백엔드 인터페이스 규칙
   - 공통 헤더, 응답 envelope, `snake_case`, 버전 정책, MIME 제약, 상태 전이 규칙 고정
3. 검증 체크리스트
   - OpenAPI와 실제 구현이 어긋나지 않도록 계약 테스트/통합 테스트 기준 정의

## 2. 이번 턴 산출물

### 완료한 산출물
- `contracts/openapi.yaml`
  - Health / Diagnostics / Presets / Allowlist / Realtime / Video Jobs의 P0 스켈레톤 추가
- `docs/api/worker-3-api-contract-plan.md`
  - worker-3의 책임, 우선 구현 순서, 검증 기준을 문서화

### 다음 산출물(후속 작업)
- `contracts/realtime.schema.json`
- `contracts/video.schema.json`
- `contracts/errors.schema.json`
- backend/router ↔ frontend/api-client 매핑 표
- 계약 테스트용 fixture 및 smoke checklist

## 3. API 소유 표면

### 공통 계약
- Base path: `/api/v1`
- 공통 요청 헤더: `X-Request-Id`, `X-Session-Id`(realtime frame 필수)
- 공통 응답 규칙:
  - JSON 응답은 `request_id`, `data`, `error` 구조 유지
  - JSON 필드는 `snake_case`
  - 처리 시간 진단용 `X-Trace-Latency-Ms` 헤더 허용
- 버전 정책:
  - P0/P1은 `/api/v1`
  - 비호환 변경 시 `/api/v2`

### 기능별 계약 범위
1. Health / Diagnostics
   - 런타임 준비 상태, GPU/provider, preset/queue readiness 노출 범위 정의
2. Presets
   - 프론트 preset selector가 바로 소비할 수 있는 목록 응답 정의
3. Allowlist
   - 등록/조회/삭제 API와 multipart 업로드 규격 정의
4. Realtime Sessions / Frames
   - 세션 생성, 세션 종료, 단일 프레임 업로드/응답 모드 정의
5. Video Jobs
   - 업로드, 상태 polling, 취소, 결과 다운로드 규격 정의

## 4. 첫 구현 순서

### 1단계. 공통 계약 잠금
- 공통 envelope, 에러 포맷, 헤더, enum 값, MIME 타입을 먼저 고정
- 이유: worker-1과 worker-2가 동시에 구현해도 응답 모양이 흔들리지 않게 해야 함

### 2단계. 읽기 전용/저위험 엔드포인트 고정
- `GET /health`
- `GET /diagnostics/runtime`
- `GET /presets`
- 이유: 프론트 초기 화면, diagnostics panel, backend runtime readiness 확인에 바로 필요

### 3단계. allowlist 계약 고정
- `POST/GET/DELETE /allowlist/faces`
- 이유: privacy 흐름에서 blur 제외 규칙이 API 레벨에서 먼저 결정되어야 함

### 4단계. realtime 계약 고정
- `POST /realtime/sessions`
- `DELETE /realtime/sessions/{session_id}`
- `POST /realtime/sessions/{session_id}/frames`
- 이유: worker-1의 webcam UI와 worker-2의 privacy/character pipeline이 만나는 핵심 지점

### 5단계. video batch 계약 고정
- `POST /videos/jobs`
- `GET /videos/jobs/{job_id}`
- `GET /videos/jobs/{job_id}/result`
- `POST /videos/jobs/{job_id}/cancel`
- 이유: 업로드 → polling → 다운로드 흐름은 프론트/백엔드 동시 개발의 핵심 경계면

### 6단계. 검증 자동화 연결
- OpenAPI ↔ 구현 응답 shape 일치 검증
- 상태 전이 및 에러 코드 검증
- 프론트 mock payload와 backend smoke response 상호 검증

## 5. 검증 체크리스트

### A. 계약 정합성
- [ ] OpenAPI에 정의된 path/method가 실제 라우터 구현과 일치한다.
- [ ] 성공 응답이 모두 `request_id/data/error` envelope를 유지한다.
- [ ] 에러 응답이 모두 `request_id/data=null/error` 형식을 유지한다.
- [ ] JSON 필드명이 `snake_case`를 유지한다.
- [ ] 비호환 변경 없이 필드 추가만 이뤄지는지 확인한다.

### B. Realtime 검증
- [ ] `POST /realtime/sessions`에서 `mode`, `stream_profile`, `privacy_options` 제약이 검증된다.
- [ ] `mode=character`일 때 `preset_id` 요구사항이 backend/frontend에 동일하게 반영된다.
- [ ] `POST /frames`에서 `X-Session-Id` 요구사항이 구현과 문서에 동일하게 반영된다.
- [ ] `binary_jpeg` 응답 시 `X-Frame-Meta`와 latency header가 반환된다.
- [ ] `json_base64` 응답 시 detections 필드가 문서와 동일하다.

### C. Video batch 검증
- [ ] 업로드가 `multipart/form-data` + JSON string `config` 규칙을 따른다.
- [ ] 상태가 `queued -> processing -> completed|failed|cancelled`로 일관되게 전이된다.
- [ ] 완료 시 `download_url`, `preview_thumbnail_url`, `expires_at`이 채워진다.
- [ ] 결과 다운로드 엔드포인트의 MIME 타입이 문서와 구현에 일치한다.

### D. Allowlist 검증
- [ ] 얼굴 등록은 `image + label (+ note)` 규칙을 지킨다.
- [ ] 등록/조회/삭제 응답 shape가 동일한 공통 envelope를 사용한다.
- [ ] 삭제 대상 없음/잘못된 이미지 업로드 같은 실패 케이스 에러 코드가 고정된다.

### E. 운영/보안 가정 검증
- [ ] 허용 MIME type 제한이 구현된다.
- [ ] 업로드 파일 크기 제한이 구현된다.
- [ ] allowlist 원본 이미지 접근 제한 정책이 문서화된다.
- [ ] 로그에 원본 이미지 base64 전체 저장 금지 규칙이 준수된다.

## 6. 다른 워커와의 경계

### worker-1과의 인터페이스
- preset list shape
- realtime session 생성 payload
- frame response mode(`binary_jpeg`, `json_base64`)
- video job polling/result payload

### worker-2와의 인터페이스
- request validation rules
- allowlist/realtime/video job response schema
- diagnostics payload refinement
- error code taxonomy 확정

## 7. leader 보고용 요약

- worker-3은 `contracts/openapi.yaml`을 먼저 잠그는 방향으로 진행한다.
- 첫 구현 순서는 `공통 envelope/헤더 -> health/diagnostics/presets -> allowlist -> realtime -> video jobs -> 검증 자동화`다.
- 프론트/백엔드 병렬 작업을 위해 지금 필요한 최소 계약 스켈레톤과 검증 체크리스트를 먼저 추가했다.
