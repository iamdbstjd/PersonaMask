import Link from "next/link";

import { StatusBadge } from "./status-badge";

type ModeCardProps = {
  href: string;
  title: string;
  summary: string;
  status: string;
  highlights: readonly string[];
};

export function ModeCard({ href, title, summary, status, highlights }: ModeCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        height: "100%",
      }}
    >
      <article
        style={{
          height: "100%",
          border: "1px solid #e5e7eb",
          borderRadius: "20px",
          backgroundColor: "#ffffff",
          padding: "1.25rem",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.9rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#111827" }}>{title}</h2>
          <StatusBadge label={status} tone="neutral" />
        </div>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>{summary}</p>
        <ul style={{ margin: "1rem 0 0", paddingLeft: "1.1rem", color: "#374151", lineHeight: 1.7 }}>
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </article>
    </Link>
  );
}
