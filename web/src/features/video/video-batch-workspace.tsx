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

export function VideoBatchWorkspace({ controller }: VideoBatchWorkspaceProps) {
  const { config, selectedFile, dragActive, status, job, lastError } = controller;

  return (
    <div className="stack-md">
      <ErrorNotice message={lastError} />

      <div className="stack-lg">
        <PanelCard
          kicker="Upload + config"
          title="Prepare review render"
          description="소스 영상과 렌더 모드를 먼저 확정하고, 후보 얼굴 검토 기반의 저장 영상 결과를 생성합니다."
          tone="accent"
        >
          <div className="stack-md">
            <div className="cluster">
              <StatusBadge label={selectedFile ? "File ready" : "Waiting for file"} tone={selectedFile ? "success" : "neutral"} />
              <StatusBadge label={`Job state · ${status}`} tone={getStatusTone(status)} />
              <StatusBadge label={controller.canCancel ? "Cancellation available" : "Cancellation inactive"} tone="neutral" />
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
          kicker="Batch configuration"
          title="Video review render mode"
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
                Submit review render job
              </Button>
              <Button disabled={!controller.canCancel} onClick={() => void controller.cancel()} variant="secondary">
                Cancel current job
              </Button>
              <Button onClick={controller.reset} variant="ghost">
                Reset lane state
              </Button>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          kicker="QA Report"
          title="Download reviewed result"
          description="완료된 저장 영상, contact sheet, QA 리포트를 함께 확인합니다."
        >
          <VideoResultCard status={status} result={job?.result ?? null} />
        </PanelCard>
      </div>
    </div>
  );
}
