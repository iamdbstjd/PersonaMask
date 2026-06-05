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

function formatVideoStatus(status: VideoJobUiStatus): string {
  const labels: Record<VideoJobUiStatus, string> = {
    idle: "대기",
    uploading: "업로드 중",
    queued: "대기열 등록",
    processing: "처리 중",
    completed: "완료",
    failed: "실패",
    cancelled: "취소됨",
  };

  return labels[status];
}

export function JobProgressCard({ jobId, status, progress }: JobProgressCardProps) {
  const metrics = [
    { label: "진행률", value: progress ? `${progress.percent}%` : "-" },
    { label: "처리 프레임", value: progress ? `${progress.processed_frames}` : "-" },
    { label: "전체 프레임", value: progress ? `${progress.total_frames}` : "-" },
    { label: "예상 시간", value: progress ? `${progress.eta_sec}초` : "-" },
  ];

  return (
    <section className="stack-md">
      <div className="cluster-between">
        <div className="stack-xs">
          <p className="eyebrow">폴링 스냅샷</p>
          <h3 style={{ margin: 0, fontSize: "1.12rem", letterSpacing: "-0.02em" }}>실시간 작업 진행률</h3>
        </div>
        <StatusBadge label={`상태 · ${formatVideoStatus(status)}`} tone={getStatusTone(status)} />
      </div>

      <div className="field-tile">
        <p className="field-tile__label">작업 ID</p>
        <p className="field-tile__value">{jobId ?? "아직 생성된 작업이 없습니다"}</p>
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
