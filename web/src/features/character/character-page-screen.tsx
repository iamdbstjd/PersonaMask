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
      title="Realtime Character Preview"
      description="Preset-first camera preview lane for checking character replacement behavior before saved-video render work."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "No recent runtime errors."}
    >
      <CharacterWorkspace />
    </AppShell>
  );
}
