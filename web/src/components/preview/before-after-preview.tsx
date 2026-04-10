"use client";

import type { DetectionCounts } from "../../services/realtime-api";
import { StatusBadge } from "../common/status-badge";
import { PreviewFrame } from "./preview-frame";

type BeforeAfterPreviewProps = {
  originalFrameSrc: string | null;
  processedFrameSrc: string | null;
  detections: DetectionCounts | null;
  latencyMs: number | null;
  afterTitle?: string;
  afterDescription?: string;
  afterEmptyLabel?: string;
};

export function BeforeAfterPreview({
  originalFrameSrc,
  processedFrameSrc,
  detections,
  latencyMs,
  afterTitle = "Processed preview",
  afterDescription = "백엔드 처리 응답이 이 영역에 갱신됩니다.",
  afterEmptyLabel = "세션을 시작하면 처리된 프리뷰가 이 영역에 표시됩니다.",
}: BeforeAfterPreviewProps) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <StatusBadge label={latencyMs === null ? "Latency · —" : `Latency · ${latencyMs} ms`} tone={latencyMs && latencyMs > 180 ? "warning" : "neutral"} />
        <StatusBadge
          label={detections ? `Faces ${detections.facesRedacted}/${detections.facesTotal}` : "Faces · —"}
          tone={detections && detections.facesRedacted > 0 ? "warning" : "neutral"}
        />
        <StatusBadge
          label={detections ? `Plates ${detections.platesRedacted}` : "Plates · —"}
          tone={detections && detections.platesRedacted > 0 ? "warning" : "neutral"}
        />
        <StatusBadge
          label={detections ? `Text ${detections.textRegionsRedacted}` : "Text · —"}
          tone={detections && detections.textRegionsRedacted > 0 ? "warning" : "neutral"}
        />
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <PreviewFrame
          kicker="Before"
          title="Input frame"
          description="브라우저에서 캡처한 원본 프레임입니다."
          imageSrc={originalFrameSrc}
          emptyLabel="카메라를 시작하고 프레임을 캡처하면 원본 프리뷰가 표시됩니다."
        />
        <PreviewFrame
          kicker="After"
          title={afterTitle}
          description={afterDescription}
          imageSrc={processedFrameSrc}
          emptyLabel={afterEmptyLabel}
        />
      </div>
    </div>
  );
}
