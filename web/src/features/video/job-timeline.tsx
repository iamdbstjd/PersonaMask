"use client";

import type { VideoJobUiStatus } from "../../services/video-api";

type TimelineStep = {
  key: Exclude<VideoJobUiStatus, "idle">;
  label: string;
  description: string;
};

const TIMELINE_STEPS: readonly TimelineStep[] = [
  {
    key: "uploading",
    label: "업로드 접수",
    description: "영상 파일과 JSON 설정을 multipart form-data로 전송합니다.",
  },
  {
    key: "queued",
    label: "대기열 등록",
    description: "백엔드가 배치 작업을 만들고 사용 가능한 처리 자원을 기다립니다.",
  },
  {
    key: "processing",
    label: "처리 중",
    description: "이 화면을 막지 않고 프레임 진행률과 예상 시간을 폴링합니다.",
  },
  {
    key: "completed",
    label: "완료",
    description: "다운로드 URL, 썸네일 프리뷰, 만료 정보를 표시합니다.",
  },
  {
    key: "failed",
    label: "실패",
    description: "최근 실패 사유와 재시도 안내를 업로더 근처에 표시합니다.",
  },
  {
    key: "cancelled",
    label: "취소됨",
    description: "사용자가 취소한 뒤에도 마지막 작업 맥락을 볼 수 있게 유지합니다.",
  },
] as const;

function isStepReached(activeStatus: VideoJobUiStatus, stepStatus: TimelineStep["key"]): boolean {
  if (activeStatus === "idle") {
    return false;
  }

  const order: TimelineStep["key"][] = ["uploading", "queued", "processing", "completed", "failed", "cancelled"];
  return order.indexOf(activeStatus) >= order.indexOf(stepStatus);
}

function getAccent(status: VideoJobUiStatus, step: TimelineStep["key"]): { dot: string; border: string; text: string } {
  if (status === step) {
    if (step === "failed") {
      return { dot: "#b91c1c", border: "rgba(248, 113, 113, 0.24)", text: "#7f1d1d" };
    }

    if (step === "cancelled") {
      return { dot: "#b45309", border: "rgba(245, 158, 11, 0.24)", text: "#92400e" };
    }

    return { dot: "#2563eb", border: "rgba(96, 165, 250, 0.24)", text: "#1d4ed8" };
  }

  if (isStepReached(status, step)) {
    return { dot: "#059669", border: "rgba(5, 150, 105, 0.22)", text: "#047857" };
  }

  return { dot: "#cbd5e1", border: "rgba(148, 163, 184, 0.22)", text: "#64748b" };
}

type JobTimelineProps = {
  status: VideoJobUiStatus;
};

export function JobTimeline({ status }: JobTimelineProps) {
  const visibleSteps = status === "idle" ? TIMELINE_STEPS.slice(0, 2) : TIMELINE_STEPS;

  return (
    <ol className="timeline-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {visibleSteps.map((step) => {
        const accent = getAccent(status, step.key);

        return (
          <li key={step.key} className="timeline-item" style={{ borderColor: accent.border }}>
            <span className="timeline-dot" style={{ backgroundColor: accent.dot }} aria-hidden="true" />
            <div>
              <strong style={{ color: accent.text }}>{step.label}</strong>
              <p style={{ margin: "0.35rem 0 0", color: "#475569", lineHeight: 1.7 }}>{step.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
