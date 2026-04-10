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
    <div style={{ display: "grid", gap: "1rem" }}>
      <PanelCard
        kicker="Diagnostics"
        title="Runtime snapshot"
        description="Expose operational state without overwhelming the primary task flow."
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {items.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <span style={{ color: "#4b5563", fontSize: "0.9rem" }}>{item.label}</span>
              <StatusBadge label={item.value} tone={item.tone} />
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard kicker="Session" title="Current focus" description="Mirror the architecture diagnostics slice fields.">
        <dl style={{ margin: 0, display: "grid", gap: "0.75rem" }}>
          <div>
            <dt style={{ color: "#6b7280", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Mode</dt>
            <dd style={{ margin: 0, color: "#111827", fontWeight: 600 }}>{activeMode}</dd>
          </div>
          <div>
            <dt style={{ color: "#6b7280", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Preset</dt>
            <dd style={{ margin: 0, color: "#111827", fontWeight: 600 }}>{activePreset}</dd>
          </div>
          <div>
            <dt style={{ color: "#6b7280", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Last error</dt>
            <dd style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>{lastError}</dd>
          </div>
        </dl>
      </PanelCard>
    </div>
  );
}
