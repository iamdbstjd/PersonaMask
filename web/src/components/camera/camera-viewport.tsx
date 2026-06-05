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
      kicker="카메라"
      title="실시간 카메라 입력"
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
                <strong>카메라 프리뷰 대기 중</strong>
                <span>
                  카메라 시작을 누르면 브라우저 카메라가 연결되고, 이후 실시간 세션을 바로 시작할 수 있습니다.
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
