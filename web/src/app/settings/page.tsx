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
      <div className="dashboard-grid">
        <PanelCard kicker="Runtime config" title="Backend connectivity" description="현재 프론트가 사용하는 API 경로와 런타임 상태를 정돈된 카드로 보여줍니다." tone="accent">
          <div className="summary-grid">
            {runtimeRows.map(([label, value]) => (
              <div key={label} className="field-tile">
                <p className="field-tile__label">{label}</p>
                <p className="field-tile__value">{value}</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard kicker="Preferences" title="Operator defaults" description="운영 기준값을 읽기 좋은 토큰 형태로 정리했습니다.">
          <div className="cluster">
            <StatusBadge label="Response mode · binary_jpeg" tone="neutral" />
            <StatusBadge label="Target FPS · 8~10" tone="neutral" />
            <StatusBadge label="Frame width · 960" tone="neutral" />
            <StatusBadge label="Video modes · preserve/character/blur" tone="neutral" />
          </div>
          <ul className="notes-list" style={{ marginTop: "1rem" }}>
            <li>Character/Privacy 모드 모두 세션 생성 후 프레임 업로드 루프를 사용합니다.</li>
            <li>Video 모드는 후보 검토 후 preserve/character/blur 렌더 작업을 상태 폴링으로 추적합니다.</li>
            <li>API base path 변경 시 <code>NEXT_PUBLIC_API_BASE_PATH</code>를 우선 사용합니다.</li>
          </ul>
        </PanelCard>

        <PanelCard kicker="Troubleshooting" title="Quick recovery" description="테스트 중 자주 발생하는 문제와 우선 점검 순서를 차분하게 정리했습니다.">
          <ol className="ordered-list">
            <li>백엔드 서버 포트(<code>8001</code>)와 프론트 rewrites 설정을 먼저 확인합니다.</li>
            <li>카메라 권한/브라우저 정책으로 인해 realtime 세션이 degraded 될 수 있습니다.</li>
            <li>비디오 결과 URL은 작업 상태가 <code>completed</code>일 때만 유효합니다.</li>
          </ol>
        </PanelCard>
      </div>
    </AppShell>
  );
}
