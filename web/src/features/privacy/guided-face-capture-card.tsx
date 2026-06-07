"use client";

import { useEffect, useMemo, useState } from "react";

import type { CapturedFrame } from "../../hooks/useCameraStream";
import { createAllowlistFace, estimateFacePose, listAllowlistFaces, type AllowlistFace, type FacePoseEstimate, type FacePoseSlot } from "../../services/allowlist-api";
import { getErrorMessage } from "../../services/api-client";
import { Button } from "../../components/common/button";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";

type GuidedFaceCaptureCardProps = {
  cameraActive: boolean;
  cameraStarting: boolean;
  onStartCamera: () => void;
  captureFrame: (options?: { mimeType?: string; quality?: number; targetWidth?: number }) => Promise<CapturedFrame | null>;
};

type CapturedSlot = {
  imageSrc: string;
  face: AllowlistFace;
};

const FACE_POSE_SLOTS: readonly { key: FacePoseSlot; label: string; hint: string }[] = [
  { key: "front", label: "정면", hint: "카메라를 바로 봅니다." },
  { key: "left_45", label: "왼쪽 45도", hint: "고개를 왼쪽으로 천천히 돌립니다." },
  { key: "right_45", label: "오른쪽 45도", hint: "고개를 오른쪽으로 천천히 돌립니다." },
  { key: "left_profile", label: "왼쪽 측면", hint: "왼쪽 옆얼굴을 보여줍니다." },
  { key: "right_profile", label: "오른쪽 측면", hint: "오른쪽 옆얼굴을 보여줍니다." },
];

function createEnrollmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `enroll_${crypto.randomUUID()}`;
  }

  return `enroll_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emptySlots(): Record<FacePoseSlot, CapturedSlot | null> {
  return {
    front: null,
    left_45: null,
    right_45: null,
    left_profile: null,
    right_profile: null,
  };
}

export function GuidedFaceCaptureCard({ cameraActive, cameraStarting, onStartCamera, captureFrame }: GuidedFaceCaptureCardProps) {
  const [label, setLabel] = useState("허용 인물");
  const [enrollmentId, setEnrollmentId] = useState(createEnrollmentId);
  const [slots, setSlots] = useState<Record<FacePoseSlot, CapturedSlot | null>>(emptySlots);
  const [poseEstimate, setPoseEstimate] = useState<FacePoseEstimate | null>(null);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const completedSlots = useMemo(
    () => FACE_POSE_SLOTS.map((slot) => slot.key).filter((slot) => slots[slot] !== null),
    [slots],
  );
  const completionPercent = Math.round((completedSlots.length / FACE_POSE_SLOTS.length) * 100);

  useEffect(() => {
    let cancelled = false;

    const refreshFaces = async () => {
      try {
        const faces = await listAllowlistFaces();
        if (!cancelled) {
          setRegisteredCount(faces.length);
        }
      } catch {
        if (!cancelled) {
          setRegisteredCount(0);
        }
      }
    };

    void refreshFaces();

    return () => {
      cancelled = true;
    };
  }, []);

  const resetEnrollment = () => {
    setEnrollmentId(createEnrollmentId());
    setSlots(emptySlots());
    setPoseEstimate(null);
    setLastError(null);
  };

  const saveCurrentPose = async () => {
    setLastError(null);

    if (!cameraActive) {
      onStartCamera();
      return;
    }

    setIsSaving(true);
    try {
      const frame = await captureFrame({ targetWidth: 720, quality: 0.82 });
      if (!frame) {
        setLastError("카메라 프레임을 캡처하지 못했습니다.");
        return;
      }

      const pose = await estimateFacePose({ frame: frame.blob, completedSlots });
      setPoseEstimate(pose);

      if (!pose.detected || !pose.poseSlot || pose.alreadyCaptured) {
        return;
      }

      const face = await createAllowlistFace({
        image: frame.blob,
        label: label.trim() || "허용 인물",
        note: `다각도 참고 이미지: ${pose.poseLabel ?? pose.poseSlot}`,
        poseSlot: pose.poseSlot,
        enrollmentId,
      });

      setSlots((current) => ({
        ...current,
        [pose.poseSlot as FacePoseSlot]: {
          imageSrc: frame.dataUrl,
          face,
        },
      }));
      setRegisteredCount((count) => count + 1);
    } catch (error) {
      setLastError(getErrorMessage(error, "다각도 얼굴 참고 이미지를 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PanelCard
      kicker="허용 얼굴 등록"
      title="다각도 얼굴 캡처"
      description="카메라를 보며 정면, 45도, 측면 참고 이미지를 채우면 같은 인물을 허용 목록으로 사용할 수 있습니다."
      tone="accent"
    >
      <div className="guided-capture">
        <div className="guided-capture__field">
          <label htmlFor="guided-face-label">인물 이름</label>
          <input
            id="guided-face-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="허용할 사람 이름"
          />
        </div>

        <div className="guided-capture__meter" aria-label={`다각도 캡처 진행률 ${completionPercent}%`}>
          <span style={{ width: `${completionPercent}%` }} />
        </div>

        <div className="guided-capture__slots">
          {FACE_POSE_SLOTS.map((slot) => {
            const captured = slots[slot.key];
            return (
              <div key={slot.key} className={["guided-slot", captured ? "guided-slot--done" : null].filter(Boolean).join(" ")}>
                {captured ? (
                  <span
                    className="guided-slot__image"
                    role="img"
                    aria-label={`${slot.label} 참고 이미지`}
                    style={{ backgroundImage: `url(${captured.imageSrc})` }}
                  />
                ) : (
                  <span className="guided-slot__empty" aria-hidden="true" />
                )}
                <div>
                  <strong>{slot.label}</strong>
                  <span>{captured ? "저장됨" : slot.hint}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="guided-capture__status">
          <StatusBadge label={`${completedSlots.length}/${FACE_POSE_SLOTS.length} 각도`} tone={completedSlots.length >= 3 ? "success" : "neutral"} />
          <StatusBadge label={`등록 ${registeredCount}장`} tone={registeredCount > 0 ? "success" : "neutral"} />
        </div>

        <div className="guided-capture__actions">
          {!cameraActive ? (
            <Button onClick={onStartCamera} disabled={cameraStarting} variant="secondary" fullWidth>
              카메라 시작
            </Button>
          ) : null}
          <Button onClick={() => void saveCurrentPose()} disabled={cameraStarting || isSaving} variant="primary" fullWidth>
            {isSaving ? "각도 확인 중" : "현재 각도 저장"}
          </Button>
          <Button onClick={resetEnrollment} disabled={isSaving} variant="ghost" fullWidth>
            새 인물 등록
          </Button>
        </div>

        {poseEstimate ? (
          <p className="guided-capture__guidance">
            {poseEstimate.guidance}
          </p>
        ) : (
          <p className="guided-capture__guidance">
            카메라 프리뷰를 켠 뒤 한 각도씩 천천히 저장하세요.
          </p>
        )}
        {lastError ? <p className="guided-capture__error">{lastError}</p> : null}
      </div>
    </PanelCard>
  );
}
