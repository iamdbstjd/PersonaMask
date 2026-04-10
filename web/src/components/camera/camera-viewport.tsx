"use client";

import type { MutableRefObject } from "react";

import { PanelCard } from "../common/panel-card";
import { CameraToolbar } from "./camera-toolbar";

type CameraViewportProps = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  permission: "idle" | "requesting" | "granted" | "denied";
  isStarting: boolean;
  isActive: boolean;
  lastError?: string | null;
  onStartCamera: () => void;
  onStopCamera: () => void;
};

export function CameraViewport({
  videoRef,
  permission,
  isStarting,
  isActive,
  lastError,
  onStartCamera,
  onStopCamera,
}: CameraViewportProps) {
  return (
    <PanelCard
      kicker="CameraViewport"
      title="Live camera source"
      description="브라우저 카메라 연결을 먼저 확인하고, privacy 세션에 공급할 원본 프레임을 안정적으로 유지합니다."
    >
      <div style={{ display: "grid", gap: "1rem" }}>
        <CameraToolbar
          isStarting={isStarting}
          isActive={isActive}
          permission={permission}
          onStartCamera={onStartCamera}
          onStopCamera={onStopCamera}
        />

        <div
          style={{
            position: "relative",
            minHeight: "280px",
            borderRadius: "18px",
            overflow: "hidden",
            border: "1px solid #cbd5e1",
            backgroundColor: "#0f172a",
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{ width: "100%", height: "100%", minHeight: "280px", objectFit: "cover", display: "block" }}
          />
          {!isActive ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                padding: "1.5rem",
                textAlign: "center",
                color: "#e2e8f0",
                backgroundColor: "rgba(15, 23, 42, 0.4)",
              }}
            >
              <div style={{ display: "grid", gap: "0.35rem" }}>
                <strong>Camera preview standby</strong>
                <span style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                  Start camera를 누르면 getUserMedia가 연결되고, 이후 privacy session start를 진행할 수 있습니다.
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {lastError ? <p style={{ margin: 0, color: "#b91c1c", lineHeight: 1.6 }}>{lastError}</p> : null}
      </div>
    </PanelCard>
  );
}
