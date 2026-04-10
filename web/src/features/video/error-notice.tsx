"use client";

import { StatusBadge } from "../../components/common/status-badge";

type ErrorNoticeProps = {
  message: string | null;
};

export function ErrorNotice({ message }: ErrorNoticeProps) {
  if (!message) {
    return null;
  }

  return (
    <section
      style={{
        borderRadius: "18px",
        border: "1px solid #fecaca",
        backgroundColor: "#fef2f2",
        padding: "1rem",
        display: "grid",
        gap: "0.6rem",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem" }}>
        <strong style={{ color: "#991b1b" }}>Recent batch failure</strong>
        <StatusBadge label="Retry guidance visible" tone="danger" />
      </div>
      <p style={{ margin: 0, color: "#7f1d1d", lineHeight: 1.6 }}>{message}</p>
    </section>
  );
}
