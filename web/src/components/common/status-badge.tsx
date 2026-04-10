const TONES = {
  neutral: {
    backgroundColor: "#f3f4f6",
    color: "#111827",
    borderColor: "#e5e7eb",
  },
  success: {
    backgroundColor: "#ecfdf5",
    color: "#065f46",
    borderColor: "#a7f3d0",
  },
  warning: {
    backgroundColor: "#fffbeb",
    color: "#92400e",
    borderColor: "#fcd34d",
  },
  danger: {
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },
} as const;

type StatusTone = keyof typeof TONES;

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        borderRadius: "999px",
        border: "1px solid",
        fontSize: "0.8125rem",
        fontWeight: 600,
        lineHeight: 1,
        padding: "0.45rem 0.75rem",
        ...TONES[tone],
      }}
    >
      {label}
    </span>
  );
}
