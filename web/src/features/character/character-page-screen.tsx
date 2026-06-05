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
      title="실시간 캐릭터 프리뷰"
      description="저장 영상 렌더 전에 프리셋 기반 캐릭터 대체 결과를 카메라로 확인하는 화면입니다."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "최근 런타임 오류가 없습니다."}
    >
      <CharacterWorkspace />
    </AppShell>
  );
}
