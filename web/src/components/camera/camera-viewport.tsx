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
      kicker="Camera"
      title="Live camera source"
      description="브라우저 카메라 연결과 세션 입력 상태를 한눈에 확인할 수 있게 단순화했습니다."
    >
      <div className="stack-md">
        <CameraToolbar
          isStarting={isStarting}
          isActive={isActive}
          permission={permission}
          onStartCamera={onStartCamera}
          onStopCamera={onStopCamera}
        />

        <div className="viewport-frame">
          <video ref={videoRef} muted playsInline autoPlay />
          {!isActive ? (
            <div className="viewport-overlay">
              <div className="stack-xs">
                <strong>Camera preview standby</strong>
                <span>
                  Start camera를 누르면 getUserMedia가 연결되고, 이후 realtime session을 바로 시작할 수 있습니다.
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {lastError ? <p style={{ margin: 0, color: "#b91c1c", lineHeight: 1.7 }}>{lastError}</p> : null}
      </div>
    </PanelCard>
  );
}
