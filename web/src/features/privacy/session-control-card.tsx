"use client";

import type { RealtimeUiState } from "../../store/session-store";
import { Button } from "../../components/common/button";
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
      kicker="Session controls"
      title="Realtime session controls"
      description="카메라 준비 상태와 session lifecycle을 같은 카드에서 관리해 privacy 루프를 끊김 없이 시작하고 정지합니다."
      tone="accent"
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge label={`State · ${status}`} tone={status === "streaming" ? "success" : status === "error" ? "danger" : status === "degraded" ? "warning" : "neutral"} />
          <StatusBadge label={isCameraReady ? "Camera ready" : "Camera not ready"} tone={isCameraReady ? "success" : "warning"} />
          <StatusBadge label={isUploading ? "Uploading frames" : "Upload idle"} tone={isUploading ? "success" : "neutral"} />
        </div>

        <div className="field-grid">
          <div className="field-tile">
            <p className="field-tile__label">Session id</p>
            <p className="field-tile__value">{sessionId ?? "—"}</p>
          </div>
          <p className="field-note" style={{ margin: 0 }}>
            상태가 degraded로 내려가더라도 UI는 warning 상태를 유지하고 재시도 흐름을 이어갈 수 있습니다.
          </p>
        </div>

        <div className="cluster">
          <Button onClick={onStartSession} disabled={!canStart} variant="primary">
            {isBusy && !sessionId ? "Starting…" : "Start privacy session"}
          </Button>
          <Button onClick={onStopSession} disabled={!canStop} variant="secondary">
            {isBusy && sessionId ? "Stopping…" : "Stop session"}
          </Button>
        </div>
      </div>
    </PanelCard>
  );
}
