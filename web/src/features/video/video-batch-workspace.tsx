"use client";

import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { VideoUploadDropzone } from "../../components/uploader";
import type { UseVideoJobResult } from "../../hooks/useVideoJob";

import { ErrorNotice } from "./error-notice";
import { CandidateReviewBoard } from "./candidate-review-board";

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
  const { selectedFile, dragActive, status, lastError } = controller;
  const jobActive = status === "uploading" || status === "queued" || status === "processing";
  const candidateCount = controller.candidateAnalysis?.candidates.length ?? 0;
  const decisionCount = Object.keys(controller.candidateActions).length;

  return (
    <div className="stack-md">
      <ErrorNotice message={lastError} />

      <div className="video-workspace-main video-workspace-main--clean">
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
    </div>
  );
}
