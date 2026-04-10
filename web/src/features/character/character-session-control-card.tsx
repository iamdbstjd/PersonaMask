"use client";

import type { RealtimeUiState } from "../../store/session-store";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";

type CharacterSessionControlCardProps = {
  status: RealtimeUiState;
  sessionId: string | null;
  isCameraReady: boolean;
  hasPreset: boolean;
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

export function CharacterSessionControlCard({
  status,
  sessionId,
  isCameraReady,
  hasPreset,
  isBusy,
  isUploading,
  onStartSession,
  onStopSession,
}: CharacterSessionControlCardProps) {
  const canStart = isCameraReady && hasPreset && !sessionId && !isBusy;
  const canStop = Boolean(sessionId) && !isBusy;

  return (
    <PanelCard
      kicker="Character session"
      title="Realtime controls"
      description="프리셋 선택 + 카메라 준비가 완료되면 캐릭터 세션을 시작해 프레임 처리를 연결합니다."
    >
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <StatusBadge
            label={`State · ${status}`}
            tone={status === "streaming" ? "success" : status === "error" ? "danger" : status === "degraded" ? "warning" : "neutral"}
          />
          <StatusBadge label={isCameraReady ? "Camera ready" : "Camera not ready"} tone={isCameraReady ? "success" : "warning"} />
          <StatusBadge label={hasPreset ? "Preset selected" : "Preset required"} tone={hasPreset ? "success" : "warning"} />
          <StatusBadge label={isUploading ? "Uploading frames" : "Upload idle"} tone={isUploading ? "success" : "neutral"} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem", color: "#4b5563", lineHeight: 1.6 }}>
          <span>Session id: {sessionId ?? "—"}</span>
          <span>캐릭터 모드는 `preset_id`가 필수이므로 세션 시작 전 프리셋을 반드시 선택하세요.</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" onClick={onStartSession} disabled={!canStart} style={BUTTON_STYLE}>
            {isBusy && !sessionId ? "Starting…" : "Start character session"}
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
