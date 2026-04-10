"use client";

import { useEffect, useMemo } from "react";

import { AppShell } from "../../components/common/app-shell";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { getDisplayApiBasePath } from "../../lib/runtime-config";
import { fetchRuntimeDiagnostics } from "../../services/diagnostics-api";
import { diagnosticsStore, selectDiagnosticsItems, useDiagnosticsStore } from "../../store/diagnostics-store";

export default function SettingsPage() {
  const diagnosticsSnapshot = useDiagnosticsStore((snapshot) => snapshot);
  const diagnosticsItems = selectDiagnosticsItems(diagnosticsSnapshot);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const runtime = await fetchRuntimeDiagnostics();
        if (!cancelled) {
          diagnosticsStore.setRuntimeDiagnostics(runtime);
        }
      } catch (error) {
        if (!cancelled) {
          diagnosticsStore.setError(error instanceof Error ? error.message : "settings diagnostics 동기화 실패");
        }
      }
    };

    void sync();
    const intervalId = window.setInterval(() => {
      void sync();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const runtimeRows = useMemo(
    () => [
      ["API base path", getDisplayApiBasePath()],
      ["API status", diagnosticsSnapshot.apiStatus],
      ["GPU status", diagnosticsSnapshot.gpuStatus],
      ["Runtime status", diagnosticsSnapshot.runtimeStatus],
      ["Queue depth", diagnosticsSnapshot.queueDepth === null ? "—" : `${diagnosticsSnapshot.queueDepth}`],
      ["Last request id", diagnosticsSnapshot.lastRequestId ?? "—"],
    ],
    [
      diagnosticsSnapshot.apiStatus,
      diagnosticsSnapshot.gpuStatus,
      diagnosticsSnapshot.lastRequestId,
      diagnosticsSnapshot.queueDepth,
      diagnosticsSnapshot.runtimeStatus,
    ],
  );

  return (
    <AppShell
      currentRoute="settings"
      title="Settings"
      description="Environment-aware runtime information and operator defaults for the web console."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "No blocking runtime issues recorded."}
    >
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <PanelCard kicker="Runtime config" title="Backend connectivity" description="현재 프론트가 사용하는 API 경로와 런타임 상태입니다.">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {runtimeRows.map(([label, value]) => (
              <div key={label} style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{label}</p>
                <p style={{ margin: "0.35rem 0 0", color: "#111827", fontWeight: 700 }}>{value}</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard kicker="Preferences" title="Operator defaults" description="P0 운영 기준값을 빠르게 확인할 수 있는 정적 가이드입니다.">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <StatusBadge label="Response mode · binary_jpeg" tone="neutral" />
            <StatusBadge label="Target FPS · 8~10" tone="neutral" />
            <StatusBadge label="Frame width · 960" tone="neutral" />
            <StatusBadge label="Video mode · video_privacy" tone="neutral" />
          </div>
          <ul style={{ margin: "0.9rem 0 0", paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
            <li>Character/Privacy 모드 모두 세션 생성 후 프레임 업로드 루프를 사용합니다.</li>
            <li>Video 모드는 업로드 이후 상태 폴링 중심으로 동작합니다.</li>
            <li>API base path 변경 시 `NEXT_PUBLIC_API_BASE_PATH`를 우선 사용합니다.</li>
          </ul>
        </PanelCard>

        <PanelCard kicker="Troubleshooting" title="Quick recovery" description="테스트 중 자주 발생하는 문제와 우선 점검 순서입니다.">
          <ol style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
            <li>백엔드 서버 포트(`8001`)와 프론트 rewrites 설정을 먼저 확인합니다.</li>
            <li>카메라 권한/브라우저 정책으로 인해 realtime 세션이 degraded 될 수 있습니다.</li>
            <li>비디오 결과 URL은 작업 상태가 `completed`일 때만 유효합니다.</li>
          </ol>
        </PanelCard>
      </div>
    </AppShell>
  );
}
