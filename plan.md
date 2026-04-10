# Character Mask & Privacy Redaction Plan

작성일: 2026-04-10

## 0. 프로젝트 최종 방향

이 프로젝트는 더 이상 실사 얼굴 사진 기반 Face Swap을 메인 목표로 두지 않는다.

최종 방향은 아래 2개 축으로 재정의한다.

- [ ] 실시간 캐릭터 얼굴 / 마스크 변환
- [ ] 동영상 및 실시간 입력에 대한 프라이버시 블러 처리

즉, 제품 정체성은 아래처럼 정리한다.

- [ ] `Character Mask Mode`: 웹캠 얼굴을 스파이더맨, 배트맨, 애니 캐릭터 느낌의 캐릭터 얼굴/마스크로 변환
- [ ] `Privacy Blur Mode`: 웹캠 또는 동영상에서 얼굴, 번호판, 문서/텍스트형 개인정보를 자동 블러 처리

실사 얼굴을 다른 실사 얼굴로 바꾸는 기능은 기본 범위에서 제외한다.

제외 이유:
- [ ] 딥페이크 오해 및 윤리 리스크 감소
- [ ] 캐릭터 기반 서비스 정체성 강화
- [ ] 실사 swap보다 캐릭터 마스크 방식이 목적에 더 적합함

---

## 1. 제품 범위 체크리스트

### 1-1. 포함할 핵심 기능
- [x] 브라우저 카메라 입력
- [x] 동영상 파일 업로드
- [ ] 실시간 Character Mask Mode
- [ ] 실시간 Privacy Blur Mode
- [ ] 동영상 Privacy Batch Mode
- [ ] 허용 얼굴 제외 기능(optional allowlist)
- [ ] 번호판 블러
- [ ] 문서/텍스트형 개인정보 블러
- [ ] 결과 preview 및 결과 영상 다운로드

### 1-2. 제외할 기능
- [ ] 실사 얼굴 -> 실사 얼굴 face swap
- [ ] virtual camera 출력
- [ ] 모바일 앱
- [ ] 음성 처리
- [ ] 사용자 맞춤 학습
- [ ] 완전한 multi-user session 분리 고도화

### 1-3. 우선순위
- [ ] `P0`: Character Mask Mode
- [ ] `P0`: Video Privacy Batch
- [ ] `P0`: Webcam Privacy Blur
- [ ] `P1`: 번호판/문서/텍스트 개인정보 blur 정확도 향상
- [ ] `P1`: 캐릭터 프리셋 다양화
- [ ] `P2`: 애니 캐릭터 스타일 고도화

---

## 2. 운영 모드 정의

### Mode A. Character Mask Mode
웹캠 얼굴을 캐릭터 얼굴 또는 마스크 형태로 변환한다.

대표 예시:
- [ ] 스파이더맨
- [ ] 배트맨
- [ ] 애니 스타일 캐릭터 마스크

핵심 원칙:
- [ ] 실사 얼굴 swap이 아니라 캐릭터 오버레이/렌더링 기반으로 간다
- [ ] 실시간성을 우선한다
- [ ] 한 번에 가장 큰 얼굴 1명을 우선 처리한다

### Mode B. Privacy Blur Mode
웹캠 또는 동영상에서 허용되지 않은 얼굴과 개인정보를 블러 처리한다.

대상:
- [ ] 얼굴
- [ ] 번호판
- [ ] 문서
- [ ] 화면 속 텍스트
- [ ] 명찰/인쇄물 텍스트 영역

### Mode C. Video Privacy Batch
동영상 업로드 시 전체 프레임에 대해 얼굴 및 개인정보를 batch 처리한다.

목표:
- [ ] 허용 얼굴 제외 블러
- [ ] 번호판 블러
- [ ] 문서/텍스트형 개인정보 블러
- [ ] 결과 파일 다운로드

---

## 3. 기술 방향 결정 체크리스트

### 3-1. Character Mode 기술 전략
- [ ] 캐릭터 얼굴은 `실사 swap`이 아니라 `mask overlay / landmark-based rendering`으로 처리
- [ ] 얼굴 랜드마크 기준 위치/크기/회전 정렬
- [ ] 캐릭터 프리셋은 `spider`, `bat`, `anime_mask` 같은 형태로 관리
- [ ] 실시간성 확보를 위해 브라우저 또는 서버 lightweight render 경로 사용

### 3-2. Privacy Mode 기술 전략
- [ ] 얼굴 검출은 `InsightFace buffalo_l`
- [ ] 허용 얼굴 제외는 embedding 기반 allowlist 비교
- [ ] 번호판은 detector 기반 blur
- [ ] 문서/텍스트는 text region detector 또는 OCR 기반 blur
- [ ] 실패 시 보수적으로 blur 우선

### 3-3. 입력/출력 구조
- [ ] 웹캠은 브라우저 `getUserMedia()` 기반
- [ ] 동영상은 업로드 후 서버 batch 처리
- [x] preview는 웹 프론트에서 확인
- [ ] 결과 영상은 다운로드 링크로 제공

---

## 4. 시스템 아키텍처 체크리스트

### 4-1. Browser 입력 계층
- [x] 브라우저 카메라 권한 처리
- [ ] 프레임 캡처 및 업로드
- [ ] 모드 선택 UI
- [ ] Character preset 선택 UI
- [x] video file 업로드 UI

### 4-2. 서버 분석 계층
- [ ] 얼굴 검출
- [ ] 랜드마크 추출
- [ ] allowlist embedding 매칭
- [ ] 번호판 탐지
- [ ] 텍스트/문서 영역 탐지

### 4-3. 처리 계층
- [ ] Character mask renderer
- [ ] privacy redactor
- [ ] batch video processor
- [ ] output compositor

### 4-4. 결과 계층
- [ ] webcam preview frame 반환
- [ ] video output 저장
- [x] output download endpoint 제공
- [x] 상태/에러/diagnostics 표시

---

## 5. 마일스톤 로드맵

## Milestone A. 범위 확정 및 윤리 기준 정리

### 목표
실사 얼굴 swap을 완전히 범위에서 제거하고, 캐릭터/프라이버시 중심 제품으로 방향을 고정한다.

### 체크리스트
- [ ] 실사 얼굴 swap 제거 결정 확정
- [ ] README/문서에서 실사 swap 표현 제거
- [ ] 제품 설명을 캐릭터 변환 + privacy blur로 통일
- [ ] 허용/비허용 사용 사례 정리

### 완료 기준
- [ ] 문서 기준에서 실사 face swap이 메인 기능으로 남아있지 않음

## Milestone B. 실행 환경 및 GPU 고정

### 목표
개발 환경과 GPU 런타임을 확정한다.

### 체크리스트
- [x] Python/conda 환경 고정
- [ ] requirements 설치 완료
- [x] ONNX Runtime GPU 활성화 확인
- [ ] CUDA/cuDNN 정상 동작 확인
- [ ] 모델 폴더 구조 정리
- [ ] `.gitignore` 검토 완료

### 완료 기준
- [x] `python -m app.main --check` 정상
- [ ] `CUDAExecutionProvider` 확인

## Milestone C. Webcam Privacy Blur MVP

### 목표
실시간 웹캠에서 얼굴 blur가 안정적으로 동작하게 만든다.

### 체크리스트
- [x] 브라우저 카메라 연결
- [ ] 얼굴 검출 정상 동작 확인
- [ ] webcam privacy blur 확인
- [ ] allowlist 얼굴 pass 확인
- [ ] 1명/2명/3명 장면 테스트
- [ ] 측면/가림 조건 테스트
- [ ] blur 강도 및 bbox padding 조정

### 완료 기준
- [ ] 미등록 얼굴 blur 안정화
- [ ] allowlist 얼굴 pass 동작 확인

## Milestone D. Video Privacy MVP

### 목표
동영상 파일 업로드 시 얼굴 blur가 동작하게 만든다.

### 체크리스트
- [ ] video reader/writer 확인
- [ ] batch 얼굴 분석 확인
- [ ] allowlist 얼굴 제외 처리 확인
- [ ] 결과 영상 저장 및 다운로드 확인
- [ ] 짧은 영상/긴 영상 테스트

### 완료 기준
- [ ] video privacy batch 기본 기능 완료

## Milestone E. 번호판 블러

### 목표
동영상과 필요 시 webcam에서도 차량 번호판을 자동 blur 처리한다.

### 체크리스트
- [ ] 번호판 detector 연결
- [ ] 정면/사선/원거리 번호판 샘플 테스트
- [ ] bbox padding 조정
- [ ] 오탐/누락 사례 정리

### 완료 기준
- [ ] 대표적인 번호판 장면에서 blur 확인

## Milestone F. 문서/텍스트형 개인정보 블러

### 목표
문서, 화면 속 텍스트, 명찰 같은 개인정보 영역을 블러 처리한다.

### 체크리스트
- [ ] text region detector 연결
- [ ] 문서/모니터/명찰 샘플 테스트
- [ ] 작은 글씨/큰 글씨 비교
- [ ] 텍스트 merge 규칙 조정
- [ ] 얼굴 + 텍스트 복합 장면 테스트

### 완료 기준
- [ ] 대표적인 텍스트형 개인정보 장면에서 blur 확인

## Milestone G. Character Mask Mode 1차 구현

### 목표
웹캠 얼굴 위에 캐릭터 마스크를 실시간으로 씌우는 최소 기능 버전을 만든다.

### 체크리스트
- [ ] Character Mode 진입 경로 정의
- [ ] 얼굴 랜드마크 기반 anchor 정의
- [ ] 마스크 위치/크기/회전 정렬 구현
- [ ] 가장 큰 얼굴 1명 우선 처리
- [ ] webcam preview에서 마스크 overlay 확인

### 완료 기준
- [ ] 웹캠에서 캐릭터 마스크가 얼굴에 따라 움직임

## Milestone H. Spider Preset 구현

### 목표
스파이더맨 스타일 프리셋을 완성한다.

### 체크리스트
- [ ] spider preset 색/형태 정의
- [ ] 눈 렌즈 모양 구현
- [ ] 얼굴 외곽 맞춤 조정
- [ ] 측면 회전 시 정렬 확인
- [ ] 가림/빠른 움직임 테스트

### 완료 기준
- [ ] 스파이더맨 프리셋 실시간 동작 확인

## Milestone I. Bat Preset 구현

### 목표
배트맨 스타일 반마스크 프리셋을 구현한다.

### 체크리스트
- [ ] bat preset 형태 정의
- [ ] 눈 주변 슬릿 구현
- [ ] 입 노출 영역 처리
- [ ] 턱선 정렬 조정
- [ ] 측면/조명 변화 테스트

### 완료 기준
- [ ] 배트맨 프리셋 실시간 동작 확인

## Milestone J. Anime Character Preset 실험

### 목표
애니 캐릭터 느낌의 간단한 캐릭터 프리셋 가능성을 검토한다.

### 체크리스트
- [ ] anime 스타일을 마스크형으로 갈지 얼굴형으로 갈지 결정
- [ ] 최소 프리셋 1개 제작
- [ ] 실시간 적용 가능성 테스트
- [ ] 실사 얼굴과 부조화가 심한지 확인

### 완료 기준
- [ ] 구현 가능한 방향 확정

## Milestone K. Webcam 성능 최적화

### 목표
캐릭터 모드와 privacy 모드의 체감 끊김을 줄인다.

### 체크리스트
- [ ] 업로드 해상도 조정
- [ ] JPEG 품질 조정
- [ ] frame interval 조정
- [ ] 서버 wait timeout 조정
- [ ] polling interval 조정
- [ ] 모드별 프로파일 분리
- [ ] FPS / latency 측정표 작성

### 완료 기준
- [ ] webcam privacy / character mode가 체감상 더 부드럽게 동작

## Milestone L. 프론트엔드 정리

### 목표
현재 웹 UI를 `Character / Privacy / Video` 중심으로 정리한다.

### 체크리스트
- [ ] Face Swap 문구 제거
- [ ] Character preset 선택 UI 추가
- [ ] Privacy mode 버튼 정리
- [ ] Video Privacy 처리 UX 정리
- [ ] 에러 메시지 한국어 정리
- [ ] 상태 badge / diagnostics 정리

### 완료 기준
- [ ] 사용자 관점에서 모드 의미가 명확함

## Milestone M. 테스트 및 샘플 검증

### 목표
실제 사용 장면에서 품질을 검증한다.

### 체크리스트
- [ ] 정면 얼굴 webcam 테스트
- [ ] 측면 얼굴 webcam 테스트
- [ ] 2인 이상 얼굴 blur 테스트
- [ ] 손 가림/모자/마스크 테스트
- [ ] 번호판 영상 테스트
- [ ] 문서/텍스트 영상 테스트
- [ ] 복합 장면 테스트
- [ ] 실패 프레임 캡처 및 기록

### 완료 기준
- [ ] 주요 실패 케이스와 개선 포인트 목록 확보

## Milestone N. 문서/배포 정리

### 목표
README와 실행 문서를 현재 구조에 맞게 정리한다.

### 체크리스트
- [ ] README 기능 설명 갱신
- [ ] README 아키텍처 갱신
- [ ] 실행 방법 갱신
- [ ] 모델 준비 방법 갱신
- [ ] 트러블슈팅 정리
- [ ] Git 커밋 단위 정리

### 완료 기준
- [ ] 새 사용자가 README만 보고 실행 가능

---

## 6. 최종 완료 기준

### P0 완료 조건
- [ ] Character Mask Mode 기본 동작
- [ ] Webcam Privacy Blur 동작
- [ ] Video Privacy Batch 동작
- [ ] 얼굴 blur / allowlist pass 가능
- [ ] 번호판 blur 가능
- [ ] 문서/텍스트형 개인정보 blur 기본 동작 가능
- [ ] GPU 사용 가능

### P1 완료 조건
- [ ] Spider preset 완성
- [ ] Bat preset 완성
- [ ] webcam 성능 최적화 완료
- [ ] UI 에러 메시지 정리 완료

### P2 완료 조건
- [ ] Anime character preset 실험 완료
- [ ] OCR 기반 개인정보 탐지 고도화
- [ ] WebRTC 또는 저지연 구조 검토

---

## 7. 지금 당장 시작할 순서

- [ ] Milestone A: 범위와 문서 정리
- [ ] Milestone C: webcam privacy 기준선 재확인
- [ ] Milestone D/E/F: video privacy + 번호판/텍스트 blur 안정화
- [ ] Milestone G: Character Mask Mode 최소 구현
- [ ] Milestone H/I: Spider/Bat preset 구현
- [ ] Milestone K: webcam 성능 튜닝
- [ ] Milestone L/N: UI/README 정리

