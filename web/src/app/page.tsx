import { AppShell } from "../components/common/app-shell";
import { ModeCard } from "../components/common/mode-card";
import { PanelCard } from "../components/common/panel-card";

const diagnosticsItems = [
  { label: "API", value: "Healthy", tone: "success" as const },
  { label: "GPU", value: "Ready", tone: "success" as const },
  { label: "Latency", value: "42 ms", tone: "warning" as const },
  { label: "Last job", value: "Idle", tone: "neutral" as const },
];

const modeCards = [
  {
    href: "/character",
    title: "Character Mask Mode",
    summary: "Preset-first realtime masking flow with a large preview stage and session controls.",
    status: "Preview ready",
    highlights: ["Preset selection", "Camera permission", "Realtime preview"],
  },
  {
    href: "/privacy",
    title: "Privacy Blur Mode",
    summary: "Policy-driven before/after review with allowlist awareness and conservative warnings.",
    status: "Policy focused",
    highlights: ["Blur policy toggles", "Allowlist status", "Detection counts"],
  },
  {
    href: "/video",
    title: "Video Privacy Batch",
    summary: "Upload, monitor processing progress, and download protected video output.",
    status: "Batch lane",
    highlights: ["Upload dropzone", "Job timeline", "Download artifact"],
  },
] as const;

export default function HomePage() {
  return (
    <AppShell
      currentRoute="overview"
      title="Overview"
      description="One screen to verify runtime readiness, enter the primary modes, and surface the latest diagnostics signal."
      diagnosticsItems={diagnosticsItems}
      activePreset="Spider"
    >
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PanelCard
          kicker="Summary"
          title="System readiness at a glance"
          description="The overview keeps the operator-first priorities visible before entering a dedicated flow."
        >
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {[
              ["API connected", "Yes"],
              ["GPU ready", "Yes"],
              ["Presets loaded", "3 available"],
              ["Last job status", "Completed"],
            ].map(([label, value]) => (
              <div key={label} style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.85rem" }}>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{label}</p>
                <p style={{ margin: "0.35rem 0 0", fontWeight: 700, fontSize: "1.05rem" }}>{value}</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <section
          aria-label="Mode entry"
          style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
        >
          {modeCards.map((card) => (
            <ModeCard key={card.href} {...card} />
          ))}
        </section>

        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <PanelCard
            kicker="Diagnostics"
            title="Recent signal"
            description="Keep warnings accessible without moving them ahead of the primary action cards."
          >
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
              <li>Realtime sessions remain on HTTP frame upload for the P0 transport path.</li>
              <li>Presets mirror contract-first naming from the shared backend schema.</li>
              <li>Diagnostics rail stays visible on desktop and collapsible on smaller viewports.</li>
            </ul>
          </PanelCard>
          <PanelCard
            kicker="Quick links"
            title="Next operational checks"
            description="Settings, allowlist readiness, and batch review entry points live one hop away."
          >
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
              <li>Confirm API endpoint and preview defaults in Settings.</li>
              <li>Review allowlist readiness before switching Privacy mode to strict policies.</li>
              <li>Use Video mode for queued job status and download expiration tracking.</li>
            </ul>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
