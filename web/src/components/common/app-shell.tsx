"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { DiagnosticsRail, type DiagnosticItem } from "../diagnostics/diagnostics-rail";

const NAV_ITEMS = [
  { href: "/", label: "Overview", routeKey: "overview" },
  { href: "/character", label: "Character", routeKey: "character" },
  { href: "/privacy", label: "Privacy", routeKey: "privacy" },
  { href: "/video", label: "Video Review", routeKey: "video" },
  { href: "/settings", label: "Settings", routeKey: "settings" },
] as const;

export type AppRouteKey = (typeof NAV_ITEMS)[number]["routeKey"];

type AppShellProps = {
  currentRoute: AppRouteKey;
  title: string;
  description: string;
  children: ReactNode;
  diagnosticsItems: readonly DiagnosticItem[];
  activePreset?: string;
  lastError?: string;
  sideContent?: ReactNode;
};

export function AppShell({
  currentRoute,
  title,
  description,
  children,
  diagnosticsItems,
  activePreset = "None selected",
  lastError = "No recent runtime errors.",
  sideContent,
}: AppShellProps) {
  const currentNav = NAV_ITEMS.find((item) => item.routeKey === currentRoute);

  return (
    <div className="page-shell">
      <header className="shell-topbar">
        <div className="shell-topbar__inner">
          <Link href="/" className="brand-pill">
            PersonaMask Console
          </Link>
          <nav className="top-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const isActive = item.routeKey === currentRoute;
              return (
                <Link
                  key={item.routeKey}
                  href={item.href}
                  className={["top-nav__link", isActive ? "top-nav__link--active" : null].filter(Boolean).join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="top-actions" aria-label="Utility actions">
            <button type="button" className="top-action" aria-label="Notifications">
              <span className="top-action__icon top-action__icon--bell" aria-hidden="true" />
            </button>
            <button type="button" className="top-action" aria-label="Help">
              <span className="top-action__icon top-action__icon--help" aria-hidden="true">
                ?
              </span>
            </button>
            <span className="avatar-chip" aria-label="PersonaMask operator">
              <span aria-hidden="true">PM</span>
            </span>
          </div>
        </div>
      </header>

      <div className="page-shell__inner">
        <section className="page-intro">
          <div className="page-intro__copy">
            <p className="eyebrow">Realtime media workflow</p>
            <h1>{title}</h1>
            <p className="hero-card__description">{description}</p>

            <nav className="nav-pills" aria-label="Section navigation">
              {NAV_ITEMS.map((item) => {
                const isActive = item.routeKey === currentRoute;
                return (
                  <Link
                    key={item.routeKey}
                    href={item.href}
                    className={["nav-pill", isActive ? "nav-pill--active" : null].filter(Boolean).join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hero-card__meta">
            <div className="field-tile">
              <p className="field-tile__label">Current mode</p>
              <p className="field-tile__value">{currentNav?.label ?? currentRoute}</p>
            </div>
            <div className="field-tile">
              <p className="field-tile__label">Active preset</p>
              <p className="field-tile__value">{activePreset}</p>
            </div>
          </div>
        </section>

        <div className="content-layout">
          <main>{children}</main>
          <aside className="content-aside sticky-card">
            {sideContent}
            <DiagnosticsRail
              items={diagnosticsItems}
              activeMode={currentNav?.label ?? currentRoute}
              activePreset={activePreset}
              lastError={lastError}
            />
          </aside>
        </div>
      </div>

      <footer className="app-footer">
        © 2024 PersonaMask Console · Security-grade Video Processing Interface
      </footer>
    </div>
  );
}
