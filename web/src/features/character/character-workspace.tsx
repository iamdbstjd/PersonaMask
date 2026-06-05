"use client";

import { useEffect, useMemo, useState } from "react";

import { CameraViewport } from "../../components/camera/camera-viewport";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { BeforeAfterPreview } from "../../components/preview/before-after-preview";
import { useCameraStream } from "../../hooks/useCameraStream";
import { useFrameUploader } from "../../hooks/useFrameUploader";
import { useRealtimeSession } from "../../hooks/useRealtimeSession";
import { diagnosticsStore, useDiagnosticsStore } from "../../store/diagnostics-store";
import { useSessionStore } from "../../store/session-store";
import { DetectionSummaryCard } from "../privacy/detection-summary-card";
import { CharacterSessionControlCard } from "./character-session-control-card";
import { fetchPresets, fetchRuntimeDiagnostics, type PresetItem } from "../../services/diagnostics-api";
import type { PrivacyOptions, StreamProfile } from "../../services/realtime-api";

const DEFAULT_STREAM_PROFILE: StreamProfile = {
  targetFps: 10,
  frameWidth: 960,
  jpegQuality: 0.72,
  responseMode: "binary_jpeg",
};

const CHARACTER_PRIVACY_OPTIONS: PrivacyOptions = {
  blurFaces: false,
  blurPlates: false,
  blurText: false,
  allowlistEnabled: false,
};

export function CharacterWorkspace() {
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isPresetLoading, setIsPresetLoading] = useState(false);

  const camera = useCameraStream();

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.presetId === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  const realtimeSession = useRealtimeSession({
    mode: "character",
    presetId: selectedPreset?.presetId ?? undefined,
    presetLabel: selectedPreset?.label ?? "Preset not selected",
    streamProfile: DEFAULT_STREAM_PROFILE,
    privacyOptions: CHARACTER_PRIVACY_OPTIONS,
  });

  const sessionSnapshot = {
    status: useSessionStore((snapshot) => snapshot.status),
    sessionId: useSessionStore((snapshot) => snapshot.sessionId),
    acceptedProfile: useSessionStore((snapshot) => snapshot.acceptedProfile),
    isCameraReady: useSessionStore((snapshot) => snapshot.isCameraReady),
    isUploading: useSessionStore((snapshot) => snapshot.isUploading),
    lastDetectionCounts: useSessionStore((snapshot) => snapshot.lastDetectionCounts),
    lastServerLatencyMs: useSessionStore((snapshot) => snapshot.lastServerLatencyMs),
    lastError: useSessionStore((snapshot) => snapshot.lastError),
    lastRequestId: useSessionStore((snapshot) => snapshot.requestId),
    originalFrameSrc: useSessionStore((snapshot) => snapshot.originalFrameSrc),
    processedFrameSrc: useSessionStore((snapshot) => snapshot.processedFrameSrc),
  };

  const diagnosticsSnapshot = useDiagnosticsStore((snapshot) => snapshot);

  useFrameUploader({
    enabled: sessionSnapshot.status === "streaming" || sessionSnapshot.status === "degraded",
    mode: "character",
    sessionId: sessionSnapshot.sessionId,
    acceptedProfile: sessionSnapshot.acceptedProfile,
    privacyOptions: CHARACTER_PRIVACY_OPTIONS,
    captureFrame: camera.captureFrame,
  });

  useEffect(() => {
    let cancelled = false;

    const syncDiagnostics = async () => {
      try {
        const snapshot = await fetchRuntimeDiagnostics();
        if (!cancelled) {
          diagnosticsStore.setRuntimeDiagnostics(snapshot);
        }
      } catch (error) {
        if (!cancelled) {
          diagnosticsStore.setError(error instanceof Error ? error.message : "diagnostics를 가져오지 못했습니다.");
        }
      }
    };

    const loadPresets = async () => {
      setIsPresetLoading(true);
      try {
        const items = await fetchPresets();
        if (cancelled) {
          return;
        }
        setPresets(items);
        setSelectedPresetId((previous) => previous ?? items[0]?.presetId ?? null);
      } catch (error) {
        if (!cancelled) {
          diagnosticsStore.setError(error instanceof Error ? error.message : "preset 목록을 가져오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsPresetLoading(false);
        }
      }
    };

    void syncDiagnostics();
    void loadPresets();

    const intervalId = window.setInterval(() => {
      void syncDiagnostics();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    diagnosticsStore.setSessionContext({
      mode: "character",
      presetLabel: selectedPreset?.label ?? "Preset not selected",
    });
  }, [selectedPreset?.label]);

  return (
    <section className="workspace-layout workspace-layout--three">
      <div className="stack-md">
        <PanelCard
          kicker="Preset selector"
          title="Character presets"
          description="세션 시작 전에 사용할 프리셋을 조용한 리스트 형태로 정리했습니다."
        >
          <div className="stack-md">
            <div className="cluster">
              <StatusBadge label={isPresetLoading ? "Loading presets" : `${presets.length} presets`} tone={isPresetLoading ? "warning" : "success"} />
              <StatusBadge label={selectedPreset ? `Selected · ${selectedPreset.label}` : "Preset required"} tone={selectedPreset ? "success" : "warning"} />
            </div>

            <div className="selection-list">
              {presets.map((preset) => {
                const active = selectedPresetId === preset.presetId;
                return (
                  <button
                    key={preset.presetId}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.presetId)}
                    className={["selection-card", active ? "selection-card--active" : null].filter(Boolean).join(" ")}
                  >
                    <strong>{preset.label}</strong>
                    <span className="selection-card__meta">preset_id: {preset.presetId}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </PanelCard>
      </div>

      <div className="stack-md">
        <CameraViewport
          videoRef={camera.videoRef}
          permission={camera.permission}
          isStarting={camera.isStarting}
          isActive={camera.isActive}
          lastError={camera.lastError}
          onStartCamera={camera.startCamera}
          onStopCamera={camera.stopCamera}
        />

        <BeforeAfterPreview
          originalFrameSrc={sessionSnapshot.originalFrameSrc}
          processedFrameSrc={sessionSnapshot.processedFrameSrc}
          detections={sessionSnapshot.lastDetectionCounts}
          latencyMs={sessionSnapshot.lastServerLatencyMs}
          afterTitle="Character preview"
          afterDescription="선택한 프리셋 기준으로 백엔드 처리된 캐릭터 프리뷰가 매끄럽게 갱신됩니다."
          afterEmptyLabel="세션을 시작하면 캐릭터 프리뷰가 이 영역에 표시됩니다."
        />
      </div>

      <div className="stack-md">
        <CharacterSessionControlCard
          status={sessionSnapshot.status}
          sessionId={sessionSnapshot.sessionId}
          isCameraReady={sessionSnapshot.isCameraReady}
          hasPreset={Boolean(selectedPreset)}
          isBusy={realtimeSession.isBusy}
          isUploading={sessionSnapshot.isUploading}
          onStartSession={() => {
            void realtimeSession.startSession();
          }}
          onStopSession={() => {
            void realtimeSession.stopSession();
          }}
        />

        <DetectionSummaryCard
          detections={sessionSnapshot.lastDetectionCounts}
          latencyMs={sessionSnapshot.lastServerLatencyMs}
          lastRequestId={sessionSnapshot.lastRequestId}
          lastError={sessionSnapshot.lastError ?? diagnosticsSnapshot.lastError}
        />
      </div>
    </section>
  );
}
