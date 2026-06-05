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
      title="실시간 프라이버시 프리뷰"
      description="저장 영상 렌더 전에 블러 정책, 허용 목록 동작, 향후 프롬프트 처리를 카메라로 점검하는 화면입니다."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "최근 런타임 오류가 없습니다."}
    >
      <PrivacyWorkspace />
    </AppShell>
  );
}
