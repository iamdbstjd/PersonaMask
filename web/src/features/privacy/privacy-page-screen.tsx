"use client";

import { AppShell } from "../../components/common/app-shell";
import { selectDiagnosticsItems, useDiagnosticsStore } from "../../store/diagnostics-store";

import { PrivacyWorkspace } from "./privacy-workspace";

export function PrivacyPageScreen() {
  const diagnosticsSnapshot = useDiagnosticsStore((snapshot) => snapshot);
  const diagnosticsItems = selectDiagnosticsItems(diagnosticsSnapshot);

  return (
    <AppShell
      currentRoute="privacy"
      title="Privacy Blur Mode"
      description="The privacy flow prioritizes policy confidence with before/after comparison, allowlist awareness, and conservative warning surfaces."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "No recent runtime errors."}
    >
      <PrivacyWorkspace />
    </AppShell>
  );
}
