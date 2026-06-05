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
    label: "Upload accepted",
    description: "Video file and JSON config are being sent as multipart form-data.",
  },
  {
    key: "queued",
    label: "Queued",
    description: "The backend has created a batch job and is waiting for worker capacity.",
  },
  {
    key: "processing",
    label: "Processing",
    description: "Poll frame progress and ETA without blocking the operator in this route.",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Expose download URL, thumbnail preview, and expiry metadata.",
  },
  {
    key: "failed",
    label: "Failed",
    description: "Surface the latest failure reason with retry guidance near the uploader.",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    description: "Keep the last known job context visible even after a user cancellation.",
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
