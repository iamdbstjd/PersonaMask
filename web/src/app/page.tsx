"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../components/common/app-shell";
import { ModeCard } from "../components/common/mode-card";
import { PanelCard } from "../components/common/panel-card";
import { fetchPresets, fetchRuntimeDiagnostics } from "../services/diagnostics-api";
import { diagnosticsStore, formatDiagnosticsStatus, selectDiagnosticsItems, useDiagnosticsStore } from "../store/diagnostics-store";

const modeCards = [
  {
    href: "/character",
    title: "실시간 캐릭터 프리뷰",
    summary: "저장 영상 렌더 전에 브라우저 카메라로 캐릭터 대체 결과를 확인하는 독립 프리뷰 화면입니다.",
    status: "연결됨",
    highlights: ["프리셋 선택", "카메라 스트림", "프리뷰 전용"],
  },
  {
    href: "/privacy",
    title: "실시간 프라이버시 프리뷰",
    summary: "저장 영상 작업 전에 블러 정책과 허용 목록 동작을 카메라로 점검하는 화면입니다.",
    status: "연결됨",
    highlights: ["블러 정책", "허용 목록 상태", "프롬프트 기반 준비"],
  },
  {
    href: "/video",
    title: "저장 영상 리뷰",
    summary: "영상을 업로드하고 후보 얼굴을 검토한 뒤 보존/캐릭터/블러 렌더 결과를 다운로드합니다.",
    status: "연결됨",
    highlights: ["후보 분석", "리뷰 렌더 모드", "결과 다운로드"],
  },
] as const;

export default function HomePage() {
  const [presetCount, setPresetCount] = useState<number | null>(null);
  const diagnosticsSnapshot = useDiagnosticsStore((snapshot) => snapshot);
  const diagnosticsItems = selectDiagnosticsItems(diagnosticsSnapshot);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [runtime, presets] = await Promise.all([fetchRuntimeDiagnostics(), fetchPresets()]);
        if (cancelled) {
          return;
        }
        diagnosticsStore.setRuntimeDiagnostics(runtime);
        setPresetCount(presets.length);
      } catch (error) {
        if (!cancelled) {
          diagnosticsStore.setError(error instanceof Error ? error.message : "개요 초기 데이터를 가져오지 못했습니다.");
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const summaryRows = useMemo(
    () => [
      ["API 상태", formatDiagnosticsStatus(diagnosticsSnapshot.apiStatus)],
      ["GPU 상태", formatDiagnosticsStatus(diagnosticsSnapshot.gpuStatus)],
      ["런타임 상태", formatDiagnosticsStatus(diagnosticsSnapshot.runtimeStatus)],
      ["불러온 프리셋", presetCount === null ? "-" : `${presetCount}`],
    ],
    [diagnosticsSnapshot.apiStatus, diagnosticsSnapshot.gpuStatus, diagnosticsSnapshot.runtimeStatus, presetCount],
  );

  return (
    <AppShell
      currentRoute="overview"
      title="개요"
      description="저장 영상 프라이버시 리뷰를 중심으로, 실시간 프리뷰 화면을 분리해 운영하는 대시보드입니다."
      diagnosticsItems={diagnosticsItems}
      activePreset={diagnosticsSnapshot.currentPreset}
      lastError={diagnosticsSnapshot.lastError ?? "최근 런타임 오류가 없습니다."}
    >
      <div className="stack-lg">
        <PanelCard kicker="요약" title="시스템 준비 상태" description="런타임과 프리셋 정보를 한눈에 읽기 쉬운 카드로 정리했습니다." tone="accent">
          <div className="summary-grid">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="field-tile">
                <p className="field-tile__label">{label}</p>
                <p className="field-tile__value">{value}</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <section aria-label="모드 진입" className="dashboard-grid">
          {modeCards.map((card) => (
            <ModeCard key={card.href} {...card} />
          ))}
        </section>

        <div className="auto-grid">
          <PanelCard kicker="운영 메모" title="먼저 확인할 것" description="각 흐름에 들어가기 전 확인할 핵심 항목을 정리했습니다.">
            <ul className="notes-list">
              <li>저장 영상 리뷰가 핵심 제품 흐름이며, 실시간 화면은 프리뷰와 보정 용도입니다.</li>
              <li>보존/캐릭터 모드는 허용 목록 정책을 기준으로 남길 얼굴과 대체할 얼굴을 판단합니다.</li>
              <li>후보 분석은 렌더 작업 전에 검토 가능한 얼굴 crop을 준비합니다.</li>
            </ul>
          </PanelCard>
          <PanelCard kicker="첫 실행 추천" title="빠른 스모크 테스트" description="전체 제품 루프가 정상인지 확인하는 간단한 운영 흐름입니다.">
            <ol className="ordered-list">
              <li><code>/api/v1/health</code>와 <code>/api/v1/diagnostics/runtime</code>를 확인합니다.</li>
              <li>샘플 영상으로 후보 분석을 실행하고 추출된 얼굴 crop을 확인합니다.</li>
              <li>샘플을 보존 또는 캐릭터 모드로 렌더하고 완료 결과 다운로드를 확인합니다.</li>
            </ol>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
