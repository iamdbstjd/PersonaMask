"use client";

import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { VideoUploadDropzone } from "../../components/uploader";
import type { UseVideoJobResult } from "../../hooks/useVideoJob";

import { ErrorNotice } from "./error-notice";
import { JobProgressCard } from "./job-progress-card";
import { JobTimeline } from "./job-timeline";
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
    <div style={{ display: "grid", gap: "1rem" }}>
      <ErrorNotice message={lastError} />

      <PanelCard
        kicker="Upload flow"
        title="Batch job orchestration"
        description="Upload, queue, processing progress, and download remain separable so the operator can leave this route while work continues."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <StatusBadge label={selectedFile ? "File ready" : "Waiting for file"} tone={selectedFile ? "success" : "neutral"} />
          <StatusBadge label={`Job state · ${status}`} tone={getStatusTone(status)} />
          <StatusBadge label={controller.canCancel ? "Cancellation available" : "Cancellation inactive"} tone="neutral" />
        </div>
      </PanelCard>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <PanelCard
          kicker="VideoUploadDropzone"
          title="Upload + config"
          description="File selection and privacy configuration stay adjacent so the operator understands exactly what will be submitted."
        >
          <div style={{ display: "grid", gap: "1rem" }}>
            <VideoUploadDropzone
              file={selectedFile}
              disabled={status === "uploading" || status === "processing"}
              dragActive={dragActive}
              errorMessage={null}
              onFileSelected={controller.selectFile}
              onDragActiveChange={controller.setDragActive}
            />
            <VideoConfigPanel
              config={config}
              disabled={status === "uploading"}
              onPrivacyOptionChange={controller.updatePrivacyOption}
              onKeepAudioChange={controller.updateKeepAudio}
              onResetDefaults={controller.resetConfig}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button
                type="button"
                disabled={!controller.canSubmit}
                onClick={() => void controller.submit()}
                style={{
                  borderRadius: "999px",
                  border: "1px solid #111827",
                  backgroundColor: controller.canSubmit ? "#111827" : "#9ca3af",
                  color: "#ffffff",
                  fontWeight: 700,
                  padding: "0.7rem 1rem",
                  cursor: controller.canSubmit ? "pointer" : "not-allowed",
                }}
              >
                Submit video privacy job
              </button>
              <button
                type="button"
                disabled={!controller.canCancel}
                onClick={() => void controller.cancel()}
                style={{
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  fontWeight: 600,
                  padding: "0.7rem 1rem",
                  cursor: controller.canCancel ? "pointer" : "not-allowed",
                }}
              >
                Cancel current job
              </button>
              <button
                type="button"
                onClick={controller.reset}
                style={{
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  fontWeight: 600,
                  padding: "0.7rem 1rem",
                  cursor: "pointer",
                }}
              >
                Reset lane state
              </button>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          kicker="JobTimeline"
          title="Progress timeline"
          description="Represent queued → processing → completed|failed|cancelled transitions with status-first clarity."
        >
          <div style={{ display: "grid", gap: "1rem" }}>
            <JobProgressCard jobId={job?.jobId ?? null} status={status} progress={job?.progress ?? null} />
            <JobTimeline status={status} />
          </div>
        </PanelCard>

        <PanelCard
          kicker="VideoResultCard"
          title="Result artifact"
          description="Thumbnail preview, download URL, and expiration metadata stay in a dedicated result panel."
        >
          <VideoResultCard status={status} result={job?.result ?? null} />
        </PanelCard>
      </div>
    </div>
  );
}
