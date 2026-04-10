"use client";

import type { ReactNode } from "react";

type PanelCardProps = {
  title: string;
  description?: string;
  kicker?: string;
  children?: ReactNode;
};

export function PanelCard({ title, description, kicker, children }: PanelCardProps) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "18px",
        backgroundColor: "#ffffff",
        padding: "1.25rem",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <header style={{ marginBottom: children ? "1rem" : 0 }}>
        {kicker ? (
          <p
            style={{
              margin: "0 0 0.4rem",
              color: "#4b5563",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </p>
        ) : null}
        <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#111827" }}>{title}</h2>
        {description ? (
          <p style={{ margin: "0.5rem 0 0", color: "#4b5563", lineHeight: 1.6 }}>{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
