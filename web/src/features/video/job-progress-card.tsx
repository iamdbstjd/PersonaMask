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
    <section style={{ display: "grid", gap: "0.9rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            JobProgressCard
          </p>
          <h3 style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", color: "#111827" }}>Polling snapshot</h3>
        </div>
        <StatusBadge label={`State · ${status}`} tone={getStatusTone(status)} />
      </div>

      <div style={{ borderRadius: "16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.95rem" }}>
        <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>Job id</p>
        <p style={{ margin: "0.3rem 0 0", color: "#111827", fontWeight: 700 }}>{jobId ?? "No job created yet"}</p>
      </div>

      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        {metrics.map((metric) => (
          <div key={metric.label} style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{metric.label}</p>
            <p style={{ margin: "0.35rem 0 0", color: "#111827", fontWeight: 700 }}>{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
