"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { DiagnosticsRail, type DiagnosticItem } from "../diagnostics/diagnostics-rail";

const NAV_ITEMS = [
  { href: "/", label: "개요", routeKey: "overview" },
  { href: "/character", label: "캐릭터", routeKey: "character" },
  { href: "/privacy", label: "프라이버시", routeKey: "privacy" },
  { href: "/video", label: "영상 리뷰", routeKey: "video" },
  { href: "/settings", label: "설정", routeKey: "settings" },
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
  compactIntro?: boolean;
  showDiagnostics?: boolean;
};

export function AppShell({
  currentRoute,
  title,
  description,
  children,
  diagnosticsItems,
  activePreset = "선택된 프리셋 없음",
  lastError = "최근 런타임 오류가 없습니다.",
  sideContent,
  compactIntro = false,
  showDiagnostics = true,
}: AppShellProps) {
  const currentNav = NAV_ITEMS.find((item) => item.routeKey === currentRoute);
  const introClassName = ["page-intro", compactIntro ? "page-intro--compact" : null].filter(Boolean).join(" ");
  const shellClassName = ["page-shell", `page-shell--${currentRoute}`].join(" ");

  return (
    <div className={shellClassName}>
      <header className="shell-topbar">
        <div className="shell-topbar__inner">
          <Link href="/" className="brand-pill">
            PERSONAMASK
          </Link>
          <nav className="top-nav" aria-label="주요 화면">
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
          <div className="top-actions" aria-label="보조 작업">
            <button type="button" className="top-action" aria-label="테마">
              <span className="top-action__icon top-action__icon--moon" aria-hidden="true" />
            </button>
            <button type="button" className="top-action" aria-label="알림">
              <span className="top-action__icon top-action__icon--bell" aria-hidden="true" />
            </button>
            <button type="button" className="top-action" aria-label="도움말">
              <span className="top-action__icon top-action__icon--help" aria-hidden="true">
                ?
              </span>
            </button>
            <span className="avatar-chip" aria-label="PersonaMask 운영자">
              <span aria-hidden="true">PM</span>
            </span>
          </div>
        </div>
      </header>

      <div className="page-shell__inner">
        <section className={introClassName}>
          <div className="page-intro__copy">
            <p className="eyebrow">실시간 미디어 작업 흐름</p>
            <h1>{title}</h1>
            <p className="hero-card__description">{description}</p>
            {compactIntro ? (
              <div className="page-intro__chips" aria-label="현재 작업 정보">
                <span>{currentNav?.label ?? currentRoute}</span>
                <span>{activePreset}</span>
              </div>
            ) : null}
          </div>

          {compactIntro ? null : (
            <div className="hero-card__meta">
              <div className="field-tile">
                <p className="field-tile__label">현재 모드</p>
                <p className="field-tile__value">{currentNav?.label ?? currentRoute}</p>
              </div>
              <div className="field-tile">
                <p className="field-tile__label">활성 프리셋</p>
                <p className="field-tile__value">{activePreset}</p>
              </div>
            </div>
          )}
        </section>

        <div className="content-layout">
          <main>{children}</main>
          <aside className="content-aside sticky-card">
            {sideContent}
            {showDiagnostics ? (
              <DiagnosticsRail
                items={diagnosticsItems}
                activeMode={currentNav?.label ?? currentRoute}
                activePreset={activePreset}
                lastError={lastError}
              />
            ) : null}
          </aside>
        </div>
      </div>

      <footer className="app-footer">
        <span>© 2024 PersonaMask 콘솔 · 보안 등급 영상 처리 인터페이스</span>
        <a href="/privacy">Privacy Policy</a>
        <a href="/settings">Terms of Service</a>
      </footer>
    </div>
  );
}
