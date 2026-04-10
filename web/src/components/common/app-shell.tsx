import type { ReactNode } from "react";
import Link from "next/link";

import { DiagnosticsRail, type DiagnosticItem } from "../diagnostics/diagnostics-rail";
import { StatusBadge } from "./status-badge";

const NAV_ITEMS = [
  { href: "/", label: "Overview", routeKey: "overview" },
  { href: "/character", label: "Character", routeKey: "character" },
  { href: "/privacy", label: "Privacy", routeKey: "privacy" },
  { href: "/video", label: "Video", routeKey: "video" },
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
};

export function AppShell({
  currentRoute,
  title,
  description,
  children,
  diagnosticsItems,
  activePreset = "None selected",
  lastError = "No recent runtime errors.",
}: AppShellProps) {
  const currentNav = NAV_ITEMS.find((item) => item.routeKey === currentRoute);
  const latencyLabel = diagnosticsItems.find((item) => item.label === "Latency")?.value ?? "—";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f8fafc 52%, #ffffff 100%)",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "1.5rem",
          display: "grid",
          gap: "1.5rem",
        }}
      >
        <header
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "24px",
            backgroundColor: "rgba(255, 255, 255, 0.88)",
            backdropFilter: "blur(12px)",
            padding: "1.25rem",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <p style={{ margin: "0 0 0.4rem", color: "#6b7280", fontSize: "0.85rem" }}>Realtime Operator Console</p>
              <h1 style={{ margin: 0, fontSize: "1.85rem" }}>{title}</h1>
              <p style={{ margin: "0.6rem 0 0", maxWidth: "60ch", color: "#4b5563", lineHeight: 1.6 }}>{description}</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", alignContent: "flex-start" }}>
              <StatusBadge label={`Route · ${currentNav?.label ?? currentRoute}`} tone="neutral" />
              <StatusBadge label="API connected" tone="success" />
              <StatusBadge label={`Latency · ${latencyLabel}`} tone="warning" />
            </div>
          </div>

          <nav
            aria-label="Primary"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.routeKey === currentRoute;
              return (
                <Link
                  key={item.routeKey}
                  href={item.href}
                  style={{
                    borderRadius: "999px",
                    padding: "0.65rem 0.95rem",
                    textDecoration: "none",
                    fontWeight: 600,
                    border: `1px solid ${isActive ? "#111827" : "#d1d5db"}`,
                    backgroundColor: isActive ? "#111827" : "#ffffff",
                    color: isActive ? "#ffffff" : "#111827",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "1.5rem",
              alignItems: "start",
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            <main style={{ minWidth: 0 }}>{children}</main>
            <aside style={{ minWidth: 0 }}>
              <DiagnosticsRail
                items={diagnosticsItems}
                activeMode={currentNav?.label ?? currentRoute}
                activePreset={activePreset}
                lastError={lastError}
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
