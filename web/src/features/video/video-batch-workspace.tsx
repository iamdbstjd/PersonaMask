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

  return (
    <div className="stack-md">
      <ErrorNotice message={lastError} />

      <div className="stack-lg">
        <PanelCard
          kicker="업로드 + 설정"
          title="리뷰 렌더 준비"
          description="소스 영상과 렌더 모드를 먼저 확정하고, 후보 얼굴 검토 기반의 저장 영상 결과를 생성합니다."
          tone="accent"
        >
          <div className="stack-md">
            <div className="cluster">
              <StatusBadge label={selectedFile ? "파일 준비됨" : "파일 대기 중"} tone={selectedFile ? "success" : "neutral"} />
              <StatusBadge label={`작업 상태 · ${formatVideoStatus(status)}`} tone={getStatusTone(status)} />
              <StatusBadge label={controller.canCancel ? "취소 가능" : "취소 비활성"} tone="neutral" />
            </div>

            <VideoUploadDropzone
              file={selectedFile}
              disabled={status === "uploading" || status === "processing"}
              dragActive={dragActive}
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

        <PanelCard
          kicker="배치 설정"
          title="영상 리뷰 렌더 모드"
          description="후보 검토 후 적용할 렌더 정책과 출력 옵션을 관리합니다."
        >
          <div className="stack-md">
            <VideoConfigPanel
              config={config}
              disabled={status === "uploading"}
              onModeChange={controller.updateMode}
              onPrivacyOptionChange={controller.updatePrivacyOption}
              onKeepAudioChange={controller.updateKeepAudio}
              onResetDefaults={controller.resetConfig}
            />
            <div className="cluster">
              <Button disabled={!controller.canSubmit} onClick={() => void controller.submit()} variant="primary">
                리뷰 렌더 작업 제출
              </Button>
              <Button disabled={!controller.canCancel} onClick={() => void controller.cancel()} variant="secondary">
                현재 작업 취소
              </Button>
              <Button onClick={controller.reset} variant="ghost">
                화면 상태 초기화
              </Button>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          kicker="QA 리포트"
          title="리뷰 결과 다운로드"
          description="완료된 저장 영상, 전후 비교 시트, QA 리포트를 함께 확인합니다."
        >
          <VideoResultCard status={status} result={job?.result ?? null} />
        </PanelCard>
      </div>
    </div>
  );
}
