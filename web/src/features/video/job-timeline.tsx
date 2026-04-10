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
      return { dot: "#b91c1c", border: "#fecaca", text: "#7f1d1d" };
    }

    if (step === "cancelled") {
      return { dot: "#92400e", border: "#fcd34d", text: "#78350f" };
    }

    return { dot: "#2563eb", border: "#bfdbfe", text: "#1d4ed8" };
  }

  if (isStepReached(status, step)) {
    return { dot: "#059669", border: "#a7f3d0", text: "#065f46" };
  }

  return { dot: "#cbd5e1", border: "#e5e7eb", text: "#64748b" };
}

type JobTimelineProps = {
  status: VideoJobUiStatus;
};

export function JobTimeline({ status }: JobTimelineProps) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}>
      {TIMELINE_STEPS.map((step) => {
        const accent = getAccent(status, step.key);

        return (
          <li
            key={step.key}
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr)",
              gap: "0.75rem",
              alignItems: "start",
              borderRadius: "14px",
              border: `1px solid ${accent.border}`,
              backgroundColor: "#ffffff",
              padding: "0.85rem",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "0.8rem",
                height: "0.8rem",
                borderRadius: "999px",
                backgroundColor: accent.dot,
                marginTop: "0.35rem",
              }}
            />
            <div>
              <strong style={{ color: accent.text }}>{step.label}</strong>
              <p style={{ margin: "0.35rem 0 0", color: "#475569", lineHeight: 1.6 }}>{step.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
