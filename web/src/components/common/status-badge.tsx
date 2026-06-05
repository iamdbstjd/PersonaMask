"use client";

const TONES = {
  neutral: "status-badge--neutral",
  success: "status-badge--success",
  warning: "status-badge--warning",
  danger: "status-badge--danger",
} as const;

type StatusTone = keyof typeof TONES;

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={["status-badge", TONES[tone]].join(" ")}>
      <span className="status-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
