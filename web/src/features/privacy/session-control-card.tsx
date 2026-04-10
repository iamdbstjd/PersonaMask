"use client";

import type { RealtimeUiState } from "../../store/session-store";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";

type SessionControlCardProps = {
  status: RealtimeUiState;
  sessionId: string | null;
  isCameraReady: boolean;
  isBusy: boolean;
  isUploading: boolean;
  onStartSession: () => void;
  onStopSession: () => void;
};

const BUTTON_STYLE = {
  borderRadius: "999px",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  color: "#111827",
  padding: "0.65rem 0.95rem",
  fontWeight: 600,
  cursor: "pointer",
} as const;

export function SessionControlCard({
  status,
  sessionId,
  isCameraReady,
  isBusy,
  isUploading,
  onStartSession,
  onStopSession,
}: SessionControlCardProps) {
  const canStart = isCameraReady && !sessionId && !isBusy;
  const canStop = Boolean(sessionId) && !isBusy;

  return (
    <PanelCard
      kicker="SessionControlCard"
      title="Realtime session controls"
      description="camera 준비 상태와 session lifecycle을 같은 카드에서 관리해 privacy 루프를 끊김 없이 시작/정지합니다."
    >
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <StatusBadge label={`State · ${status}`} tone={status === "streaming" ? "success" : status === "error" ? "danger" : status === "degraded" ? "warning" : "neutral"} />
          <StatusBadge label={isCameraReady ? "Camera ready" : "Camera not ready"} tone={isCameraReady ? "success" : "warning"} />
          <StatusBadge label={isUploading ? "Uploading frames" : "Upload idle"} tone={isUploading ? "success" : "neutral"} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem", color: "#4b5563", lineHeight: 1.6 }}>
          <span>Session id: {sessionId ?? "—"}</span>
          <span>상태가 degraded로 내려가면 warning을 유지한 채 계속 재시도할 수 있습니다.</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" onClick={onStartSession} disabled={!canStart} style={BUTTON_STYLE}>
            {isBusy && !sessionId ? "Starting…" : "Start privacy session"}
          </button>
          <button
            type="button"
            onClick={onStopSession}
            disabled={!canStop}
            style={{ ...BUTTON_STYLE, backgroundColor: "#111827", color: "#ffffff", borderColor: "#111827" }}
          >
            {isBusy && sessionId ? "Stopping…" : "Stop session"}
          </button>
        </div>
      </div>
    </PanelCard>
  );
}
