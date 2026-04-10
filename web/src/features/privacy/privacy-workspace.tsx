"use client";

import { useEffect, useMemo, useState } from "react";

import { CameraViewport } from "../../components/camera/camera-viewport";
import { BeforeAfterPreview } from "../../components/preview/before-after-preview";
import { fetchRuntimeDiagnostics } from "../../services/diagnostics-api";
import type { PrivacyOptions, StreamProfile } from "../../services/realtime-api";
import { useCameraStream } from "../../hooks/useCameraStream";
import { useFrameUploader } from "../../hooks/useFrameUploader";
import { useRealtimeSession } from "../../hooks/useRealtimeSession";
import { diagnosticsStore, selectDiagnosticsItems, useDiagnosticsStore } from "../../store/diagnostics-store";
import { useSessionStore } from "../../store/session-store";
import { AllowlistStatusCard } from "./allowlist-status-card";
import { DetectionSummaryCard } from "./detection-summary-card";
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
    presetLabel: "Privacy Balanced",
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
          diagnosticsStore.setError(error instanceof Error ? error.message : "diagnostics를 가져오지 못했습니다.");
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
    diagnosticsStore.setSessionContext({ mode: "privacy", presetLabel: "Privacy Balanced" });
  }, []);

  const diagnosticsItems = useMemo(() => selectDiagnosticsItems(diagnosticsSnapshot), [diagnosticsSnapshot]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr) minmax(260px, 320px)" }}>
        <div style={{ display: "grid", gap: "1rem", alignSelf: "start" }}>
          <PrivacyOptionsForm value={privacyOptions} onChange={setPrivacyOptions} disabled={Boolean(sessionSnapshot.sessionId)} />
          <AllowlistStatusCard
            allowlistEnabled={privacyOptions.allowlistEnabled}
            apiStatus={diagnosticsSnapshot.apiStatus}
            queueDepth={diagnosticsSnapshot.queueDepth}
          />
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
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

        <div style={{ display: "grid", gap: "1rem", alignSelf: "start" }}>
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
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "18px",
              backgroundColor: "#ffffff",
              padding: "1.25rem",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
            }}
          >
            <p style={{ margin: "0 0 0.5rem", color: "#4b5563", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              DiagnosticsPanel
            </p>
            <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#111827" }}>Runtime snapshot</h2>
            <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
              {diagnosticsItems.map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <span style={{ color: "#4b5563", fontSize: "0.9rem" }}>{item.label}</span>
                  <span
                    style={{
                      borderRadius: "999px",
                      padding: "0.35rem 0.65rem",
                      fontWeight: 600,
                      backgroundColor:
                        item.tone === "success"
                          ? "#ecfdf5"
                          : item.tone === "warning"
                            ? "#fffbeb"
                            : item.tone === "danger"
                              ? "#fef2f2"
                              : "#f3f4f6",
                      color:
                        item.tone === "success"
                          ? "#065f46"
                          : item.tone === "warning"
                            ? "#92400e"
                            : item.tone === "danger"
                              ? "#991b1b"
                              : "#111827",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
