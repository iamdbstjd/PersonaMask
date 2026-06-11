"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Image from "next/image";

import { useVideoJob } from "../../hooks/useVideoJob";
import type { AllowedFaceReference, CandidateAction, VideoFaceCandidate, VideoJobResult, VideoJobUiStatus } from "../../services/video-api";

const actionLabels: Record<CandidateAction, string> = {
  preserve: "유지",
  blur: "가림",
  character: "대체",
  track: "전구간",
};

const actionOrder: CandidateAction[] = ["preserve", "blur", "character", "track"];

const showcaseItems = [
  {
    key: "blur",
    src: "/showcase/blur.jpg",
    label: "가림",
    badge: "보호 대상 얼굴 가림",
  },
  {
    key: "preserve",
    src: "/showcase/preserve.jpg",
    label: "유지",
    badge: "허용 인물 원본 유지",
  },
  {
    key: "diffusion",
    src: "/showcase/diffusion-character.jpg",
    label: "디퓨전",
    badge: "디퓨전 대체 적용",
  },
] as const;

const faceSlots = [
  { key: "front", label: "정면", help: "기준 얼굴 등록" },
  { key: "left45", label: "왼쪽 45도", help: "고개를 천천히 왼쪽으로" },
  { key: "right45", label: "오른쪽 45도", help: "고개를 천천히 오른쪽으로" },
  { key: "leftSide", label: "왼쪽 측면", help: "측면 얼굴 보강" },
  { key: "rightSide", label: "오른쪽 측면", help: "측면 얼굴 보강" },
] as const;

type FaceSlotKey = (typeof faceSlots)[number]["key"];
type CapturedFaces = Partial<Record<FaceSlotKey, string>>;

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("이미지를 읽지 못했습니다."));
      }
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

function isJobActive(status: VideoJobUiStatus): boolean {
  return status === "uploading" || status === "queued" || status === "processing";
}

function formatVideoStatus(status: VideoJobUiStatus): string {
  const labels: Record<VideoJobUiStatus, string> = {
    idle: "대기 중",
    uploading: "업로드 중",
    queued: "대기열",
    processing: "처리 중",
    completed: "완료",
    failed: "실패",
    cancelled: "취소",
  };

  return labels[status];
}

function artifactFilename(url: string): string {
  return url.split("/").pop() || "personamask-artifact";
}

function formatCandidateDisplayId(index: number): string {
  return `F-${String(index + 1).padStart(3, "0")}`;
}

async function downloadProtectedArtifact(url: string, accessToken: string): Promise<void> {
  const response = await fetch(url, { headers: { "X-Access-Token": accessToken } });
  if (!response.ok) {
    throw new Error(`artifact download failed: ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = artifactFilename(url);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function CandidateImage({ candidate, accessToken, index }: { candidate: VideoFaceCandidate; accessToken: string; index: number }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;

    async function loadImage() {
      const response = await fetch(candidate.image_url, { headers: { "X-Access-Token": accessToken } });
      if (!response.ok) {
        return;
      }
      currentObjectUrl = URL.createObjectURL(await response.blob());
      if (active) {
        setObjectUrl(currentObjectUrl);
      } else {
        URL.revokeObjectURL(currentObjectUrl);
      }
    }

    void loadImage();
    return () => {
      active = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [accessToken, candidate.image_url]);

  if (!objectUrl) {
    return <div className="pm-candidate-portrait pm-candidate-portrait--empty" aria-label={`후보 ${index + 1}`} />;
  }

  return <Image src={objectUrl} alt={`후보 ${index + 1}`} width={280} height={280} unoptimized />;
}

function CandidateCard({
  candidate,
  index,
  action,
  accessToken,
  disabled,
  characterPreset,
  onActionChange,
  onPresetChange,
}: {
  candidate: VideoFaceCandidate;
  index: number;
  action: CandidateAction;
  accessToken: string;
  disabled: boolean;
  characterPreset: string;
  onActionChange: (candidateId: string, action: CandidateAction) => void;
  onPresetChange: (presetId: string) => void;
}) {
  return (
    <article className={["pm-candidate-card", action === "character" ? "pm-candidate-card--selected" : null].filter(Boolean).join(" ")}>
      <div className="pm-candidate-media">
        <CandidateImage candidate={candidate} accessToken={accessToken} index={index} />
        <span className="pm-candidate-id">ID: {formatCandidateDisplayId(index)}</span>
      </div>
      <div className="pm-candidate-controls">
        <div className="pm-action-row" aria-label={`후보 ${index + 1} 처리 방식`}>
          {actionOrder.map((nextAction) => (
            <button
              key={nextAction}
              type="button"
              className={["pm-action-button", action === nextAction ? "pm-action-button--active" : null].filter(Boolean).join(" ")}
              disabled={disabled}
              onClick={() => onActionChange(candidate.candidate_id, nextAction)}
            >
              {actionLabels[nextAction]}
            </button>
          ))}
        </div>
        {action === "character" ? (
          <label className="pm-preset-row">
            <span>프리셋:</span>
            <select value={characterPreset} disabled={disabled} onChange={(event) => onPresetChange(event.target.value)}>
              <option value="anime_portrait">anime_portrait</option>
              <option value="clay_avatar">clay_avatar</option>
              <option value="comic_ink">comic_ink</option>
            </select>
          </label>
        ) : null}
      </div>
    </article>
  );
}

function ToggleLine({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={["pm-toggle-line", disabled ? "pm-toggle-line--disabled" : null].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <input className="sr-only" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className={["pm-switch", checked ? "pm-switch--checked" : null].filter(Boolean).join(" ")} aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

function ShowcasePanel() {
  const [selectedKey, setSelectedKey] = useState<(typeof showcaseItems)[number]["key"]>("preserve");
  const selectedItem = showcaseItems.find((item) => item.key === selectedKey) ?? showcaseItems[0];

  return (
    <section className="pm-showcase" aria-label="예시 사진">
      <div className="pm-showcase__stage">
        <Image src={selectedItem.src} alt={`${selectedItem.label} 예시`} width={960} height={540} priority sizes="(max-width: 1040px) 100vw, 76vw" unoptimized />
        <span className="pm-showcase__badge pm-showcase__badge--left">예시 사진</span>
        <span className="pm-showcase__badge pm-showcase__badge--right">{selectedItem.badge}</span>
      </div>
      <div className="pm-showcase__controls" role="tablist" aria-label="예시 보기 선택">
        {showcaseItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={["pm-showcase-option", selectedKey === item.key ? "pm-showcase-option--active" : null].filter(Boolean).join(" ")}
            aria-selected={selectedKey === item.key}
            role="tab"
            onClick={() => setSelectedKey(item.key)}
          >
            <Image src={item.src} alt="" width={48} height={32} aria-hidden="true" priority sizes="48px" unoptimized />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function EnrollmentModal({
  open,
  capturedFaces,
  onCapture,
  onClose,
}: {
  open: boolean;
  capturedFaces: CapturedFaces;
  onCapture: (slot: FaceSlotKey, imageUrl: string) => void;
  onClose: () => void;
}) {
  const [activeSlot, setActiveSlot] = useState<FaceSlotKey>("front");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadInputId = useId();
  const completedCount = faceSlots.filter((slot) => capturedFaces[slot.key]).length;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, stopCamera]);

  useEffect(() => {
    if (!open || !cameraActive || !videoRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch((error: unknown) => {
      setCameraError(error instanceof Error ? error.message : "카메라 미리보기를 시작하지 못했습니다.");
    });
  }, [cameraActive, open]);

  async function startCamera() {
    setCameraError(null);
    if (cameraActive) {
      captureFromCamera();
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraError("카메라는 localhost 또는 HTTPS 환경에서만 사용할 수 있습니다.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("이 브라우저에서 카메라 접근을 지원하지 않습니다.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "카메라를 시작하지 못했습니다.");
    }
  }

  function moveToNextSlot() {
    const currentIndex = faceSlots.findIndex((slot) => slot.key === activeSlot);
    const nextSlot = faceSlots.find((slot, index) => index > currentIndex && !capturedFaces[slot.key]) ?? faceSlots.find((slot) => !capturedFaces[slot.key]);
    if (nextSlot) {
      setActiveSlot(nextSlot.key);
    }
  }

  function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setCameraError("카메라 프레임을 아직 읽지 못했습니다.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("캡처 캔버스를 만들지 못했습니다.");
      return;
    }
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);
    onCapture(activeSlot, canvas.toDataURL("image/jpeg", 0.88));
    moveToNextSlot();
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      onCapture(activeSlot, await readImageFileAsDataUrl(file));
      moveToNextSlot();
      event.target.value = "";
      setCameraError(null);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "이미지를 읽지 못했습니다.");
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="pm-modal-layer" role="dialog" aria-modal="true" aria-label="허용 얼굴 등록">
      <div className="pm-face-modal">
        <section className="pm-face-modal__preview">
          <div className="pm-face-modal__title">
            <strong>허용 얼굴 등록</strong>
            <span>{faceSlots.find((slot) => slot.key === activeSlot)?.help ?? "카메라를 정면으로 바라봐 주세요"}</span>
          </div>
          <div className="pm-camera-frame">
            {cameraActive ? <video ref={videoRef} className="pm-camera-preview" autoPlay muted playsInline /> : <div className="pm-camera-person" aria-hidden="true" />}
            <span>{cameraActive ? "LIVE FEED ACTIVE" : "READY FOR CAPTURE"}</span>
          </div>
          <p>안내에 따라 고개를 천천히 움직여주세요.</p>
          {cameraError ? <small className="pm-camera-error">{cameraError}</small> : null}
        </section>

        <section className="pm-face-modal__control">
          <div className="pm-face-modal__count">
            <span>등록된 각도 수</span>
            <strong>{completedCount} / 5</strong>
          </div>

          <div className="pm-face-slots">
            {faceSlots.map((slot, index) => {
              const isActive = slot.key === activeSlot;
              const isDone = Boolean(capturedFaces[slot.key]);
              return (
                <button
                  key={slot.key}
                  type="button"
                  className={["pm-face-slot", isActive ? "pm-face-slot--active" : null, isDone ? "pm-face-slot--done" : null].filter(Boolean).join(" ")}
                  onClick={() => setActiveSlot(slot.key)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{slot.label}</strong>
                  <small>{slot.help}</small>
                  <i aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <button className="pm-modal-primary" type="button" onClick={() => void startCamera()}>
            <span aria-hidden="true">▣</span>
            {cameraActive ? "현재 각도 저장" : "카메라 시작"}
          </button>
          <label className="pm-modal-upload" htmlFor={uploadInputId}>
            <input id={uploadInputId} className="sr-only" type="file" accept="image/*" onChange={handleUpload} />
            <span aria-hidden="true">↥</span>
            이미지 업로드
          </label>
          <button className="pm-modal-close" type="button" onClick={onClose}>
            취소하고 돌아가기
          </button>
        </section>
      </div>
    </div>
  );
}

function downloadQaReport(result: VideoJobResult | null, accessToken: string | null) {
  if (!result?.qa_report_json_url || !accessToken) {
    return;
  }
  void downloadProtectedArtifact(result.qa_report_json_url, accessToken);
}

export function VideoPageScreen() {
  const controller = useVideoJob();
  const { updateAllowedFaceReferences } = controller;
  const inputId = useId();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [capturedFaces, setCapturedFaces] = useState<CapturedFaces>({});
  const jobActive = isJobActive(controller.status);
  const progress = controller.job?.progress ?? null;
  const progressPercent = progress?.percent ?? 0;
  const candidateCount = controller.candidateAnalysis?.candidates.length ?? 0;
  const decisionCount = Object.keys(controller.candidateActions).length;
  const enrollmentCount = faceSlots.filter((slot) => capturedFaces[slot.key]).length;
  const allowedFaceReferences = useMemo<AllowedFaceReference[]>(
    () =>
      faceSlots.flatMap((slot) => {
        const imageData = capturedFaces[slot.key];
        return imageData ? [{ slot: slot.key, image_data: imageData }] : [];
      }),
    [capturedFaces],
  );
  const candidateEmptyTitle = controller.isAnalyzingCandidates
    ? "얼굴 분석 중"
    : controller.candidateAnalysis
      ? "후보 얼굴 없음"
      : controller.selectedFile
        ? "분석 대기"
        : "동영상 필요";
  const candidateEmptyMessage = controller.isAnalyzingCandidates
    ? "동영상에서 얼굴 후보를 찾는 중입니다."
    : controller.candidateAnalysis
      ? "검출된 얼굴 후보가 없습니다. 다른 영상을 선택하거나 원본 해상도를 확인하세요."
      : controller.selectedFile
        ? "얼굴 분석을 실행하면 동영상에서 검출된 후보 얼굴만 여기에 표시됩니다."
        : "소스 동영상을 업로드한 뒤 얼굴 분석을 실행하세요.";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    controller.selectFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    controller.setDragActive(false);
    if (jobActive) {
      return;
    }
    controller.selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  useEffect(() => {
    updateAllowedFaceReferences(allowedFaceReferences);
  }, [allowedFaceReferences, updateAllowedFaceReferences]);

  return (
    <div className="pm-dashboard">
      <header className="pm-topbar">
        <div className="pm-topbar__left">
          <a className="pm-brand" href="/">PersonaMask</a>
          <nav className="pm-nav" aria-label="주요 화면">
            <a className="pm-nav__active" href="/video">Dashboard</a>
            <a href="/settings">Help Center</a>
          </nav>
        </div>
        <div className="pm-topbar__right">
          <button className="pm-submit-small" type="button" disabled={!controller.canSubmit} onClick={() => void controller.submit()}>
            처리 시작
          </button>
          <button className="pm-report-link" type="button" disabled={!controller.job?.result?.qa_report_json_url} onClick={() => downloadQaReport(controller.job?.result ?? null, controller.job?.accessToken ?? null)}>
            QA 리포트 다운로드
          </button>
          <button className="pm-icon-button" type="button" aria-label="알림">
            <span aria-hidden="true" />
          </button>
          <span className="pm-avatar" aria-label="운영자 프로필">PM</span>
        </div>
      </header>

      <div className="pm-workspace">
        <main className="pm-canvas">
          {controller.lastError ? <div className="pm-error">{controller.lastError}</div> : null}

          <ShowcasePanel />

          <label
            htmlFor={inputId}
            className={["pm-upload", controller.dragActive ? "pm-upload--active" : null].filter(Boolean).join(" ")}
            onDragOver={(event) => {
              event.preventDefault();
              if (!jobActive) {
                controller.setDragActive(true);
              }
            }}
            onDragLeave={() => controller.setDragActive(false)}
            onDrop={handleDrop}
          >
            <input id={inputId} type="file" accept="video/mp4,video/quicktime,video/webm" disabled={jobActive} onChange={handleFileChange} />
            <span className="pm-upload__icon">⇪</span>
            <strong>소스 비디오 업로드</strong>
            <small>MP4, QuickTime, WebM 파일을 여기로 드래그 앤 드롭하세요.<br />또는 클릭하여 파일을 선택합니다.</small>
            {controller.selectedFile ? <em>{controller.selectedFile.name}</em> : null}
          </label>

          <section className="pm-board">
            <div className="pm-board__header">
              <h2>후보 검토 보드</h2>
              <button className="pm-analyze" type="button" disabled={!controller.canAnalyzeCandidates} onClick={() => void controller.analyzeCandidates()}>
                <span aria-hidden="true">☻</span>
                {controller.isAnalyzingCandidates ? "분석 중" : "얼굴 분석"}
              </button>
            </div>

            {controller.candidateAnalysis?.candidates.length ? (
              <div className="pm-candidate-grid">
                {controller.candidateAnalysis.candidates.map((candidate, index) => (
                  <CandidateCard
                    key={candidate.candidate_id}
                    candidate={candidate}
                    index={index}
                    accessToken={controller.candidateAnalysis?.access_token ?? ""}
                    action={controller.candidateActions[candidate.candidate_id] ?? "blur"}
                    disabled={jobActive}
                    characterPreset={controller.config.character_id ?? "anime_portrait"}
                    onActionChange={controller.updateCandidateAction}
                    onPresetChange={controller.updateCharacterPreset}
                  />
                ))}
              </div>
            ) : (
              <div className="pm-candidate-empty">
                <strong>{candidateEmptyTitle}</strong>
                <span>{candidateEmptyMessage}</span>
              </div>
            )}
          </section>
        </main>

        <aside className="pm-sidebar">
          <section className="pm-panel">
            <h2>프라이버시 설정</h2>
            <div className="pm-toggle-stack">
              <ToggleLine label="얼굴 가림" checked={controller.config.privacy_options.blur_faces} disabled={jobActive} onChange={(value) => controller.updatePrivacyOption("blur_faces", value)} />
              <ToggleLine label="번호판 가림" checked={controller.config.privacy_options.blur_plates} disabled={jobActive} onChange={(value) => controller.updatePrivacyOption("blur_plates", value)} />
              <ToggleLine label="텍스트 가림" checked={controller.config.privacy_options.blur_text} disabled={jobActive} onChange={(value) => controller.updatePrivacyOption("blur_text", value)} />
            </div>
            <button className="pm-enroll-button" type="button" onClick={() => setEnrollOpen(true)}>
              허용 얼굴 등록 <span>{enrollmentCount}/5</span>
            </button>
          </section>

          <section className="pm-panel pm-panel--render">
            <h2>처리 설정</h2>
            <label className="pm-select-label">
              <span>포맷 / 코덱</span>
              <select value={controller.config.output_options.video_codec} disabled={jobActive} onChange={() => undefined}>
                <option value="mp4v">MP4 / mp4v</option>
              </select>
            </label>
          </section>

          <section className="pm-progress-card">
            <div className="pm-progress-card__top">
              <span>상태</span>
              <strong>{formatVideoStatus(controller.status)}</strong>
            </div>
            <div className="pm-progress-bar">
              <span style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
            </div>
            <dl>
              <div>
                <dt>Frames:</dt>
                <dd>{progress ? `${progress.processed_frames} / ${progress.total_frames}` : "0 / 0"}</dd>
              </div>
              <div>
                <dt>ETA:</dt>
                <dd>{progress ? `${progress.eta_sec}s` : "--:--"}</dd>
              </div>
              <div>
                <dt>후보:</dt>
                <dd>{candidateCount}명 / 결정 {decisionCount}개</dd>
              </div>
            </dl>
          </section>

          <button className="pm-render-button" type="button" disabled={!controller.canSubmit} onClick={() => void controller.submit()}>
            처리 시작
          </button>
        </aside>
      </div>

      <EnrollmentModal
        open={enrollOpen}
        capturedFaces={capturedFaces}
        onCapture={(slot, imageUrl) => setCapturedFaces((previous) => ({ ...previous, [slot]: imageUrl }))}
        onClose={() => setEnrollOpen(false)}
      />
    </div>
  );
}
