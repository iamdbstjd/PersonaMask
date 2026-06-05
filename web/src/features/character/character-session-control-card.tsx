"use client";

import type { RealtimeUiState } from "../../store/session-store";
import { Button } from "../../components/common/button";
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
      description="프리셋 선택과 카메라 준비가 끝나면 바로 캐릭터 세션을 시작하고, 문제 생기면 빠르게 정지할 수 있게 구성했습니다."
      tone="accent"
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge
            label={`State · ${status}`}
            tone={status === "streaming" ? "success" : status === "error" ? "danger" : status === "degraded" ? "warning" : "neutral"}
          />
          <StatusBadge label={isCameraReady ? "Camera ready" : "Camera not ready"} tone={isCameraReady ? "success" : "warning"} />
          <StatusBadge label={hasPreset ? "Preset selected" : "Preset required"} tone={hasPreset ? "success" : "warning"} />
          <StatusBadge label={isUploading ? "Uploading frames" : "Upload idle"} tone={isUploading ? "success" : "neutral"} />
        </div>

        <div className="field-grid">
          <div className="field-tile">
            <p className="field-tile__label">Session id</p>
            <p className="field-tile__value">{sessionId ?? "—"}</p>
          </div>
          <p className="field-note" style={{ margin: 0 }}>
            캐릭터 모드는 <code>preset_id</code>가 필수이므로 세션 시작 전에 프리셋을 반드시 선택하세요.
          </p>
        </div>

        <div className="cluster">
          <Button onClick={onStartSession} disabled={!canStart} variant="primary">
            {isBusy && !sessionId ? "Starting…" : "Start character session"}
          </Button>
          <Button onClick={onStopSession} disabled={!canStop} variant="secondary">
            {isBusy && sessionId ? "Stopping…" : "Stop session"}
          </Button>
        </div>
      </div>
    </PanelCard>
  );
}
