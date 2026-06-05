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
    { label: "전체 얼굴", value: detections?.facesTotal ?? "-" },
    { label: "리댁션된 얼굴", value: detections?.facesRedacted ?? "-" },
    { label: "리댁션된 번호판", value: detections?.platesRedacted ?? "-" },
    { label: "리댁션된 텍스트", value: detections?.textRegionsRedacted ?? "-" },
  ];

  return (
    <PanelCard
      kicker="검출 요약"
      title="최근 프라이버시 출력"
      description="검출 결과, 지연 시간, 최근 요청 상태를 한 번에 확인하도록 재정리했습니다."
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge label={latencyMs === null ? "지연시간 · -" : `지연시간 · ${latencyMs}ms`} tone={latencyMs && latencyMs > 180 ? "warning" : "neutral"} />
          <StatusBadge label={lastError ? "경고 있음" : "활성 경고 없음"} tone={lastError ? "warning" : "success"} />
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
          <span>최근 요청 ID: {lastRequestId ?? "-"}</span>
          <span>경고/오류: {lastError ?? "최근 런타임 오류가 없습니다."}</span>
        </div>
      </div>
    </PanelCard>
  );
}
