"use client";

import { PanelCard } from "../common/panel-card";
import { StatusBadge } from "../common/status-badge";

export type DiagnosticItem = {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

type DiagnosticsRailProps = {
  items: readonly DiagnosticItem[];
  activeMode: string;
  activePreset: string;
  lastError: string;
};

export function DiagnosticsRail({
  items,
  activeMode,
  activePreset,
  lastError,
}: DiagnosticsRailProps) {
  return (
    <div className="aside-stack">
      <PanelCard
        kicker="운영 상태"
        title="런타임 스냅샷"
        description="영상 처리에 필요한 API, GPU, 대기열 상태만 정리했습니다."
      >
        <div className="stack-sm">
          {items.map((item) => (
            <div key={item.label} className="cluster-between">
              <span className="text-muted" style={{ fontSize: "0.94rem" }}>
                {item.label}
              </span>
              <StatusBadge label={item.value} tone={item.tone} />
            </div>
          ))}

          <div className="section-divider" />

          <div className="field-grid">
            <div className="field-tile">
              <p className="field-tile__label">모드</p>
              <p className="field-tile__value">{activeMode}</p>
            </div>
            <div className="field-tile">
              <p className="field-tile__label">프리셋</p>
              <p className="field-tile__value">{activePreset}</p>
            </div>
          </div>

          <p className="field-note" style={{ margin: 0 }}>
            최근 오류: {lastError}
          </p>
        </div>
      </PanelCard>
    </div>
  );
}
