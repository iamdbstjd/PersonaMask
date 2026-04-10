"use client";

import { AppShell } from "../../components/common/app-shell";
import { useVideoJob } from "../../hooks/useVideoJob";

import { VideoBatchWorkspace } from "./video-batch-workspace";

const diagnosticsItems = [
  { label: "API", value: "Healthy", tone: "success" as const },
  { label: "GPU", value: "Ready", tone: "success" as const },
  { label: "Queue", value: "1 active", tone: "warning" as const },
  { label: "Last job", value: "Processing", tone: "neutral" as const },
];

export function VideoPageScreen() {
  const controller = useVideoJob();

  return (
    <AppShell
      currentRoute="video"
      title="Video Privacy Batch"
      description="Status-centric batch processing UI for upload, queued job tracking, and final artifact download."
      diagnosticsItems={diagnosticsItems}
      activePreset="Video privacy config"
      lastError={controller.lastError ?? "No recent batch errors."}
    >
      <VideoBatchWorkspace controller={controller} />
    </AppShell>
  );
}
