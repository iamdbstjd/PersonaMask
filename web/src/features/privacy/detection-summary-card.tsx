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

const CELL_STYLE = {
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  padding: "0.75rem 0.85rem",
  backgroundColor: "#f8fafc",
} as const;

export function DetectionSummaryCard({ detections, latencyMs, lastRequestId, lastError }: DetectionSummaryCardProps) {
  const values = [
    { label: "Faces total", value: detections?.facesTotal ?? "—" },
    { label: "Faces redacted", value: detections?.facesRedacted ?? "—" },
    { label: "Plates redacted", value: detections?.platesRedacted ?? "—" },
    { label: "Text redacted", value: detections?.textRegionsRedacted ?? "—" },
  ];

  return (
    <PanelCard
      kicker="DetectionSummaryCard"
      title="Detection summary"
      description="privacy preview 옆에서 최근 검출/지연/오류 상태를 바로 검수할 수 있게 유지합니다."
    >
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <StatusBadge label={latencyMs === null ? "Latency · —" : `Latency · ${latencyMs} ms`} tone={latencyMs && latencyMs > 180 ? "warning" : "neutral"} />
          <StatusBadge label={lastError ? "Fallback warning" : "No active warning"} tone={lastError ? "warning" : "success"} />
        </div>

        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {values.map((item) => (
            <div key={item.label} style={CELL_STYLE}>
              <div style={{ color: "#6b7280", fontSize: "0.82rem", marginBottom: "0.25rem" }}>{item.label}</div>
              <strong style={{ fontSize: "1.1rem" }}>{item.value}</strong>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: "0.35rem", color: "#4b5563", lineHeight: 1.6 }}>
          <span>Last request id: {lastRequestId ?? "—"}</span>
          <span>Warning / error: {lastError ?? "No recent runtime errors."}</span>
        </div>
      </div>
    </PanelCard>
  );
}
