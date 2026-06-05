"use client";

import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";

type AllowlistStatusCardProps = {
  allowlistEnabled: boolean;
  apiStatus: string;
  queueDepth: number | null;
};

export function AllowlistStatusCard({ allowlistEnabled, apiStatus, queueDepth }: AllowlistStatusCardProps) {
  return (
    <PanelCard
      kicker="Allowlist readiness"
      title="Allowlist sync status"
      description="허용 얼굴 정책이 켜져 있는지, 백엔드 상태가 안정적인지, 처리 여유가 있는지 빠르게 읽을 수 있습니다."
      tone="accent"
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge label={allowlistEnabled ? "Allowlist active" : "Allowlist disabled"} tone={allowlistEnabled ? "success" : "warning"} />
          <StatusBadge label={`API · ${apiStatus}`} tone={apiStatus.toLowerCase().includes("healthy") ? "success" : "neutral"} />
        </div>

        <div className="field-grid">
          <div className="field-tile">
            <p className="field-tile__label">Current queue depth</p>
            <p className="field-tile__value">{queueDepth === null ? "—" : queueDepth}</p>
          </div>
          <p className="field-note" style={{ margin: 0 }}>
            허용 얼굴 목록 CRUD가 연결되면 이 카드에서 item count와 최근 동기화 시간을 바로 보여주도록 확장할 수 있습니다.
          </p>
        </div>
      </div>
    </PanelCard>
  );
}
