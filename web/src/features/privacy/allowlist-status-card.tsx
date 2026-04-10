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
      kicker="AllowlistStatusCard"
      title="Allowlist readiness"
      description="worker-3 allowlist API가 연결되면 여기에서 예외 규칙 상태를 즉시 확인할 수 있도록 준비합니다."
    >
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <StatusBadge label={allowlistEnabled ? "Allowlist active" : "Allowlist disabled"} tone={allowlistEnabled ? "success" : "warning"} />
          <StatusBadge label={`API · ${apiStatus}`} tone={apiStatus.toLowerCase().includes("healthy") ? "success" : "neutral"} />
        </div>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
          허용 얼굴 목록 CRUD는 별도 lane이 연결하면 이 카드에서 item count와 최근 동기화 시간을 보여줄 수 있습니다.
        </p>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
          현재 queue depth: <strong>{queueDepth === null ? "—" : queueDepth}</strong>
        </p>
      </div>
    </PanelCard>
  );
}
