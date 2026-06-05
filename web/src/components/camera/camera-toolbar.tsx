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
  return (
    <div className="cluster-between">
      <div className="cluster">
        <StatusBadge
          label={`Camera · ${permission}`}
          tone={permission === "granted" ? "success" : permission === "denied" ? "danger" : "neutral"}
        />
        <StatusBadge label={isActive ? "Stream attached" : "Stream idle"} tone={isActive ? "success" : "warning"} />
      </div>

      <div className="cluster">
        <Button onClick={onStartCamera} disabled={isStarting || isActive} variant="secondary">
          {isStarting ? "Starting…" : "Start camera"}
        </Button>
        <Button onClick={onStopCamera} disabled={!isActive} variant="primary">
          Stop camera
        </Button>
      </div>
    </div>
  );
}
