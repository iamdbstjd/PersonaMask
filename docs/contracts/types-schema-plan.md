# Types & Schema Plan

기준 문서:
- `ARCHITECTURE.md`
- `web/README.md`
- `AI_BACKEND_WORKER2_PLAN.md`
- `contracts/openapi.yaml`

## 1. 목적

이 문서는 `contracts/openapi.yaml`을 기준으로 프론트엔드(`web/`)와 AI 백엔드(`app/`)가 병렬 구현할 때 사용할 **타입/스키마 경계**를 고정한다.
핵심 목표는 아래 4가지다.

1. OpenAPI를 HTTP 계약의 단일 진실 원본(SSOT)으로 유지한다.
2. TypeScript 타입, Pydantic 모델, JSON Schema 산출물이 서로 다른 역할을 갖도록 경계를 분리한다.
3. `realtime`, `video`, `errors` 중심의 schema 파일 계획을 명확히 한다.
4. 구현 전에 검증 규칙을 고정해 worker-1/worker-2가 독자적인 payload shape를 만들지 않도록 한다.

## 2. OpenAPI와 다른 스키마 산출물의 관계

### 2-1. 최상위 원칙
- `contracts/openapi.yaml`이 외부 API surface의 **기준 문서이자 기준 데이터 모델**이다.
- 프론트엔드와 백엔드는 OpenAPI에 없는 필드/enum/status shape를 임의로 추가하지 않는다.
- JSON Schema, TS 타입, Pydantic 모델은 OpenAPI를 **해석하거나 투영한 파생 산출물**로 취급한다.
- 문서 우선순위는 `openapi.yaml` → 파생 schema/json/types → 구현 코드 순서다.

### 2-2. OpenAPI가 직접 책임지는 것
- path/method/operationId
- request/response MIME type
- 공통 헤더 (`X-Request-Id`, `X-Session-Id`, `X-Trace-Latency-Ms`)
- 공통 응답 envelope (`request_id`, `data`, `error`)
- 공개 enum, 상태 전이, identifier 이름 (`session_id`, `job_id`, `person_id`)
- multipart form 필드 이름 (`frame`, `meta`, `file`, `config`, `image`, `label`, `note`)
- 공개 응답의 snake_case 규칙

### 2-3. JSON Schema가 책임지는 것
JSON Schema는 OpenAPI 전체를 대체하지 않고, 아래처럼 **재사용 가능한 payload 검증** 용도로 둔다.

- `meta`, `config`처럼 multipart 안에 JSON string으로 들어오는 구조 검증
- 프론트 mock payload / backend fixture / contract test에서 공통 검증
- 비-HTTP 계층에서도 재사용 가능한 개별 객체 shape 고정
- 향후 smoke test나 schema regression test에서 snapshot 대상으로 사용

즉, JSON Schema는 OpenAPI의 `components.schemas` 일부를 파일 단위로 분리한 **검증용 서브셋**이다.

### 2-4. TypeScript가 책임지는 것
- 프론트엔드 compile-time 타입 안정성
- API client / hooks / store / feature state에서 OpenAPI 기반 응답 shape 소비
- worker-1이 `web/src/types` 또는 `web/src/services`에서 사용하는 DTO 타입 정의

단, TypeScript는 계약 원본이 아니라 **소비자 타입 계층**이다.
- 프론트 전용 UI state (`is_camera_ready`, local upload progress 등)는 별도 타입으로 둘 수 있다.
- 하지만 API payload 자체는 계약 타입을 그대로 감싸거나 참조해야 한다.
- `web/README.md`의 “no bespoke payload shapes outside contracts” 원칙을 그대로 따른다.

### 2-5. Pydantic가 책임지는 것
- 백엔드 request parsing / response serialization / runtime validation
- worker-2가 구현할 `app/schemas/*` 계층의 입력/출력 모델
- router/service 경계에서의 구조적 검증

단, Pydantic 역시 API 계약의 원본이 아니다.
- 공개 request/response 모델은 OpenAPI와 동일한 필드명/enum/nullability를 유지해야 한다.
- 백엔드 내부 전용 모델은 별도 정의할 수 있지만, 외부 응답 직전에 공개 계약 모델로 변환되어야 한다.
- diagnostics처럼 아직 OpenAPI shape가 느슨한 부분은 worker-2 구현 전까지 내부 모델만 정교화하고, 외부 공개 shape는 contract 확정 뒤 동기화한다.

## 3. 경계 표

| 레이어 | 소유 위치 | 목적 | 수정 규칙 |
| --- | --- | --- | --- |
| OpenAPI | `contracts/openapi.yaml` | 외부 HTTP 계약 SSOT | 공개 필드/엔드포인트 변경은 여기서 먼저 수정 |
| JSON Schema | `contracts/*.schema.json` | 공용 payload 검증, fixture 검증 | OpenAPI 컴포넌트와 의미가 다르면 안 됨 |
| TypeScript | `web/src/types` 또는 generated types | 프론트 소비 타입 | 수동 확장 가능하지만 계약 타입을 덮어쓰면 안 됨 |
| Pydantic | `app/schemas/*.py` | 백엔드 파싱/직렬화/검증 | 공개 모델은 OpenAPI와 동일해야 함 |
| Internal backend models | `app/services`, `app/repositories`, `app/workers` 내부 | 구현 편의용 상태/도메인 모델 | 외부 응답 전 공개 계약 모델로 normalize |

## 4. 도메인별 타입 전략

### 4-1. Common envelope / errors
`ARCHITECTURE.md` 7장, 11장 기준으로 모든 JSON 응답은 아래 규칙을 공유한다.
- success: `request_id` + `data` + `error: null`
- failure: `request_id` + `data: null` + `error`
- 공개 필드명은 모두 snake_case

따라서 공통 타입은 각 언어에서 중복 설계하지 말고 아래를 기준으로 맞춘다.
- OpenAPI: `ErrorObject`, `ErrorResponse`
- JSON Schema: `contracts/errors.schema.json`
- TS: `ApiError`, `ErrorResponse`, 필요 시 `ApiSuccess<T>` helper
- Pydantic: `ErrorObject`, `ErrorResponse`, 공통 base response model

### 4-2. Realtime domain
`POST /api/v1/realtime/sessions` + `POST /api/v1/realtime/sessions/{session_id}/frames`가 worker-1/worker-2의 핵심 접점이다.

반드시 고정할 항목:
- `mode: character | privacy`
- `preset_id`는 `mode=character`일 때 필수
- `stream_profile`, `privacy_options`
- frame 업로드 시 `frame` binary + `meta` JSON string
- 응답 모드: `binary_jpeg` 기본, `json_base64` 보조
- `X-Frame-Meta` 헤더 메타데이터 구조

권장 분리:
- OpenAPI: 세션 생성/삭제/프레임 처리 전체 계약
- JSON Schema: `StreamProfile`, `PrivacyOptions`, frame `meta`, `RealtimeFrameJsonResponse.data`, `X-Frame-Meta`
- TS: `RealtimeSessionCreateRequest`, `RealtimeSessionResponse`, `RealtimeFrameJsonResponse`
- Pydantic: 세션 생성 요청, 프레임 메타, JSON 응답 payload 모델

### 4-3. Video batch domain
`POST /videos/jobs`, `GET /videos/jobs/{job_id}`, `POST /cancel`, `GET /result`는 backend worker lifecycle과 frontend polling이 만나는 경계다.

반드시 고정할 항목:
- `config` JSON string 구조 (`VideoJobConfig`)
- 상태 enum: `queued | processing | completed | failed | cancelled`
- `progress` 구조 (`percent`, `processed_frames`, `total_frames`, `eta_sec`)
- `result` nullable 정책
- 결과 다운로드 MIME (`video/mp4`, `video/webm`)

권장 분리:
- OpenAPI: 업로드/polling/result/cancel HTTP 계약
- JSON Schema: `VideoJobConfig`, `JobProgress`, `VideoJobResult`
- TS: batch polling response + upload form helper 타입
- Pydantic: job create/status/cancel 응답 모델 및 내부 상태 → 공개 응답 변환 모델

### 4-4. Allowlist / presets / diagnostics
- `presets`: worker-1 preset selector가 즉시 소비하므로 TS 타입 생성 우선순위가 높다.
- `allowlist`: multipart + response envelope 규칙이 중요하므로 Pydantic/JSON Schema보다 OpenAPI form field 고정이 우선이다.
- `diagnostics`: 현재 OpenAPI가 `additionalProperties: true`로 느슨하므로, worker-2가 runtime/GPU payload를 제안한 뒤 세부 schema를 잠근다.

즉, 이번 단계에서 schema 파일 우선순위는 `realtime > video > errors`이고, diagnostics는 후속 확정 대상으로 둔다.

## 5. schema 파일 계획

`ARCHITECTURE.md`의 권장 구조를 유지하면서 아래 순서로 간다.

### 5-1. 유지 파일
1. `contracts/openapi.yaml`
   - 수동 관리하는 기준 계약
2. `contracts/realtime.schema.json`
   - realtime 공용 payload 검증용
3. `contracts/video.schema.json`
   - batch video config/status/result 검증용
4. `contracts/errors.schema.json`
   - 공통 에러/envelope 검증용

### 5-2. 각 파일의 포함 범위
#### `contracts/realtime.schema.json`
포함 후보:
- `StreamProfile`
- `PrivacyOptions`
- `RealtimeSessionCreateRequest`
- frame `meta` payload
- `DetectionCounts`
- `RealtimeFrameJsonResponse.data`
- `X-Frame-Meta`에 들어갈 메타 payload

제외:
- binary JPEG 본문 자체
- path/header 같은 HTTP 전용 요소

#### `contracts/video.schema.json`
포함 후보:
- `OutputOptions`
- `VideoJobConfig`
- `JobProgress`
- `VideoJobResult`
- `VideoJobStatusResponse.data`
- `VideoJobCancelResponse.data`

제외:
- 실제 업로드 바이너리 파일
- 다운로드 엔드포인트 HTTP 헤더

#### `contracts/errors.schema.json`
포함 후보:
- `ErrorObject`
- `ErrorResponse`
- 공통 JSON envelope 패턴
- 후속으로 error code enum이 생기면 여기에 추가

### 5-3. 후속 후보 파일
지금 바로 추가하지는 않지만, 필요해지면 아래를 별도 파일로 분리할 수 있다.
- `contracts/allowlist.schema.json`
- `contracts/presets.schema.json`
- `contracts/diagnostics.schema.json`

단, 현재 P0에서는 파일 수를 늘리기보다 `realtime/video/errors` 3개를 먼저 고정하는 편이 병렬 구현에 유리하다.

## 6. TypeScript 계획

### 6-1. 생성 원칙
- TS는 가능하면 OpenAPI/JSON Schema 기반 generated type을 우선 사용한다.
- `web/src/types`에는 **생성 타입 재-export + UI 전용 타입만** 둔다.
- API 요청/응답 타입을 `web/src/features/*`에서 직접 재정의하지 않는다.

### 6-2. 프론트에서 필요한 최소 타입 집합
- health/diagnostics/presets 응답 타입
- allowlist list/create/delete 응답 타입
- realtime session create/delete + frame JSON response 타입
- video job create/status/cancel 응답 타입
- `StreamProfile`, `PrivacyOptions`, `VideoJobConfig`

### 6-3. 프론트 로컬 타입으로 허용되는 것
아래는 계약 타입과 분리된 프론트 전용 상태로 둘 수 있다.
- camera permission state
- uploader progress UI state
- preview rendering state
- diagnostics panel open/closed state

그러나 아래는 로컬 독자 타입 금지 대상이다.
- API response shape
- request field names
- enum 값 (`character`, `privacy`, `queued`, `processing` 등)

## 7. Pydantic 계획

### 7-1. 공개 모델 구조
`ARCHITECTURE.md`의 디렉토리 제안에 맞춰 `app/schemas/`에서 공개 모델을 관리한다.
권장 경계:
- `app/schemas/common.py`: envelope, error, 공통 enum/helper
- `app/schemas/realtime.py`: session/frame 관련 공개 모델
- `app/schemas/videos.py`: batch video 공개 모델
- `app/schemas/allowlist.py`: allowlist 공개 모델
- `app/schemas/diagnostics.py`: diagnostics 공개 모델

### 7-2. Pydantic 설계 규칙
- 공개 필드명은 alias 없이 snake_case 그대로 유지
- nullable은 OpenAPI와 동일하게 맞춘다
- enum은 문자열 리터럴을 OpenAPI와 동일하게 유지
- `multipart/form-data`의 JSON string 필드(`meta`, `config`)는 parse 후 Pydantic model로 검증
- router 반환 직전 공개 response model로 직렬화해 contract drift를 막는다

### 7-3. 내부 모델과 공개 모델 분리
worker-2가 job runner / diagnostics / pipeline 내부에서 richer model을 쓰는 것은 허용된다.
하지만 외부 반환 시 아래를 지켜야 한다.
- internal status/detail → 공개 schema에 없는 필드는 제거
- `VideoJobStatusResponse`의 `result` nullability 유지
- realtime binary 응답 시 body는 binary지만 `X-Frame-Meta`는 공개 schema에 맞춰 직렬화

## 8. 검증 규칙

## 8-1. 계약 변경 규칙
- 공개 API 필드 추가는 가능하지만, 삭제/이름 변경/type 변경은 비호환 변경으로 간주한다.
- 비호환 변경은 `/api/v2` 또는 명시적 마이그레이션 없이는 금지한다.
- OpenAPI와 파생 schema/타입이 다르면 OpenAPI를 기준으로 재생성/수정한다.

## 8-2. 스키마 정합성 규칙
- JSON Schema 파일은 OpenAPI `components.schemas`와 의미적으로 동일해야 한다.
- TS/Pydantic 모델은 OpenAPI 필수 필드(required), enum, nullable, format을 그대로 반영해야 한다.
- `diagnostics`처럼 임시로 느슨한 부분만 예외로 두고, 나머지 공개 payload는 `additionalProperties`를 보수적으로 제한한다.

## 8-3. 런타임 검증 규칙
- allowlist 업로드: MIME/type/required field 검증
- realtime session: `mode=character`일 때 `preset_id` 필수
- realtime frame: `X-Session-Id` 필수, `meta` JSON parse 가능해야 함
- video job: `config` JSON parse 가능해야 하고 상태 전이는 정의된 enum만 허용
- error 응답: 항상 `data: null`, `error.code`, `error.message` 유지

## 8-4. 테스트/자동화 규칙
구현 시작 후 최소 검증 세트는 아래를 기준으로 한다.
- OpenAPI lint / parse 검증
- JSON Schema fixture validation
- backend Pydantic model ↔ OpenAPI example alignment test
- frontend mock payload ↔ generated TS type compile check
- batch 상태 전이 contract test
- realtime `binary_jpeg` / `json_base64` 두 응답 모드 검증

## 9. 워커 간 인터페이스 기준

### worker-1에게 필요한 확정 포인트
- presets/realtime/video 응답 타입은 OpenAPI 기반 generated type을 소비
- frame response는 `binary_jpeg` 기본 가정으로 UI 설계
- `json_base64`는 디버그/호환 fallback으로만 사용

### worker-2에게 필요한 확정 포인트
- `app/schemas/*` 공개 모델은 OpenAPI 우선
- diagnostics 상세 payload 제안 시 worker-3가 OpenAPI/JSON Schema에 반영
- job lifecycle/status enum은 worker-2가 새 값을 임의 추가하지 않음

## 10. 즉시 다음 작업

1. `contracts/openapi.yaml`의 `components.schemas`를 기준으로 `realtime/video/errors` 스키마 범위를 잠근다.
2. worker-2가 diagnostics payload 세부 필드를 제안하면 `diagnostics`를 느슨한 object에서 구체 schema로 축소한다.
3. worker-1 구현 시작 전, 프론트가 소비할 TS 타입 import 경로를 계약 기준으로 통일한다.

## 11. leader 보고용 핵심 요약

- OpenAPI를 외부 HTTP 계약 SSOT로 두고, JSON Schema/TS/Pydantic는 모두 파생 산출물로 정리한다.
- P0 schema 파일은 `contracts/realtime.schema.json`, `contracts/video.schema.json`, `contracts/errors.schema.json` 3개를 우선 고정하고 diagnostics는 worker-2 payload 제안 후 세분화한다.
- 프론트는 generated contract type만 소비하고, 백엔드는 `app/schemas/*` 공개 모델을 OpenAPI와 동일하게 유지해 contract drift를 막는다.
