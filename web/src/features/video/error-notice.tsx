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
    <section className="notice notice--danger">
      <div className="cluster-between">
        <strong style={{ color: "#991b1b" }}>Recent batch failure</strong>
        <StatusBadge label="Retry guidance visible" tone="danger" />
      </div>
      <p style={{ margin: "0.65rem 0 0", color: "#7f1d1d", lineHeight: 1.7 }}>{message}</p>
    </section>
  );
}
