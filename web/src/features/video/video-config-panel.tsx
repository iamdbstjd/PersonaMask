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
      <div className="segmented-control" role="group" aria-label="영상 처리 모드">
        {[
          { mode: "preserve" as const, label: "허용 얼굴 보존" },
          { mode: "character" as const, label: "캐릭터 대체" },
          { mode: "blur" as const, label: "전체 블러" },
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
          label="얼굴 블러"
          checked={config.privacy_options.blur_faces}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_faces", checked)}
        />
        <ToggleCard
          label="번호판 블러"
          checked={config.privacy_options.blur_plates}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_plates", checked)}
        />
        <ToggleCard
          label="텍스트 블러"
          checked={config.privacy_options.blur_text}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("blur_text", checked)}
        />
        <ToggleCard
          label="허용 목록 반영"
          checked={config.privacy_options.allowlist_enabled}
          disabled={disabled}
          onChange={(checked) => onPrivacyOptionChange("allowlist_enabled", checked)}
        />
      </div>

      <div className="summary-grid">
        <div className="field-tile">
          <p className="field-tile__label">컨테이너</p>
          <p className="field-tile__value">{config.output_options.container}</p>
        </div>
        <div className="field-tile">
          <p className="field-tile__label">코덱</p>
          <p className="field-tile__value">{config.output_options.video_codec}</p>
        </div>
      </div>

      <ToggleCard
        label="오디오 통과"
        checked={false}
        disabled
        onChange={onKeepAudioChange}
      />

      <Button onClick={onResetDefaults} disabled={disabled} variant="ghost" size="sm">
        기본값 복원 ({DEFAULT_VIDEO_JOB_CONFIG.output_options.container}/{DEFAULT_VIDEO_JOB_CONFIG.output_options.video_codec})
      </Button>
    </section>
  );
}
