"use client";

import type { DetectionCounts } from "../../services/realtime-api";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";

type DetectionSummaryCardProps = {
  detections: DetectionCounts | null;
  latencyMs: number | null;
  lastRequestId: string | null;
  lastError: string | null;
};

export function DetectionSummaryCard({ detections, latencyMs, lastRequestId, lastError }: DetectionSummaryCardProps) {
  const values = [
    { label: "Faces total", value: detections?.facesTotal ?? "—" },
    { label: "Faces redacted", value: detections?.facesRedacted ?? "—" },
    { label: "Plates redacted", value: detections?.platesRedacted ?? "—" },
    { label: "Text redacted", value: detections?.textRegionsRedacted ?? "—" },
  ];

  return (
    <PanelCard
      kicker="Detection summary"
      title="Recent privacy output"
      description="검출 결과, 지연 시간, 최근 요청 상태를 한 번에 확인하도록 재정리했습니다."
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge label={latencyMs === null ? "Latency · —" : `Latency · ${latencyMs} ms`} tone={latencyMs && latencyMs > 180 ? "warning" : "neutral"} />
          <StatusBadge label={lastError ? "Fallback warning" : "No active warning"} tone={lastError ? "warning" : "success"} />
        </div>

        <div className="summary-grid">
          {values.map((item) => (
            <div key={item.label} className="field-tile">
              <p className="field-tile__label">{item.label}</p>
              <p className="field-tile__value">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="meta-list">
          <span>Last request id: {lastRequestId ?? "—"}</span>
          <span>Warning / error: {lastError ?? "No recent runtime errors."}</span>
        </div>
      </div>
    </PanelCard>
  );
}
