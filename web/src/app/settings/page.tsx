import { AppShell } from "../../components/common/app-shell";
import { PanelCard } from "../../components/common/panel-card";

const diagnosticsItems = [
  { label: "API", value: "Healthy", tone: "success" as const },
  { label: "GPU", value: "Ready", tone: "success" as const },
  { label: "Latency", value: "40 ms", tone: "warning" as const },
  { label: "Preferences", value: "Local only", tone: "neutral" as const },
];

export default function SettingsPage() {
  return (
    <AppShell
      currentRoute="settings"
      title="Settings"
      description="Runtime configuration, diagnostics detail, and preview defaults sit together in a low-friction settings skeleton."
      diagnosticsItems={diagnosticsItems}
      activePreset="Default preferences"
      lastError="No blocking runtime issues recorded."
    >
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <PanelCard
          kicker="RuntimeConfigForm"
          title="API and runtime configuration"
          description="Reserve fields for backend endpoint, session defaults, and environment-specific toggles."
        >
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
            <li>API base URL</li>
            <li>Preferred response mode</li>
            <li>Preview FPS / quality defaults</li>
          </ul>
        </PanelCard>

        <PanelCard
          kicker="DiagnosticsDetails"
          title="Detailed diagnostics"
          description="Dedicated room for richer runtime details beyond the shell rail summary."
        >
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
            <li>GPU/runtime metadata</li>
            <li>Last session + job event traces</li>
            <li>Error and warning history</li>
          </ul>
        </PanelCard>

        <PanelCard
          kicker="PreferencePanel"
          title="Operator preferences"
          description="Persist view preferences locally without mixing them into server truth."
        >
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
            <li>Selected preset memory</li>
            <li>Privacy toggle defaults</li>
            <li>Diagnostics rail open / closed state</li>
          </ul>
        </PanelCard>
      </div>
    </AppShell>
  );
}
