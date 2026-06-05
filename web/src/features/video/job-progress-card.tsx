"use client";

import { StatusBadge } from "../../components/common/status-badge";
import type { VideoJobProgress, VideoJobUiStatus } from "../../services/video-api";

type JobProgressCardProps = {
  jobId: string | null;
  status: VideoJobUiStatus;
  progress: VideoJobProgress | null;
};

function getStatusTone(status: VideoJobUiStatus): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "queued":
    case "uploading":
    case "processing":
      return "warning";
    default:
      return "neutral";
  }
}

export function JobProgressCard({ jobId, status, progress }: JobProgressCardProps) {
  const metrics = [
    { label: "Percent", value: progress ? `${progress.percent}%` : "—" },
    { label: "Processed", value: progress ? `${progress.processed_frames}` : "—" },
    { label: "Total frames", value: progress ? `${progress.total_frames}` : "—" },
    { label: "ETA", value: progress ? `${progress.eta_sec}s` : "—" },
  ];

  return (
    <section className="stack-md">
      <div className="cluster-between">
        <div className="stack-xs">
          <p className="eyebrow">Polling snapshot</p>
          <h3 style={{ margin: 0, fontSize: "1.12rem", letterSpacing: "-0.02em" }}>Live job progress</h3>
        </div>
        <StatusBadge label={`State · ${status}`} tone={getStatusTone(status)} />
      </div>

      <div className="field-tile">
        <p className="field-tile__label">Job id</p>
        <p className="field-tile__value">{jobId ?? "No job created yet"}</p>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="field-tile">
            <p className="field-tile__label">{metric.label}</p>
            <p className="field-tile__value">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
