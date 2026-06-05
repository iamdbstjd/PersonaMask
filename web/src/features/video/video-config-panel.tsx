"use client";

import { Button } from "../../components/common/button";
import { ToggleCard } from "../../components/common/toggle-card";
import { DEFAULT_VIDEO_JOB_CONFIG, type PrivacyOptions, type VideoJobConfig, type VideoJobProcessingMode } from "../../services/video-api";

type VideoConfigPanelProps = {
  config: VideoJobConfig;
  disabled?: boolean;
  onModeChange: (mode: VideoJobProcessingMode) => void;
  onPrivacyOptionChange: (option: keyof PrivacyOptions, value: boolean) => void;
  onKeepAudioChange: (value: boolean) => void;
  onResetDefaults: () => void;
};

export function VideoConfigPanel({
  config,
  disabled = false,
  onModeChange,
  onPrivacyOptionChange,
  onKeepAudioChange,
  onResetDefaults,
}: VideoConfigPanelProps) {
  return (
    <section className="stack-md">
      <div className="segmented-control" role="group" aria-label="Video processing mode">
        {[
          { mode: "preserve" as const, label: "Preserve allowed" },
          { mode: "character" as const, label: "Character replace" },
          { mode: "blur" as const, label: "Blur all" },
        ].map((item) => (
          <button
            key={item.mode}
            type="button"
            className={["segmented-control__button", config.mode === item.mode ? "segmented-control__button--active" : null]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled}
            onClick={() => onModeChange(item.mode)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stack-sm">
        <ToggleCard
          label="Blur faces"
          description="Default-on redaction for detected faces in every processed frame."
          checked={config.privacy_options.blur_faces}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_faces", checked)}
        />
        <ToggleCard
          label="Blur license plates"
          description="Keep plate protection aligned with the privacy mode contract."
          checked={config.privacy_options.blur_plates}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_plates", checked)}
        />
        <ToggleCard
          label="Blur text"
          description="Redact visible text overlays and signage during batch processing."
          checked={config.privacy_options.blur_text}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_text", checked)}
        />
        <ToggleCard
          label="Allowlist aware"
          description="Respect allowlisted identities when the backend policy supports it."
          checked={config.privacy_options.allowlist_enabled}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("allowlist_enabled", checked)}
        />
      </div>

      <div className="summary-grid">
        <div className="field-tile">
          <p className="field-tile__label">Container</p>
          <p className="field-tile__value">{config.output_options.container}</p>
        </div>
        <div className="field-tile">
          <p className="field-tile__label">Codec</p>
          <p className="field-tile__value">{config.output_options.video_codec}</p>
        </div>
      </div>

      <ToggleCard
        label="Audio passthrough"
        description="Current OpenCV renderer outputs a video-only MP4; audio passthrough is reserved for the FFmpeg lane."
        checked={false}
        disabled
        onChange={onKeepAudioChange}
      />

      <Button onClick={onResetDefaults} disabled={disabled} variant="ghost" size="sm">
        Reset to defaults ({DEFAULT_VIDEO_JOB_CONFIG.output_options.container}/{DEFAULT_VIDEO_JOB_CONFIG.output_options.video_codec})
      </Button>
    </section>
  );
}
