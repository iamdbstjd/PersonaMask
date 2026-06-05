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
      kicker="세션 제어"
      title="실시간 세션 제어"
      description="카메라 준비 상태와 세션 생명주기를 같은 카드에서 관리해 프라이버시 루프를 끊김 없이 시작하고 정지합니다."
      tone="accent"
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge label={`상태 · ${formatRealtimeStatus(status)}`} tone={status === "streaming" ? "success" : status === "error" ? "danger" : status === "degraded" ? "warning" : "neutral"} />
          <StatusBadge label={isCameraReady ? "카메라 준비됨" : "카메라 미준비"} tone={isCameraReady ? "success" : "warning"} />
          <StatusBadge label={isUploading ? "프레임 업로드 중" : "업로드 대기"} tone={isUploading ? "success" : "neutral"} />
        </div>

        <div className="field-grid">
          <div className="field-tile">
            <p className="field-tile__label">세션 ID</p>
            <p className="field-tile__value">{sessionId ?? "-"}</p>
          </div>
          <p className="field-note" style={{ margin: 0 }}>
            상태가 성능 저하로 내려가더라도 UI는 경고 상태를 유지하고 재시도 흐름을 이어갈 수 있습니다.
          </p>
        </div>

        <div className="cluster">
          <Button onClick={onStartSession} disabled={!canStart} variant="primary">
            {isBusy && !sessionId ? "시작 중..." : "프라이버시 세션 시작"}
          </Button>
          <Button onClick={onStopSession} disabled={!canStop} variant="secondary">
            {isBusy && sessionId ? "중지 중..." : "세션 중지"}
          </Button>
        </div>
      </div>
    </PanelCard>
  );
}
