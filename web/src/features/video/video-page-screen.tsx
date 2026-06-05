"use client";

import { AppShell } from "../../components/common/app-shell";
import { PanelCard } from "../../components/common/panel-card";
import { useVideoJob } from "../../hooks/useVideoJob";

import { VideoBatchWorkspace } from "./video-batch-workspace";
import { JobProgressCard } from "./job-progress-card";
import { JobTimeline } from "./job-timeline";

const diagnosticsItems = [
  { label: "API", value: "정상", tone: "success" as const },
  { label: "GPU", value: "준비됨", tone: "success" as const },
  { label: "대기열", value: "1개 활성", tone: "warning" as const },
  { label: "최근 작업", value: "처리 중", tone: "neutral" as const },
];

export function VideoPageScreen() {
  const controller = useVideoJob();

  return (
    <AppShell
      currentRoute="video"
      title="저장 영상 리뷰"
      description="후보 얼굴 검토, 보존/캐릭터/블러 렌더 결정, 대기열 처리, 최종 산출물 다운로드까지 이어지는 핵심 리뷰 흐름입니다."
      diagnosticsItems={diagnosticsItems}
      activePreset="리뷰 렌더 설정"
      lastError={controller.lastError ?? "최근 배치 오류가 없습니다."}
      sideContent={
        <PanelCard
          kicker="진행률"
          title="렌더 처리 추적"
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
