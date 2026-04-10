import { AppShell } from "../../components/common/app-shell";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";

const diagnosticsItems = [
  { label: "API", value: "Healthy", tone: "success" as const },
  { label: "GPU", value: "Ready", tone: "success" as const },
  { label: "Latency", value: "38 ms", tone: "warning" as const },
  { label: "Last detection", value: "1 face", tone: "neutral" as const },
];

export default function CharacterPage() {
  return (
    <AppShell
      currentRoute="character"
      title="Character Mask Mode"
      description="Preset selection, camera readiness, and large preview composition stay centered around the operator’s realtime workflow."
      diagnosticsItems={diagnosticsItems}
      activePreset="Spider"
      lastError="Fallback notice placeholder: retain the original frame when no face is detected."
    >
      <div style={{ display: "grid", gap: "1rem" }}>
        <PanelCard
          kicker="Status banner"
          title="Realtime preview skeleton"
          description="Controls remain secondary to the preview stage, and the fallback notice keeps the canvas informative even on missed detections."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <StatusBadge label="Camera permission required" tone="warning" />
            <StatusBadge label="Session state · idle" tone="neutral" />
            <StatusBadge label="Preset · Spider" tone="success" />
          </div>
        </PanelCard>

        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <PanelCard
            kicker="CharacterPresetPanel"
            title="Preset selector"
            description="Thumbnail grid placeholder for character assets, selection state, and preset metadata."
          >
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
              <li>Preset thumbnail grid</li>
              <li>Selected preset summary</li>
              <li>Fallback message slot</li>
            </ul>
          </PanelCard>

          <PanelCard
            kicker="CharacterPreviewStage"
            title="Preview stage"
            description="Large primary surface reserved for original frame, overlay result, and future WebGL compositing."
          >
            <div
              style={{
                borderRadius: "16px",
                border: "1px dashed #cbd5e1",
                minHeight: "320px",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                backgroundColor: "#f8fafc",
              }}
            >
              Preview canvas / processed frame response
            </div>
          </PanelCard>

          <PanelCard
            kicker="SessionControlCard"
            title="Session controls"
            description="Session creation, upload pacing, and latency summaries live here without overpowering the preview."
          >
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
              <li>Create realtime session (`mode=character`)</li>
              <li>Frame upload cadence and latest request id</li>
              <li>Degraded/error state placeholders</li>
            </ul>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
