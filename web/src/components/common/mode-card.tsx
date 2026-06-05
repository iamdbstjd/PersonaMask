"use client";

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
    <Link href={href} className="mode-card">
      <article className="mode-card__surface">
        <div className="cluster-between">
          <h2 style={{ margin: 0, fontSize: "1.18rem", letterSpacing: "-0.03em" }}>{title}</h2>
          <StatusBadge label={status} tone="success" />
        </div>

        <p className="mode-card__summary">{summary}</p>
        <p className="mode-card__meta">{highlights.join(" · ")}</p>

        <div className="mode-card__footer">
          <span>Open workflow</span>
          <span aria-hidden="true">→</span>
        </div>
      </article>
    </Link>
  );
}
