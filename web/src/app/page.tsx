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
    title: "Character Mask Mode",
    summary: "Preset-first realtime masking flow with large preview and live frame updates.",
    status: "Connected",
    highlights: ["Preset selection", "Camera stream", "Realtime preview"],
  },
  {
    href: "/privacy",
    title: "Privacy Blur Mode",
    summary: "Policy-driven before/after review with allowlist awareness and detection summaries.",
    status: "Connected",
    highlights: ["Blur policy toggles", "Allowlist status", "Detection counts"],
  },
  {
    href: "/video",
    title: "Video Privacy Batch",
    summary: "Upload, queue tracking, progress polling, and download result orchestration.",
    status: "Connected",
    highlights: ["Upload dropzone", "Job timeline", "Result download"],
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
      description="Backend-connected dashboard for runtime readiness and entry points to character/privacy/video workflows."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "No recent runtime errors."}
    >
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PanelCard kicker="Summary" title="System readiness at a glance" description="Live runtime and preset metadata from backend APIs.">
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {summaryRows.map(([label, value]) => (
              <div key={label} style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.85rem" }}>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{label}</p>
                <p style={{ margin: "0.35rem 0 0", fontWeight: 700, fontSize: "1.05rem" }}>{value}</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <section aria-label="Mode entry" style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {modeCards.map((card) => (
            <ModeCard key={card.href} {...card} />
          ))}
        </section>

        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <PanelCard
            kicker="Diagnostics"
            title="Operational notes"
            description="Quick checks before entering individual realtime or batch pages."
          >
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
              <li>Character mode requires preset selection before session start.</li>
              <li>Privacy mode keeps before/after preview and detection summary synchronized.</li>
              <li>Video mode polls queue state until terminal status and then exposes download URL.</li>
            </ul>
          </PanelCard>
          <PanelCard
            kicker="Quick links"
            title="Recommended first run"
            description="Start with diagnostics and then verify realtime + batch roundtrip."
          >
            <ol style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
              <li>Check `/api/v1/health` and `/api/v1/diagnostics/runtime`.</li>
              <li>Run character session with one preset and verify preview updates.</li>
              <li>Upload sample video and confirm completed result download.</li>
            </ol>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
