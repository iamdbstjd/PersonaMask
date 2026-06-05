"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../components/common/app-shell";
import { ModeCard } from "../components/common/mode-card";
import { PanelCard } from "../components/common/panel-card";
import { fetchPresets, fetchRuntimeDiagnostics } from "../services/diagnostics-api";
import { diagnosticsStore, selectDiagnosticsItems, useDiagnosticsStore } from "../store/diagnostics-store";

const modeCards = [
  {
    href: "/character",
    title: "Realtime Character Preview",
    summary: "Separate browser-camera preview lane for checking character replacement before saved-video render work.",
    status: "Connected",
    highlights: ["Preset selection", "Camera stream", "Preview only"],
  },
  {
    href: "/privacy",
    title: "Realtime Privacy Preview",
    summary: "Camera preview lane for blur policy checks and allowlist behavior before the saved-video workflow.",
    status: "Connected",
    highlights: ["Blur policy toggles", "Allowlist status", "Prompt groundwork"],
  },
  {
    href: "/video",
    title: "Saved Video Review",
    summary: "Upload media, inspect detected candidates, choose preserve/character/blur render mode, and download the result.",
    status: "Connected",
    highlights: ["Candidate analysis", "Review render modes", "Result download"],
  },
] as const;

export default function HomePage() {
  const [presetCount, setPresetCount] = useState<number | null>(null);
  const diagnosticsSnapshot = useDiagnosticsStore((snapshot) => snapshot);
  const diagnosticsItems = selectDiagnosticsItems(diagnosticsSnapshot);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [runtime, presets] = await Promise.all([fetchRuntimeDiagnostics(), fetchPresets()]);
        if (cancelled) {
          return;
        }
        diagnosticsStore.setRuntimeDiagnostics(runtime);
        setPresetCount(presets.length);
      } catch (error) {
        if (!cancelled) {
          diagnosticsStore.setError(error instanceof Error ? error.message : "overview 초기 데이터를 가져오지 못했습니다.");
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const summaryRows = useMemo(
    () => [
      ["API status", diagnosticsSnapshot.apiStatus],
      ["GPU status", diagnosticsSnapshot.gpuStatus],
      ["Runtime status", diagnosticsSnapshot.runtimeStatus],
      ["Presets loaded", presetCount === null ? "—" : `${presetCount}`],
    ],
    [diagnosticsSnapshot.apiStatus, diagnosticsSnapshot.gpuStatus, diagnosticsSnapshot.runtimeStatus, presetCount],
  );

  return (
    <AppShell
      currentRoute="overview"
      title="Overview"
      description="Backend-connected dashboard for saved-video privacy review with realtime preview lanes kept separate."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "No recent runtime errors."}
    >
      <div className="stack-lg">
        <PanelCard kicker="Summary" title="System readiness at a glance" description="Live runtime and preset metadata surfaced as clean, glanceable tiles." tone="accent">
          <div className="summary-grid">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="field-tile">
                <p className="field-tile__label">{label}</p>
                <p className="field-tile__value">{value}</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <section aria-label="Mode entry" className="dashboard-grid">
          {modeCards.map((card) => (
            <ModeCard key={card.href} {...card} />
          ))}
        </section>

        <div className="auto-grid">
          <PanelCard kicker="Operational notes" title="What to verify first" description="Quick checks before entering each workflow so the UI feels guided rather than mechanical.">
            <ul className="notes-list">
              <li>Saved video review is the main product flow; realtime pages are preview and calibration lanes.</li>
              <li>Preserve and character modes rely on the allowlist policy to decide which face stays visible or gets replaced.</li>
              <li>Candidate analysis prepares reviewable face crops before render jobs.</li>
            </ul>
          </PanelCard>
          <PanelCard kicker="Recommended first run" title="Fast smoke-test path" description="A simple operator flow to confirm the full product loop is healthy.">
            <ol className="ordered-list">
              <li>Check <code>/api/v1/health</code> and <code>/api/v1/diagnostics/runtime</code>.</li>
              <li>Run candidate analysis on a sample video and inspect extracted face crops.</li>
              <li>Render the sample in preserve or character mode and confirm the completed result download.</li>
            </ol>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
