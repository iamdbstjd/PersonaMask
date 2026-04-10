# Worker-2 AI Backend Execution Plan

기준 문서: `ARCHITECTURE.md`, `plan.md`  
작성자: `worker-2`  
역할: AI 백엔드 에이전트 (`app/` 추론 파이프라인 + GPU/ONNX/CUDA + batch worker)

## 1. 책임 범위

worker-2는 프론트엔드(`web/`)와 계약 정의(`contracts/`)를 직접 소유하지 않고, 아래의 **백엔드 실행 경로**를 우선 책임진다.

### 포함 범위
- `app/main.py`
  - FastAPI 엔트리포인트 및 `--check` 기반 런타임 self-check 경로
- `app/core/`
  - 설정, 로깅, GPU/CUDA/ONNX Runtime provider 점검
- `app/pipelines/`
  - `privacy_pipeline.py`, `video_pipeline.py`, `character_pipeline.py`, `orchestrator.py`
  - 모드별 추론 흐름 조립 및 공통 orchestration
- `app/detectors/`, `app/recognition/`, `app/redactors/`, `app/renderers/`
  - 추론 파이프라인 내부 컴포넌트 연결
- `app/services/`
  - realtime/video job/diagnostics 관련 서비스 계층
- `app/workers/`
  - 비디오 배치 처리용 `job_runner.py`, `video_worker.py`
- `app/repositories/`
  - job/session 상태 persistence의 최소 골격
- `scripts/`
  - smoke/benchmark 성격의 백엔드 검증 스크립트
- `tests/`
  - 백엔드 파이프라인/서비스/배치 처리 검증

### 제외 범위
- `web/` UI, Three.js/WebGL preview/rendering 상세 구현 → **worker-1 주도**
- `contracts/openapi`, JSON schema, 프론트-백엔드 인터페이스 계약 확정 → **worker-3 주도**
- 공용 계약 변경이 필요한 경우, worker-2는 요구사항/필드 제안까지만 하고 실제 계약 편집은 worker-3와 정렬 후 진행

## 2. 핵심 목표 해석

`ARCHITECTURE.md`와 `plan.md` 기준으로 worker-2의 P0 목표는 아래 3개 백엔드 축으로 정리된다.

1. **GPU 런타임 고정**
   - `conda activate bys`
   - `nvidia-smi` 확인
   - ONNX Runtime GPU provider/CUDA 사용 가능 여부를 앱 self-check로 노출
2. **실시간 Privacy Blur 백엔드 경로**
   - 얼굴/번호판/텍스트·문서 검출 결과를 받아 보수적으로 blur/redaction 하는 파이프라인
3. **Video Privacy Batch 백엔드 경로**
   - 업로드된 비디오를 job으로 등록하고 background worker가 프레임 단위로 처리한 뒤 결과물/상태를 저장하는 경로

Character Mask Mode는 전체 제품 P0 범위이지만, worker-2의 직접 책임은 **렌더링 UI가 아닌 백엔드 추론/정렬용 pipeline hook**까지로 제한한다.

## 3. 산출물

우선순위 기준 산출물은 아래와 같다.

1. **런타임/GPU 진단 산출물**
   - `app/core/config.py`
   - `app/core/gpu.py`
   - `app/api/routers/health.py`, `app/api/routers/diagnostics.py`
   - `app/services/diagnostics_service.py`
   - 목표: `python -m app.main --check`와 diagnostics endpoint에서 CUDA/ONNX 상태 확인 가능

2. **실시간 추론 파이프라인 산출물**
   - `app/pipelines/privacy_pipeline.py`
   - `app/services/realtime_service.py`
   - 필요 시 `app/detectors/*`, `app/redactors/*`
   - 목표: 단일 frame 입력 → detection/redaction → preview response 구조 고정

3. **배치 비디오 처리 산출물**
   - `app/pipelines/video_pipeline.py`
   - `app/services/video_job_service.py`
   - `app/workers/job_runner.py`
   - `app/workers/video_worker.py`
   - `app/repositories/job_repository.py`
   - 목표: job 생성/상태 조회/worker 실행/결과 저장 흐름 고정

4. **오케스트레이션/공통 조립 산출물**
   - `app/pipelines/orchestrator.py`
   - 각 mode별 dependency wiring
   - 목표: realtime/batch 진입점이 detector/redactor/renderer 조합을 일관되게 사용

5. **백엔드 검증 산출물**
   - `tests/pipelines/`
   - `tests/integration/`
   - `scripts/smoke_test_api.py`
   - 목표: GPU self-check, realtime privacy path, batch job lifecycle smoke coverage 확보

## 4. 첫 구현 순서

### Step 1. 환경 및 실행 가능성 고정
- `conda activate bys`
- `nvidia-smi` 확인
- Python entrypoint와 requirements 기준으로 `python -m app.main --check`가 성공하는 최소 골격부터 만든다.
- 이 단계 완료 기준: 앱이 "GPU 사용 가능/불가", "ONNX provider 목록", "필수 디렉토리 상태"를 self-check로 출력

### Step 2. diagnostics + config + gpu 레이어 구축
- `app/core/config.py`, `app/core/gpu.py`, `app/services/diagnostics_service.py`
- worker-3가 API 계약을 고정하기 전에도 내부 진단 데이터 구조는 준비 가능
- 이 단계 완료 기준: health/diagnostics 라우터가 내부 runtime 상태를 안정적으로 읽음

### Step 3. realtime privacy pipeline 골격 구현
- `privacy_pipeline.py`와 `realtime_service.py`를 먼저 구성
- 초반에는 detector/redactor adapter를 mock/stub 가능 구조로 두고 orchestration을 먼저 고정
- 이 단계 완료 기준: 단일 frame request를 받아 detection 결과를 기반으로 blur action list를 반환 가능

### Step 4. video batch worker 골격 구현
- `video_job_service.py`, `job_repository.py`, `job_runner.py`, `video_worker.py`
- job create → queued → processing → completed/failed 상태 전이를 먼저 고정
- 이 단계 완료 기준: 실제 모델 연결 전에도 batch lifecycle 테스트 가능

### Step 5. 실제 detector/redactor 연결 및 성능 점검
- InsightFace buffalo_l, plate/text/document detector 순으로 연결
- 실패 시 보수적 blur 정책을 유지
- 이 단계 완료 기준: `Privacy Blur Mode`와 `Video Privacy Batch`의 P0 백엔드 경로가 end-to-end smoke 가능

### Step 6. character backend hook 최소 지원
- `character_pipeline.py`에서 랜드마크/anchor 계산용 backend hook만 제공
- 실제 WebGL/Three.js 미리보기는 worker-1 책임으로 남긴다.

## 5. 협업 인터페이스

### worker-1에게 제공할 것
- realtime frame 처리 endpoint가 기대하는 payload/response 초안
- preview 갱신에 필요한 latency budget/에러 포맷 요구사항
- character mode backend hook의 입력·출력 형태 제안

### worker-3에게 제공할 것
- diagnostics/health/realtime/video job 각 endpoint에 필요한 필드 목록
- batch job 상태 전이 모델
- allowlist/diagnostics/privacy result의 내부 데이터 shape 제안

## 6. 현재 즉시 착수 권장 항목

가장 먼저 시작할 구현은 아래 순서가 안전하다.

1. `app/main.py --check` 중심의 **runtime self-check path**
2. `app/core/gpu.py`의 **CUDA/ONNX provider probe**
3. `app/services/diagnostics_service.py` + health/diagnostics router 골격
4. `video_job_service.py` + `job_runner.py`의 **batch lifecycle skeleton**

이 순서는 UI/계약 확정 전에도 독립적으로 전진 가능하고, 이후 worker-1/worker-3 작업을 막지 않는다.

## 7. 선행 확인 결과

- Conda 환경: `bys` 사용 가능
- GPU 확인: `NVIDIA GeForce RTX 3090`, driver `535.288.01`, memory `24576 MiB`
- 해석: 런타임 self-check와 ONNX Runtime GPU provider 검증을 백엔드 초기 산출물로 두기에 적합한 환경
