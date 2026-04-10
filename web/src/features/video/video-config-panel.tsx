"use client";

import { StatusBadge } from "../../components/common/status-badge";
import { DEFAULT_VIDEO_JOB_CONFIG, type PrivacyOptions, type VideoJobConfig } from "../../services/video-api";

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleRow({ label, description, checked, disabled = false, onChange }: ToggleRowProps) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: "0.75rem",
        alignItems: "start",
        padding: "0.8rem",
        borderRadius: "14px",
        border: "1px solid #e5e7eb",
        backgroundColor: checked ? "#f8fafc" : "#ffffff",
      }}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong style={{ color: "#111827" }}>{label}</strong>
        <span style={{ display: "block", marginTop: "0.3rem", color: "#4b5563", lineHeight: 1.5 }}>{description}</span>
      </span>
    </label>
  );
}

type VideoConfigPanelProps = {
  config: VideoJobConfig;
  disabled?: boolean;
  onPrivacyOptionChange: (option: keyof PrivacyOptions, value: boolean) => void;
  onKeepAudioChange: (value: boolean) => void;
  onResetDefaults: () => void;
};

export function VideoConfigPanel({
  config,
  disabled = false,
  onPrivacyOptionChange,
  onKeepAudioChange,
  onResetDefaults,
}: VideoConfigPanelProps) {
  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            VideoConfigPanel
          </p>
          <h3 style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", color: "#111827" }}>Privacy batch configuration</h3>
        </div>
        <StatusBadge label={`Mode · ${config.mode}`} tone="neutral" />
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        <ToggleRow
          label="Blur faces"
          description="Default-on redaction for detected faces in every processed frame."
          checked={config.privacy_options.blur_faces}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_faces", checked)}
        />
        <ToggleRow
          label="Blur license plates"
          description="Keep plate protection aligned with the privacy mode contract."
          checked={config.privacy_options.blur_plates}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_plates", checked)}
        />
        <ToggleRow
          label="Blur text"
          description="Redact visible text overlays and signage during batch processing."
          checked={config.privacy_options.blur_text}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_text", checked)}
        />
        <ToggleRow
          label="Allowlist aware"
          description="Respect allowlisted identities when the backend policy supports it."
          checked={config.privacy_options.allowlist_enabled}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("allowlist_enabled", checked)}
        />
      </div>

      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div style={{ borderRadius: "14px", border: "1px solid #e5e7eb", padding: "0.85rem", backgroundColor: "#ffffff" }}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>Container</p>
          <p style={{ margin: "0.3rem 0 0", color: "#111827", fontWeight: 700 }}>{config.output_options.container}</p>
        </div>
        <div style={{ borderRadius: "14px", border: "1px solid #e5e7eb", padding: "0.85rem", backgroundColor: "#ffffff" }}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>Codec</p>
          <p style={{ margin: "0.3rem 0 0", color: "#111827", fontWeight: 700 }}>{config.output_options.video_codec}</p>
        </div>
        <ToggleRow
          label="Keep audio"
          description="Preserve the original audio track in the rendered artifact."
          checked={config.output_options.keep_audio}
          disabled={disabled}
          onChange={onKeepAudioChange}
        />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onResetDefaults}
        style={{
          width: "fit-content",
          borderRadius: "999px",
          border: "1px solid #d1d5db",
          backgroundColor: "#ffffff",
          color: "#111827",
          fontWeight: 600,
          padding: "0.65rem 0.95rem",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        Reset to defaults ({DEFAULT_VIDEO_JOB_CONFIG.output_options.container}/{DEFAULT_VIDEO_JOB_CONFIG.output_options.video_codec})
      </button>
    </section>
  );
}
