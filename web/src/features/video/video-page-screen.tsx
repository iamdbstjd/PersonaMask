"use client";

import { AppShell } from "../../components/common/app-shell";
import { PanelCard } from "../../components/common/panel-card";
import { useVideoJob } from "../../hooks/useVideoJob";

import { VideoBatchWorkspace } from "./video-batch-workspace";
import { JobProgressCard } from "./job-progress-card";
import { JobTimeline } from "./job-timeline";

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
      title="Saved Video Review"
      description="Main review flow for candidate inspection, preserve/character/blur render decisions, queued processing, and final artifact download."
      diagnosticsItems={diagnosticsItems}
      activePreset="Review render config"
      lastError={controller.lastError ?? "No recent batch errors."}
      sideContent={
        <PanelCard
          kicker="Progress"
          title="Track render processing"
          description="후보 검토 이후 렌더 작업의 진행률과 상태 전이를 추적합니다."
        >
          <div className="stack-md">
            <JobProgressCard jobId={controller.job?.jobId ?? null} status={controller.status} progress={controller.job?.progress ?? null} />
            <JobTimeline status={controller.status} />
          </div>
        </PanelCard>
      }
    >
      <VideoBatchWorkspace controller={controller} />
    </AppShell>
  );
}
