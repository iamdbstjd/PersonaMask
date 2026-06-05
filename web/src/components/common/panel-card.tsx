"use client";

import type { ReactNode } from "react";

type PanelTone = "default" | "accent" | "contrast";

type PanelCardProps = {
  title: string;
  description?: string;
  kicker?: string;
  children?: ReactNode;
  tone?: PanelTone;
  className?: string;
};

export function PanelCard({
  title,
  description,
  kicker,
  children,
  tone = "default",
  className,
}: PanelCardProps) {
  const classes = [
    "panel-card",
    tone !== "default" ? `panel-card--${tone}` : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <header className="panel-card__header" style={{ marginBottom: children ? "1rem" : 0 }}>
        {kicker ? <p className="panel-card__kicker">{kicker}</p> : null}
        <h2 className="panel-card__title">{title}</h2>
        {description ? <p className="panel-card__description">{description}</p> : null}
      </header>
      {children ? <div className="panel-card__content">{children}</div> : null}
    </section>
  );
}
