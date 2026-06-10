"use client";

import { useEffect, useMemo } from "react";

import { AppShell } from "../../components/common/app-shell";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { getDisplayApiBasePath } from "../../lib/runtime-config";
import { fetchRuntimeDiagnostics } from "../../services/diagnostics-api";
import { diagnosticsStore, formatDiagnosticsStatus, selectDiagnosticsItems, useDiagnosticsStore } from "../../store/diagnostics-store";

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
          diagnosticsStore.setError(error instanceof Error ? error.message : "설정 진단 정보 동기화에 실패했습니다.");
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
      ["API 기본 경로", getDisplayApiBasePath()],
      ["API 상태", formatDiagnosticsStatus(diagnosticsSnapshot.apiStatus)],
      ["GPU 상태", formatDiagnosticsStatus(diagnosticsSnapshot.gpuStatus)],
      ["런타임 상태", formatDiagnosticsStatus(diagnosticsSnapshot.runtimeStatus)],
      ["대기열 깊이", diagnosticsSnapshot.queueDepth === null ? "-" : `${diagnosticsSnapshot.queueDepth}`],
      ["최근 요청 ID", diagnosticsSnapshot.lastRequestId ?? "-"],
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
      title="설정"
      description="웹 콘솔의 런타임 정보와 운영 기본값을 환경 기준으로 확인합니다."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "차단 중인 런타임 문제가 없습니다."}
    >
      <div className="dashboard-grid">
        <PanelCard kicker="런타임 설정" title="백엔드 연결 상태" description="현재 프론트가 사용하는 API 경로와 런타임 상태를 정돈된 카드로 보여줍니다." tone="accent">
          <div className="summary-grid">
            {runtimeRows.map(([label, value]) => (
              <div key={label} className="field-tile">
                <p className="field-tile__label">{label}</p>
                <p className="field-tile__value">{value}</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard kicker="환경 기본값" title="운영 기본 설정" description="운영 기준값을 읽기 좋은 토큰 형태로 정리했습니다.">
          <div className="cluster">
            <StatusBadge label="입력 · 업로드 영상" tone="neutral" />
            <StatusBadge label="디퓨전 · 이미지 변환" tone="neutral" />
            <StatusBadge label="산출물 · MP4 + QA" tone="neutral" />
            <StatusBadge label="영상 모드 · 유지/디퓨전/가림" tone="neutral" />
          </div>
          <ul className="notes-list" style={{ marginTop: "1rem" }}>
            <li>영상 모드는 후보 검토 후 유지/디퓨전 대체/가림 작업을 상태 폴링으로 확인합니다.</li>
            <li>디퓨전 변환 모델은 <code>PERSONAMASK_DIFFUSION_MODEL</code>과 선택 의존성 설치 여부에 따라 연결됩니다.</li>
            <li>API 기본 경로 변경 시 <code>NEXT_PUBLIC_API_BASE_PATH</code>를 우선 사용합니다.</li>
          </ul>
        </PanelCard>

        <PanelCard kicker="문제 해결" title="빠른 복구" description="테스트 중 자주 발생하는 문제와 우선 점검 순서를 차분하게 정리했습니다.">
          <ol className="ordered-list">
            <li>백엔드 서버 포트(<code>8001</code>)와 프론트 경로 재작성 설정을 먼저 확인합니다.</li>
            <li>디퓨전 변환 모델이 준비되지 않으면 백엔드는 안전한 스타일 fallback으로 처리를 계속합니다.</li>
            <li>비디오 결과 URL과 QA 리포트 URL은 작업 상태가 완료일 때만 유효합니다.</li>
          </ol>
        </PanelCard>
      </div>
    </AppShell>
  );
}
