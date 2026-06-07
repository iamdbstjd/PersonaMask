"use client";

import { AppShell } from "../../components/common/app-shell";
import { Button } from "../../components/common/button";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { useVideoJob } from "../../hooks/useVideoJob";
import type { VideoJobUiStatus } from "../../services/video-api";

import { VideoBatchWorkspace } from "./video-batch-workspace";
import { VideoConfigPanel } from "./video-config-panel";
import { VideoResultCard } from "./video-result-card";

const diagnosticsItems = [
  { label: "API", value: "정상", tone: "success" as const },
  { label: "GPU", value: "준비됨", tone: "success" as const },
  { label: "대기열", value: "1개 활성", tone: "warning" as const },
  { label: "최근 작업", value: "처리 중", tone: "neutral" as const },
];

function isJobActive(status: ReturnType<typeof useVideoJob>["status"]): boolean {
  return status === "uploading" || status === "queued" || status === "processing";
}

function getStatusTone(status: VideoJobUiStatus): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "queued":
    case "uploading":
    case "processing":
      return "warning";
    default:
      return "neutral";
  }
}

function formatVideoStatus(status: VideoJobUiStatus): string {
  const labels: Record<VideoJobUiStatus, string> = {
    idle: "대기",
    uploading: "업로드 중",
    queued: "대기열",
    processing: "처리 중",
    completed: "완료",
    failed: "실패",
    cancelled: "취소",
  };

  return labels[status];
}

export function VideoPageScreen() {
  const controller = useVideoJob();
  const jobActive = isJobActive(controller.status);
  const progress = controller.job?.progress ?? null;
  const progressPercent = progress?.percent ?? 0;
  const statusTone = getStatusTone(controller.status);

  return (
    <AppShell
      currentRoute="video"
      title="저장 영상 리뷰"
      description="소스 영상을 선택하고, 인물 처리 결정을 확인한 뒤 렌더와 QA 리포트를 한 번에 관리합니다."
      diagnosticsItems={diagnosticsItems}
      activePreset="리뷰 렌더 설정"
      lastError={controller.lastError ?? "최근 배치 오류가 없습니다."}
      compactIntro
      showDiagnostics={false}
      sideContent={
        <PanelCard
          kicker="작업 패널"
          title="렌더 준비"
          description="필수 설정과 상태만 한곳에서 확인합니다."
          className="review-control-panel"
        >
          <div className="review-panel-stack">
            <div className="review-panel-status">
              <div>
                <span>현재 상태</span>
                <strong>{formatVideoStatus(controller.status)}</strong>
              </div>
              <StatusBadge label={controller.selectedFile ? "파일 준비됨" : "파일 필요"} tone={controller.selectedFile ? "success" : "neutral"} />
            </div>

            <div className="stack-md">
              <VideoConfigPanel
                config={controller.config}
                disabled={jobActive}
                onModeChange={controller.updateMode}
                onPrivacyOptionChange={controller.updatePrivacyOption}
                onKeepAudioChange={controller.updateKeepAudio}
                onResetDefaults={controller.resetConfig}
              />
            </div>

            <div className="side-command-grid side-command-grid--clean">
              <Button disabled={!controller.canSubmit} onClick={() => void controller.submit()} variant="primary" fullWidth>
                렌더 제출
              </Button>
              <Button disabled={!controller.canCancel} onClick={() => void controller.cancel()} variant="secondary" fullWidth>
                작업 취소
              </Button>
              <Button onClick={controller.reset} variant="ghost" fullWidth>
                초기화
              </Button>
            </div>

            <div className="compact-progress-card">
              <div className="compact-section-header">
                <span>진행 상황</span>
                <StatusBadge label={formatVideoStatus(controller.status)} tone={statusTone} />
              </div>
              <div className="mini-progress" aria-label={`렌더 진행률 ${progressPercent}%`}>
                <span style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
              </div>
              <div className="compact-metrics">
                <div>
                  <span>작업 ID</span>
                  <strong>{controller.job?.jobId ?? "없음"}</strong>
                </div>
                <div>
                  <span>프레임</span>
                  <strong>{progress ? `${progress.processed_frames}/${progress.total_frames}` : "-"}</strong>
                </div>
                <div>
                  <span>예상 시간</span>
                  <strong>{progress ? `${progress.eta_sec}초` : "-"}</strong>
                </div>
              </div>
            </div>

            <details className="compact-disclosure">
              <summary>QA 결과와 다운로드</summary>
              <VideoResultCard accessToken={controller.job?.accessToken ?? null} status={controller.status} result={controller.job?.result ?? null} />
            </details>

            <div className="runtime-chip-row" aria-label="런타임 상태">
              {diagnosticsItems.map((item) => (
                <StatusBadge key={item.label} label={`${item.label} ${item.value}`} tone={item.tone} />
              ))}
            </div>
          </div>
        </PanelCard>
      }
    >
      <VideoBatchWorkspace controller={controller} />
    </AppShell>
  );
}
