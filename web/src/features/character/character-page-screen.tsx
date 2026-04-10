"use client";

import { AppShell } from "../../components/common/app-shell";
import { selectDiagnosticsItems, useDiagnosticsStore } from "../../store/diagnostics-store";
import { CharacterWorkspace } from "./character-workspace";

export function CharacterPageScreen() {
  const diagnosticsSnapshot = useDiagnosticsStore((snapshot) => snapshot);
  const diagnosticsItems = selectDiagnosticsItems(diagnosticsSnapshot);

  return (
    <AppShell
      currentRoute="character"
      title="Character Mask Mode"
      description="Preset-first realtime flow for live camera input and backend-processed character preview."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "No recent runtime errors."}
    >
      <CharacterWorkspace />
    </AppShell>
  );
}
