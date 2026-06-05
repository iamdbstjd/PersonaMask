"use client";

import type { PrivacyOptions } from "../../services/realtime-api";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";
import { ToggleCard } from "../../components/common/toggle-card";

type PrivacyOptionsFormProps = {
  value: PrivacyOptions;
  disabled?: boolean;
  onChange: (nextValue: PrivacyOptions) => void;
};

const FIELD_LABELS: Array<{ key: keyof PrivacyOptions; label: string; description: string }> = [
  { key: "blurFaces", label: "얼굴 블러", description: "등록되지 않은 얼굴은 보수적으로 블러 처리합니다." },
  { key: "blurPlates", label: "번호판 블러", description: "번호판 검출이 있으면 즉시 리댁션 대상으로 포함합니다." },
  { key: "blurText", label: "텍스트 블러", description: "문서/텍스트 영역이 감지되면 가독성을 제거합니다." },
  { key: "allowlistEnabled", label: "허용 목록 사용", description: "허용 얼굴 예외 규칙을 사용할지 표시합니다." },
];

export function PrivacyOptionsForm({ value, disabled = false, onChange }: PrivacyOptionsFormProps) {
  return (
    <PanelCard
      kicker="정책 제어"
      title="프라이버시 정책"
      description="실시간 프라이버시 세션 생성 전에 리댁션 기본 정책을 간단하고 명확하게 조정할 수 있습니다."
    >
      <div className="stack-md">
        <div className="cluster">
          <StatusBadge label={value.allowlistEnabled ? "허용 목록 반영" : "허용 목록 꺼짐"} tone={value.allowlistEnabled ? "success" : "warning"} />
          <StatusBadge label={value.blurFaces ? "얼굴 블러 켜짐" : "얼굴 블러 꺼짐"} tone={value.blurFaces ? "success" : "danger"} />
        </div>

        <div className="stack-sm">
          {FIELD_LABELS.map((field) => (
            <ToggleCard
              key={field.key}
              label={field.label}
              description={field.description}
              checked={value[field.key]}
              disabled={disabled}
              onChange={(checked) => onChange({ ...value, [field.key]: checked })}
            />
          ))}
        </div>
      </div>
    </PanelCard>
  );
}
