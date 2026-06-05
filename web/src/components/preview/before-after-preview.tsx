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
  afterTitle = "처리 결과 프리뷰",
  afterDescription = "백엔드 처리 응답이 이 영역에 갱신됩니다.",
  afterEmptyLabel = "세션을 시작하면 처리된 프리뷰가 이 영역에 표시됩니다.",
}: BeforeAfterPreviewProps) {
  return (
    <div className="stack-md">
      <div className="cluster">
        <StatusBadge label={latencyMs === null ? "지연시간 · -" : `지연시간 · ${latencyMs}ms`} tone={latencyMs && latencyMs > 180 ? "warning" : "neutral"} />
        <StatusBadge
          label={detections ? `얼굴 ${detections.facesRedacted}/${detections.facesTotal}` : "얼굴 · -"}
          tone={detections && detections.facesRedacted > 0 ? "warning" : "neutral"}
        />
        <StatusBadge
          label={detections ? `번호판 ${detections.platesRedacted}` : "번호판 · -"}
          tone={detections && detections.platesRedacted > 0 ? "warning" : "neutral"}
        />
        <StatusBadge
          label={detections ? `텍스트 ${detections.textRegionsRedacted}` : "텍스트 · -"}
          tone={detections && detections.textRegionsRedacted > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="preview-grid">
        <PreviewFrame
          kicker="처리 전"
          title="입력 프레임"
          description="브라우저에서 캡처한 원본 프레임입니다."
          imageSrc={originalFrameSrc}
          emptyLabel="카메라를 시작하고 프레임을 캡처하면 원본 프리뷰가 표시됩니다."
        />
        <PreviewFrame
          kicker="처리 후"
          title={afterTitle}
          description={afterDescription}
          imageSrc={processedFrameSrc}
          emptyLabel={afterEmptyLabel}
        />
      </div>
    </div>
  );
}
