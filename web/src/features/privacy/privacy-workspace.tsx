"use client";

import { useEffect, useState } from "react";

import { CameraViewport } from "../../components/camera/camera-viewport";
import { BeforeAfterPreview } from "../../components/preview/before-after-preview";
import { fetchRuntimeDiagnostics } from "../../services/diagnostics-api";
import type { PrivacyOptions, StreamProfile } from "../../services/realtime-api";
import { useCameraStream } from "../../hooks/useCameraStream";
import { useFrameUploader } from "../../hooks/useFrameUploader";
import { useRealtimeSession } from "../../hooks/useRealtimeSession";
import { diagnosticsStore, useDiagnosticsStore } from "../../store/diagnostics-store";
import { useSessionStore } from "../../store/session-store";
import { AllowlistStatusCard } from "./allowlist-status-card";
import { DetectionSummaryCard } from "./detection-summary-card";
import { GuidedFaceCaptureCard } from "./guided-face-capture-card";
import { PrivacyOptionsForm } from "./privacy-options-form";
import { SessionControlCard } from "./session-control-card";

const DEFAULT_STREAM_PROFILE: StreamProfile = {
  targetFps: 8,
  frameWidth: 960,
  jpegQuality: 0.72,
  responseMode: "binary_jpeg",
};

const DEFAULT_PRIVACY_OPTIONS: PrivacyOptions = {
  blurFaces: true,
  blurPlates: true,
  blurText: true,
  allowlistEnabled: true,
};

export function PrivacyWorkspace() {
  const [privacyOptions, setPrivacyOptions] = useState<PrivacyOptions>(DEFAULT_PRIVACY_OPTIONS);
  const camera = useCameraStream();
  const realtimeSession = useRealtimeSession({
    mode: "privacy",
    presetLabel: "프라이버시 기본",
    streamProfile: DEFAULT_STREAM_PROFILE,
    privacyOptions,
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
    mode: "privacy",
    sessionId: sessionSnapshot.sessionId,
    acceptedProfile: sessionSnapshot.acceptedProfile,
    privacyOptions,
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
          diagnosticsStore.setError(error instanceof Error ? error.message : "진단 정보를 가져오지 못했습니다.");
        }
      }
    };

    void syncDiagnostics();
    const intervalId = window.setInterval(() => {
      void syncDiagnostics();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    diagnosticsStore.setSessionContext({ mode: "privacy", presetLabel: "프라이버시 기본" });
  }, []);

  return (
    <section className="workspace-layout workspace-layout--three">
      <div className="stack-md">
        <PrivacyOptionsForm value={privacyOptions} onChange={setPrivacyOptions} disabled={Boolean(sessionSnapshot.sessionId)} />
        <GuidedFaceCaptureCard
          cameraActive={camera.isActive}
          cameraStarting={camera.isStarting}
          onStartCamera={camera.startCamera}
          captureFrame={camera.captureFrame}
        />
        <AllowlistStatusCard
          allowlistEnabled={privacyOptions.allowlistEnabled}
          apiStatus={diagnosticsSnapshot.apiStatus}
          queueDepth={diagnosticsSnapshot.queueDepth}
        />
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
        />
      </div>

      <div className="stack-md">
        <SessionControlCard
          status={sessionSnapshot.status}
          sessionId={sessionSnapshot.sessionId}
          isCameraReady={sessionSnapshot.isCameraReady}
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
