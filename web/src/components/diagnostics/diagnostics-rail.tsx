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
        kicker="Live status"
        title="Runtime snapshot"
        description="핵심 운영 상태만 남겨서 사이드 패널을 더 차분하게 정리했습니다."
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
              <p className="field-tile__label">Mode</p>
              <p className="field-tile__value">{activeMode}</p>
            </div>
            <div className="field-tile">
              <p className="field-tile__label">Preset</p>
              <p className="field-tile__value">{activePreset}</p>
            </div>
          </div>

          <p className="field-note" style={{ margin: 0 }}>
            Last error: {lastError}
          </p>
        </div>
      </PanelCard>
    </div>
  );
}
