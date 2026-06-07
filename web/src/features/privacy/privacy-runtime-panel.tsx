"use client";

import { Button } from "../../components/common/button";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import type { DetectionCounts } from "../../services/realtime-api";
import { formatDiagnosticsStatus } from "../../store/diagnostics-store";
import type { RealtimeUiState } from "../../store/session-store";

type PrivacyRuntimePanelProps = {
  status: RealtimeUiState;
  sessionId: string | null;
  isCameraReady: boolean;
  isBusy: boolean;
  isUploading: boolean;
  detections: DetectionCounts | null;
  latencyMs: number | null;
  lastRequestId: string | null;
  lastError: string | null;
  allowlistEnabled: boolean;
  apiStatus: string;
  queueDepth: number | null;
  onStartSession: () => void;
  onStopSession: () => void;
};

function formatRealtimeStatus(status: RealtimeUiState): string {
  const labels: Record<RealtimeUiState, string> = {
    idle: "대기",
    camera_loading: "카메라 준비 중",
    session_starting: "시작 중",
    streaming: "실행 중",
    degraded: "성능 저하",
    error: "오류",
  };

  return labels[status];
}

function statusTone(status: RealtimeUiState) {
  if (status === "streaming") {
    return "success";
  }

  if (status === "degraded") {
    return "warning";
  }

  if (status === "error") {
    return "danger";
  }

  return "neutral";
}

export function PrivacyRuntimePanel({
  status,
  sessionId,
  isCameraReady,
  isBusy,
  isUploading,
  detections,
  latencyMs,
  lastRequestId,
  lastError,
  allowlistEnabled,
  apiStatus,
  queueDepth,
  onStartSession,
  onStopSession,
}: PrivacyRuntimePanelProps) {
  const canStart = isCameraReady && !sessionId && !isBusy;
  const canStop = Boolean(sessionId) && !isBusy;
  const apiHealthy = apiStatus.toLowerCase().includes("healthy");

  const metrics = [
    { label: "얼굴", value: detections ? `${detections.facesRedacted}/${detections.facesTotal}` : "-" },
    { label: "번호판", value: detections?.platesRedacted ?? "-" },
    { label: "텍스트", value: detections?.textRegionsRedacted ?? "-" },
    { label: "지연", value: latencyMs === null ? "-" : `${latencyMs}ms` },
  ];

  return (
    <PanelCard
      className="privacy-runtime-panel"
      kicker="운영"
      title="실행 상태"
      description="세션 시작, 검출 결과, 런타임 상태를 한 곳에서 확인합니다."
    >
      <div className="privacy-runtime">
        <div className="privacy-runtime__header">
          <StatusBadge label={formatRealtimeStatus(status)} tone={statusTone(status)} />
          <div className="privacy-runtime__actions">
            <Button onClick={onStartSession} disabled={!canStart} variant="primary">
              {isBusy && !sessionId ? "시작 중" : "세션 시작"}
            </Button>
            <Button onClick={onStopSession} disabled={!canStop} variant="secondary">
              {isBusy && sessionId ? "중지 중" : "중지"}
            </Button>
          </div>
        </div>

        <div className="privacy-runtime__rows" aria-label="프라이버시 런타임 상태">
          <div>
            <span>API</span>
            <strong>{formatDiagnosticsStatus(apiStatus)}</strong>
            <i className={apiHealthy ? "is-good" : "is-muted"} aria-hidden="true" />
          </div>
          <div>
            <span>카메라</span>
            <strong>{isCameraReady ? "준비됨" : "대기"}</strong>
            <i className={isCameraReady ? "is-good" : "is-muted"} aria-hidden="true" />
          </div>
          <div>
            <span>허용 목록</span>
            <strong>{allowlistEnabled ? "사용" : "꺼짐"}</strong>
            <i className={allowlistEnabled ? "is-good" : "is-muted"} aria-hidden="true" />
          </div>
          <div>
            <span>대기열</span>
            <strong>{queueDepth === null ? "-" : queueDepth}</strong>
            <i className={queueDepth && queueDepth > 0 ? "is-warn" : "is-muted"} aria-hidden="true" />
          </div>
        </div>

        <div className="privacy-runtime__metrics" aria-label="최근 검출 결과">
          {metrics.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="privacy-runtime__meta">
          <span>세션 ID: {sessionId ?? "-"}</span>
          <span>업로드: {isUploading ? "진행 중" : "대기"}</span>
          <span>요청 ID: {lastRequestId ?? "-"}</span>
          <span>오류: {lastError ?? "없음"}</span>
        </div>
      </div>
    </PanelCard>
  );
}
