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
      title="Realtime Privacy Preview"
      description="Camera preview lane for blur policy checks, allowlist behavior, and future prompt handling before saved-video rendering."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "No recent runtime errors."}
    >
      <PrivacyWorkspace />
    </AppShell>
  );
}
