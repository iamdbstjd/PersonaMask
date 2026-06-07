"use client";

import type { PrivacyOptions } from "../../services/realtime-api";
import { PanelCard } from "../../components/common/panel-card";
import { ToggleCard } from "../../components/common/toggle-card";

type PrivacyOptionsFormProps = {
  value: PrivacyOptions;
  disabled?: boolean;
  onChange: (nextValue: PrivacyOptions) => void;
};

const FIELD_LABELS: Array<{ key: keyof PrivacyOptions; label: string; description: string }> = [
  { key: "blurFaces", label: "얼굴", description: "미등록 얼굴 보호" },
  { key: "blurPlates", label: "번호판", description: "차량 번호 보호" },
  { key: "blurText", label: "텍스트", description: "문자 영역 보호" },
  { key: "allowlistEnabled", label: "허용 목록", description: "등록 인물 보존" },
];

export function PrivacyOptionsForm({ value, disabled = false, onChange }: PrivacyOptionsFormProps) {
  return (
    <PanelCard
      className="privacy-policy-panel"
      kicker="정책"
      title="보호 규칙"
      description="세션에 적용할 항목만 켜두세요."
    >
      <div className="privacy-policy-list">
        {FIELD_LABELS.map((field) => (
          <ToggleCard
            key={field.key}
            className="privacy-toggle"
            label={field.label}
            description={field.description}
            checked={value[field.key]}
            disabled={disabled}
            onChange={(checked) => onChange({ ...value, [field.key]: checked })}
          />
        ))}
      </div>
    </PanelCard>
  );
}
