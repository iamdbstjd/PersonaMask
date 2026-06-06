"use client";

import { Button } from "../../components/common/button";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { VideoUploadDropzone } from "../../components/uploader";
import type { UseVideoJobResult } from "../../hooks/useVideoJob";

import { ErrorNotice } from "./error-notice";
import { CandidateReviewBoard } from "./candidate-review-board";
import { VideoConfigPanel } from "./video-config-panel";
import { VideoResultCard } from "./video-result-card";

type VideoBatchWorkspaceProps = {
  controller: UseVideoJobResult;
};

function getStatusTone(status: UseVideoJobResult["status"]): "neutral" | "success" | "warning" | "danger" {
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

function formatVideoStatus(status: UseVideoJobResult["status"]): string {
  const labels: Record<UseVideoJobResult["status"], string> = {
    idle: "대기",
    uploading: "업로드 중",
    queued: "대기열 등록",
    processing: "처리 중",
    completed: "완료",
    failed: "실패",
    cancelled: "취소됨",
  };

  return labels[status];
}

export function VideoBatchWorkspace({ controller }: VideoBatchWorkspaceProps) {
  const { config, selectedFile, dragActive, status, job, lastError } = controller;
  const jobActive = status === "uploading" || status === "queued" || status === "processing";
  const candidateCount = controller.candidateAnalysis?.candidates.length ?? 0;
  const decisionCount = Object.keys(controller.candidateActions).length;

  return (
    <div className="stack-md">
      <ErrorNotice message={lastError} />

      <div className="video-workspace-grid">
        <div className="video-workspace-main">
          <PanelCard kicker="업로드" title="소스 영상" tone="accent">
            <div className="stack-md">
              <div className="review-summary-strip">
                <div>
                  <span>파일</span>
                  <strong>{selectedFile ? selectedFile.name : "대기 중"}</strong>
                </div>
                <div>
                  <span>후보</span>
                  <strong>{candidateCount}명</strong>
                </div>
                <div>
                  <span>결정</span>
                  <strong>{decisionCount}개</strong>
                </div>
                <StatusBadge label={formatVideoStatus(status)} tone={getStatusTone(status)} />
              </div>

              <VideoUploadDropzone
                file={selectedFile}
                disabled={jobActive}
                dragActive={dragActive}
                helperText="MP4, QuickTime, WebM"
                errorMessage={null}
                onFileSelected={controller.selectFile}
                onDragActiveChange={controller.setDragActive}
              />
            </div>
          </PanelCard>

          <CandidateReviewBoard
            analysis={controller.candidateAnalysis}
            actions={controller.candidateActions}
            disabled={status === "uploading" || status === "processing" || status === "queued"}
            isAnalyzing={controller.isAnalyzingCandidates}
            canAnalyze={controller.canAnalyzeCandidates}
            onAnalyze={controller.analyzeCandidates}
            onActionChange={controller.updateCandidateAction}
          />
        </div>

        <aside className="video-workspace-side">
          <PanelCard kicker="렌더 설정" title="처리 방식">
            <div className="stack-md">
              <StatusBadge label={selectedFile ? "제출 가능 상태 확인 중" : "파일 필요"} tone={selectedFile ? "success" : "neutral"} />
              <VideoConfigPanel
                config={config}
                disabled={jobActive}
                onModeChange={controller.updateMode}
                onPrivacyOptionChange={controller.updatePrivacyOption}
                onKeepAudioChange={controller.updateKeepAudio}
                onResetDefaults={controller.resetConfig}
              />
              <div className="command-grid">
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
            </div>
          </PanelCard>

          <PanelCard kicker="QA 리포트" title="결과">
            <VideoResultCard accessToken={job?.accessToken ?? null} status={status} result={job?.result ?? null} />
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}
