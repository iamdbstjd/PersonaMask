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

function formatRealtimeStatus(status: RealtimeUiState): string {
  const labels: Record<RealtimeUiState, string> = {
    idle: "대기",
    camera_loading: "카메라 준비 중",
    session_starting: "세션 시작 중",
    streaming: "스트리밍 중",
    degraded: "성능 저하",
    error: "오류",
  };

  return labels[status];
}

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
      kicker="캐릭터 세션"
      title="실시간 제어"
      description="프리셋 선택과 카메라 준비가 끝나면 바로 캐릭터 세션을 시작하고, 문제 생기면 빠르게 정지할 수 있게 구성했습니다."
      tone="accent"
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge
            label={`상태 · ${formatRealtimeStatus(status)}`}
            tone={status === "streaming" ? "success" : status === "error" ? "danger" : status === "degraded" ? "warning" : "neutral"}
          />
          <StatusBadge label={isCameraReady ? "카메라 준비됨" : "카메라 미준비"} tone={isCameraReady ? "success" : "warning"} />
          <StatusBadge label={hasPreset ? "프리셋 선택됨" : "프리셋 필요"} tone={hasPreset ? "success" : "warning"} />
          <StatusBadge label={isUploading ? "프레임 업로드 중" : "업로드 대기"} tone={isUploading ? "success" : "neutral"} />
        </div>

        <div className="field-grid">
          <div className="field-tile">
            <p className="field-tile__label">세션 ID</p>
            <p className="field-tile__value">{sessionId ?? "-"}</p>
          </div>
          <p className="field-note" style={{ margin: 0 }}>
            캐릭터 모드는 <code>preset_id</code>가 필수이므로 세션 시작 전에 프리셋을 반드시 선택하세요.
          </p>
        </div>

        <div className="cluster">
          <Button onClick={onStartSession} disabled={!canStart} variant="primary">
            {isBusy && !sessionId ? "시작 중..." : "캐릭터 세션 시작"}
          </Button>
          <Button onClick={onStopSession} disabled={!canStop} variant="secondary">
            {isBusy && sessionId ? "중지 중..." : "세션 중지"}
          </Button>
        </div>
      </div>
    </PanelCard>
  );
}
