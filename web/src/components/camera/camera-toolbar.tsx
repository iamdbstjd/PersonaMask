"use client";

import { StatusBadge } from "../common/status-badge";

type CameraToolbarProps = {
  isStarting: boolean;
  isActive: boolean;
  permission: "idle" | "requesting" | "granted" | "denied";
  onStartCamera: () => void;
  onStopCamera: () => void;
};

const BUTTON_STYLE = {
  borderRadius: "999px",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  color: "#111827",
  padding: "0.65rem 0.95rem",
  fontWeight: 600,
  cursor: "pointer",
} as const;

export function CameraToolbar({ isStarting, isActive, permission, onStartCamera, onStopCamera }: CameraToolbarProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <StatusBadge
          label={`Camera · ${permission}`}
          tone={permission === "granted" ? "success" : permission === "denied" ? "danger" : "neutral"}
        />
        <StatusBadge label={isActive ? "Stream attached" : "Stream idle"} tone={isActive ? "success" : "warning"} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" onClick={onStartCamera} disabled={isStarting || isActive} style={BUTTON_STYLE}>
          {isStarting ? "Starting…" : "Start camera"}
        </button>
        <button
          type="button"
          onClick={onStopCamera}
          disabled={!isActive}
          style={{ ...BUTTON_STYLE, backgroundColor: "#111827", color: "#ffffff", borderColor: "#111827" }}
        >
          Stop camera
        </button>
      </div>
    </div>
  );
}
