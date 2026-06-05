"use client";

import { Button } from "../common/button";
import { StatusBadge } from "../common/status-badge";

type CameraToolbarProps = {
  isStarting: boolean;
  isActive: boolean;
  permission: "idle" | "requesting" | "granted" | "denied";
  onStartCamera: () => void;
  onStopCamera: () => void;
};

export function CameraToolbar({ isStarting, isActive, permission, onStartCamera, onStopCamera }: CameraToolbarProps) {
  const permissionLabel = {
    idle: "대기",
    requesting: "권한 요청 중",
    granted: "허용됨",
    denied: "거부됨",
  }[permission];

  return (
    <div className="cluster-between">
      <div className="cluster">
        <StatusBadge
          label={`카메라 · ${permissionLabel}`}
          tone={permission === "granted" ? "success" : permission === "denied" ? "danger" : "neutral"}
        />
        <StatusBadge label={isActive ? "스트림 연결됨" : "스트림 대기"} tone={isActive ? "success" : "warning"} />
      </div>

      <div className="cluster">
        <Button onClick={onStartCamera} disabled={isStarting || isActive} variant="secondary">
          {isStarting ? "시작 중..." : "카메라 시작"}
        </Button>
        <Button onClick={onStopCamera} disabled={!isActive} variant="primary">
          카메라 중지
        </Button>
      </div>
    </div>
  );
}
