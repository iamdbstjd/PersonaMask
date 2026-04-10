"use client";

import type { PrivacyOptions } from "../../services/realtime-api";
import { PanelCard } from "../../components/common/panel-card";
import { StatusBadge } from "../../components/common/status-badge";

type PrivacyOptionsFormProps = {
  value: PrivacyOptions;
  disabled?: boolean;
  onChange: (nextValue: PrivacyOptions) => void;
};

const FIELD_LABELS: Array<{ key: keyof PrivacyOptions; label: string; description: string }> = [
  { key: "blurFaces", label: "Blur faces", description: "등록되지 않은 얼굴은 보수적으로 blur 처리합니다." },
  { key: "blurPlates", label: "Blur plates", description: "번호판 검출이 있으면 즉시 redaction 대상으로 포함합니다." },
  { key: "blurText", label: "Blur text", description: "문서/텍스트 영역이 감지되면 가독성을 제거합니다." },
  { key: "allowlistEnabled", label: "Allowlist enabled", description: "허용 얼굴 예외 규칙을 사용할지 표시합니다." },
];

export function PrivacyOptionsForm({ value, disabled = false, onChange }: PrivacyOptionsFormProps) {
  return (
    <PanelCard
      kicker="PrivacyOptionsForm"
      title="Privacy policy controls"
      description="실시간 privacy 세션 생성 전에 redaction 기본 정책을 정리합니다."
    >
      <div style={{ display: "grid", gap: "0.85rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <StatusBadge label={value.allowlistEnabled ? "Allowlist aware" : "Allowlist off"} tone={value.allowlistEnabled ? "success" : "warning"} />
          <StatusBadge label={value.blurFaces ? "Face blur on" : "Face blur off"} tone={value.blurFaces ? "success" : "danger"} />
        </div>

        {FIELD_LABELS.map((field) => (
          <label
            key={field.key}
            style={{
              display: "grid",
              gap: "0.25rem",
              borderRadius: "14px",
              border: "1px solid #e5e7eb",
              padding: "0.85rem 0.95rem",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>{field.label}</span>
              <input
                type="checkbox"
                checked={value[field.key]}
                disabled={disabled}
                onChange={(event) => onChange({ ...value, [field.key]: event.target.checked })}
              />
            </span>
            <span style={{ color: "#4b5563", lineHeight: 1.6 }}>{field.description}</span>
          </label>
        ))}
      </div>
    </PanelCard>
  );
}
