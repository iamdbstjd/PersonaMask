# Frontend UI Spec

기준 문서:
- `ARCHITECTURE.md`
- `web/README.md`
- `AI_BACKEND_WORKER2_PLAN.md`
- `contracts/openapi.yaml`

문서 목적:
- 구현 전 `web/` UI의 화면 방향과 책임 경계를 고정한다.
- worker-1이 실제 UI를 만들 때 page/layout/state/component 기준을 흔들리지 않게 한다.
- worker-2/worker-3와 만나는 계약면(API, diagnostics, character hook)을 프론트 관점에서 정리한다.

> 참고: `web/src/app/layout.tsx`, `page.tsx` 구조가 아키텍처에 명시되어 있으므로, 본 문서는 **App Router 계열의 React UI 구조**를 전제로 작성한다. 이는 현재 디렉터리 설계로부터의 합리적 추론이다.

## 1. 제품 UI 방향: clean / minimal / polished

### 1-1. 핵심 원칙
1. **Operator-first**
   - 실시간 미리보기, 현재 모드, latency, 오류 상태가 한눈에 보여야 한다.
2. **1 screen = 1 primary action**
   - Character: preset 선택 + 실시간 합성 확인
   - Privacy: blur 정책 조정 + 실시간 검수
   - Video: 업로드 + 진행률 추적 + 결과 다운로드
3. **기본은 차분하고 정보는 명확하게**
   - 색은 neutral base + 상태색(success/warn/error)만 제한적으로 사용
   - 테두리/그림자는 약하게, spacing과 typography로 위계 표현
4. **진단 정보는 숨기지 않되 전면화하지 않는다**
   - diagnostics는 보조 rail/card에서 항상 접근 가능하게 유지
5. **계약 우선 UI**
   - 프론트 상태명, API payload, 에러 표현은 `ARCHITECTURE.md` 및 `contracts/openapi.yaml`의 용어를 그대로 따른다.

### 1-2. 시각 스타일 가이드
- 배경: off-white 또는 dark-neutral 단색 기반
- 카드: 얇은 border + 낮은 contrast surface
- radius: 중간값(과도한 pill 지양)
- 타이포: 제목/설명/메타 3단 위계만 유지
- 아이콘: 텍스트 보조 용도만 허용, 과도한 일러스트/장식 금지
- 애니메이션: 150~200ms 범위의 짧은 전환만 사용

## 2. 전역 정보 구조

## 2-1. 라우트
- `/` → overview/home
- `/character` → Character Mask Mode
- `/privacy` → Privacy Blur Mode
- `/video` → Video Privacy Batch
- `/settings` → API/runtime/preferences/settings

## 2-2. 공통 앱 셸
모든 페이지는 아래 3단 구조를 공유한다.

1. **Top bar**
   - 제품명
   - 현재 route
   - API 연결 상태
   - 최근 latency badge
2. **Primary content**
   - 페이지별 핵심 작업 영역
3. **Secondary diagnostics rail**
   - GPU/API/runtime/session/job 상태
   - 마지막 오류
   - 현재 모드/현재 preset

### 2-3. 반응형 규칙
- desktop: `left nav / main / right diagnostics rail`
- tablet: `top nav / main / collapsible diagnostics drawer`
- mobile: 실시간 기능이 핵심이므로 지원은 하되, P0 우선순위는 desktop/tablet
- Character/Privacy의 preview는 항상 first-class 영역으로 유지하고 fold 아래로 밀지 않는다.

## 3. 페이지별 레이아웃

## 3-1. `/` Overview
목적:
- 3개 주요 모드로 빠르게 진입
- 시스템 준비 상태를 첫 화면에서 확인

레이아웃:
- Hero summary card
  - `API connected / GPU ready / presets loaded / last job status`
- Mode entry cards (Character / Privacy / Video)
- Recent diagnostics summary
- Quick links
  - allowlist 준비 상태
  - settings

핵심 컴포넌트:
- `AppShell`
- `ModeCardGrid`
- `RuntimeSummaryCard`
- `DiagnosticsSnapshot`

## 3-2. `/character`
목적:
- preset 선택 후 실시간 캐릭터 마스크 프리뷰를 확인

레이아웃:
- 좌측: preset selector + preset thumbnail grid
- 중앙: large preview stage
- 우측: session controls + diagnostics
- 하단 보조 영역: preset description / fallback messages

핵심 사용자 흐름:
1. preset 선택
2. camera 권한 허용
3. realtime session 생성 (`mode=character`)
4. frame upload / preview update
5. latency, detection, degraded 상태 확인

핵심 컴포넌트:
- `CharacterPresetPanel`
- `CameraViewport`
- `CharacterPreviewStage`
- `SessionControlCard`
- `DiagnosticsPanel`
- `StatusBanner`

주의점:
- Character는 preview가 핵심이므로, controls보다 preview 영역을 크게 유지
- 얼굴 미검출 시에도 화면이 비지 않게 원본 프레임 + fallback notice를 유지

## 3-3. `/privacy`
목적:
- 얼굴/번호판/문서/텍스트 blur 정책을 조정하며 실시간 privacy 결과를 확인

레이아웃:
- 좌측: privacy options + allowlist 상태
- 중앙: before/after preview
- 우측: session status + detection counts + error/warning

핵심 사용자 흐름:
1. blur policy toggle 설정
2. allowlist 사용 여부 확인
3. realtime session 생성 (`mode=privacy`)
4. frame upload / redaction preview 확인
5. detection/redaction count 검수

핵심 컴포넌트:
- `PrivacyOptionsForm`
- `AllowlistStatusCard`
- `BeforeAfterPreview`
- `DetectionSummaryCard`
- `SessionControlCard`
- `DiagnosticsPanel`

주의점:
- Privacy는 정책 신뢰가 중요하므로 before/after 비교가 Character보다 우선
- 검출 실패 시 경고 badge와 보수적 blur 정책 메시지를 노출

## 3-4. `/video`
목적:
- 비디오 업로드, job 추적, 결과 다운로드

레이아웃:
- 상단: upload dropzone + config form
- 중앙: job status timeline / progress
- 하단: result card (thumbnail, download, expiry)
- 보조 영역: 최근 실패 사유 / cancellation affordance

핵심 사용자 흐름:
1. 파일 업로드
2. `video_privacy` config 제출
3. `queued -> processing -> completed|failed|cancelled` 상태 polling
4. 완료 시 preview thumbnail / download URL 제공

핵심 컴포넌트:
- `VideoUploadDropzone`
- `VideoConfigPanel`
- `JobProgressCard`
- `JobTimeline`
- `VideoResultCard`
- `ErrorNotice`

주의점:
- batch는 blocking UI가 아니라 status-centric UI여야 한다.
- 업로드 후에도 사용자는 설정/다른 페이지를 확인할 수 있어야 한다.

## 3-5. `/settings`
목적:
- 런타임 확인, API endpoint/preferences, diagnostics 상세 보기

레이아웃:
- API/runtime configuration
- diagnostics detail cards
- preview defaults (FPS, quality, preferred response mode) 섹션
- 향후 확장 reserved section

핵심 컴포넌트:
- `RuntimeConfigForm`
- `DiagnosticsDetails`
- `PreferencePanel`
- `SupportInfoCard`

## 4. 상태 구조

## 4-1. 전역 상태 원칙
- 서버 truth는 API 응답 기준으로 관리
- UI 제어 상태와 네트워크 상태를 분리
- realtime과 batch 상태를 같은 store에서 억지로 합치지 않는다.

## 4-2. 상태 슬라이스

### A. realtime session slice
`ARCHITECTURE.md`의 상태 모델을 그대로 따른다.
- `idle`
- `camera_loading`
- `session_starting`
- `streaming`
- `degraded`
- `error`

필드:
- `mode`
- `session_id`
- `accepted_profile`
- `request_id`
- `last_frame_id`
- `last_server_latency_ms`
- `last_detection_counts`
- `last_error`
- `is_camera_ready`

### B. batch job slice
- `idle`
- `uploading`
- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

필드:
- `job_id`
- `progress.percent`
- `progress.processed_frames`
- `progress.total_frames`
- `progress.eta_sec`
- `result.download_url`
- `result.preview_thumbnail_url`
- `result.expires_at`
- `last_error`

### C. diagnostics slice
표시 기준은 `ARCHITECTURE.md 9-3`을 따른다.
- API 연결 여부
- GPU 사용 여부
- 현재 모드
- 현재 preset
- 최근 latency ms
- 최근 detection count
- 마지막 오류 메시지

### D. UI preference slice
로컬 상태 또는 localStorage 후보:
- 선택한 preset
- privacy toggle 기본값
- preview scale
- diagnostics rail open/close

## 4-3. 서버 계약과의 매핑
- `POST /api/v1/realtime/sessions`
  - 입력: `mode`, `preset_id?`, `stream_profile`, `privacy_options`
  - 출력: `session_id`, `accepted_profile`, `frame_endpoint`, `expires_in_sec`
- `POST /api/v1/realtime/sessions/{session_id}/frames`
  - 출력: `frame_id`, `mime_type`, `processed_image_base64`, `server_latency_ms`, `detections`
- `POST /api/v1/videos/jobs`
  - 출력: `job_id`, `status_endpoint`, `cancel_endpoint`
- `GET /api/v1/videos/jobs/{job_id}`
  - 출력: `status`, `progress`, `result`
- `GET /api/v1/presets`
  - Character preset selector의 단일 데이터 원본
- `GET/POST/DELETE /api/v1/allowlist/faces`
  - Privacy settings 내부 allowlist 관리 표면

## 5. 컴포넌트 구조

## 5-1. 디렉터리 책임
- `web/src/app/*`
  - route entry, page composition, server/client boundary 최소화
- `web/src/components/common/*`
  - button, card, badge, section header, empty/error state
- `web/src/components/camera/*`
  - camera permission, stream attach, capture surface
- `web/src/components/preview/*`
  - preview stage, before/after frame, image canvas fallback
- `web/src/components/diagnostics/*`
  - runtime badges, latency, error, GPU/API status
- `web/src/components/uploader/*`
  - file picker, drag-drop, upload affordances
- `web/src/features/character/*`
  - preset selection, character-specific controls, WebGL preview entry
- `web/src/features/privacy/*`
  - privacy form, detection summary, allowlist-aware UI
- `web/src/features/video/*`
  - upload, polling, result rendering
- `web/src/features/allowlist/*`
  - list/register/delete UI
- `web/src/services/*`
  - pure API client wrappers; no view logic
- `web/src/hooks/*`
  - camera/session/upload/polling orchestration
- `web/src/store/*`
  - session/diagnostics/job slice

## 5-2. 권장 page composition

### Character page
- `CharacterPage`
  - `CharacterPresetPanel`
  - `RealtimeWorkspace`
    - `CameraViewport`
    - `CharacterPreviewStage`
    - `SessionToolbar`
  - `DiagnosticsPanel`

### Privacy page
- `PrivacyPage`
  - `PrivacyOptionsForm`
  - `RealtimeWorkspace`
    - `CameraViewport`
    - `BeforeAfterPreview`
  - `DetectionSummaryCard`
  - `DiagnosticsPanel`

### Video page
- `VideoPage`
  - `VideoUploadDropzone`
  - `VideoConfigPanel`
  - `JobProgressCard`
  - `VideoResultCard`
  - `DiagnosticsPanel`

## 5-3. 재사용 규칙
- session start/stop, status badge, diagnostics card는 공통화
- mode-specific option form과 preview surface만 feature별로 분리
- API envelope parsing은 `services/api-client.ts` 한 곳에서 정규화

## 6. WebGL / Three.js 사용 경계

`web/README.md`와 `AI_BACKEND_WORKER2_PLAN.md`의 공통 원칙:
- WebGL/Three.js는 **character preview/rendering lane 전용**이다.
- privacy/video는 **DOM/canvas-first**를 유지한다.
- backend P0 transport는 여전히 `session -> frame upload -> processed frame response`다.

## 6-1. WebGL 사용 허용 범위
허용:
- Character preset preview stage
- 얼굴 anchor 기준 overlay transform 시각화
- preset mesh/sprite/material compositing
- 향후 character-only interaction polish

비허용(P0):
- privacy blur 기본 렌더링
- batch video 결과 뷰어의 기본 재생기
- 공통 앱 셸, diagnostics, uploader, allowlist 관리 UI
- realtime transport 자체를 WebRTC/WebSocket/WebGL 파이프라인으로 바꾸는 일

## 6-2. WebGL fallback 규칙
- WebGL unavailable 또는 context loss 시 Character page는 **2D 이미지 preview fallback**으로 강등
- fallback이어도 session lifecycle, diagnostics, preset selection은 정상 유지
- fallback 상태는 warning badge로만 표현하고, 페이지 전체 실패로 취급하지 않는다.

## 6-3. worker-2와의 경계
worker-2는 다음까지만 책임진다.
- character backend hook
- 얼굴/랜드마크/anchor 계산 결과 제공

worker-1은 다음을 책임진다.
- 브라우저 preview stage
- Three.js scene lifecycle
- backend 결과를 UI frame으로 연결하는 compositing UX

## 7. 오류/상태 표현 규칙
- `camera_loading`, `session_starting`, `uploading`은 skeleton/spinner보다 **명시적 단계 라벨** 우선
- `degraded`는 yellow badge + 원인 설명(예: latency 증가, detection 감소)
- `error`는 inline card + retry action 제공
- diagnostics rail에는 항상 `last_error`와 `last_request_id`를 표시할 수 있게 준비

## 8. 구현 우선순위
1. 공통 앱 셸 + route skeleton (`/`, `/character`, `/privacy`, `/video`, `/settings`)
2. realtime 공통 상태/store + hooks (`useCameraStream`, `useRealtimeSession`, `useFrameUploader`)
3. Privacy MVP UI
4. Video batch UI
5. Character preset selector + WebGL preview entry
6. diagnostics 고도화

이 순서는 `ARCHITECTURE.md`의 Phase 1~5와 `web/README.md`의 first implementation order를 그대로 따른다.

## 9. 구현 전 체크리스트
- [ ] route별 primary action이 한 개로 정리되어 있는가
- [ ] realtime/batch/diagnostics 상태가 분리되어 있는가
- [ ] API 용어를 `snake_case`/contract 명칭 그대로 쓰는가
- [ ] Character 외 영역에 WebGL 의존성이 새지 않는가
- [ ] diagnostics가 보조 정보이되 항상 접근 가능한가
- [ ] degraded/fallback/error 상태가 빈 화면 없이 드러나는가

## 10. leader 보고용 3줄 요약 초안
- UI는 `overview / character / privacy / video / settings` 5-route 공통 앱 셸로 정리하고, 각 페이지는 한 개의 primary action만 갖는 clean/minimal/polished 구조로 고정했다.
- 상태는 realtime / batch / diagnostics / preference로 분리하고, `ARCHITECTURE.md` 상태명과 `contracts/openapi.yaml` payload를 그대로 매핑하도록 정리했다.
- WebGL/Three.js는 Character preview/compositing에만 허용하고, Privacy/Video/공통 셸은 DOM/canvas-first + fallback 가능한 구조로 경계를 명확히 했다.
