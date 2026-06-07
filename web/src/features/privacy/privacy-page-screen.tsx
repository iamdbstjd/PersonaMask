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
      title="프라이버시 프리뷰"
      description="카메라로 블러 정책과 허용 인물 등록 상태를 빠르게 점검합니다."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "최근 런타임 오류가 없습니다."}
      compactIntro
      showDiagnostics={false}
    >
      <PrivacyWorkspace />
    </AppShell>
  );
}
