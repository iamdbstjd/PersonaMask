"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { StatusBadge } from "../../components/common/status-badge";
import type { VideoJobResult, VideoJobUiStatus } from "../../services/video-api";

type VideoResultCardProps = {
  status: VideoJobUiStatus;
  result: VideoJobResult | null;
  accessToken: string | null;
};

function formatMetric(value: number | null | undefined, fallback = "대기 중"): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value}` : fallback;
}

function artifactFilename(url: string): string {
  return url.split("/").pop() || "personamask-artifact";
}

async function downloadProtectedArtifact(url: string, accessToken: string): Promise<void> {
  const response = await fetch(url, { headers: { "X-Access-Token": accessToken } });
  if (!response.ok) {
    throw new Error(`artifact download failed: ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = artifactFilename(url);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function ProtectedContactSheet({ url, accessToken }: { url: string; accessToken: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;

    async function loadPreview() {
      const response = await fetch(url, { headers: { "X-Access-Token": accessToken } });
      if (!response.ok) {
        return;
      }
      currentObjectUrl = URL.createObjectURL(await response.blob());
      if (active) {
        setObjectUrl(currentObjectUrl);
      } else {
        URL.revokeObjectURL(currentObjectUrl);
      }
    }

    void loadPreview();
    return () => {
      active = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [accessToken, url]);

  if (!objectUrl) {
    return <div className="preview-placeholder">전후 비교 시트를 불러오는 중입니다.</div>;
  }

  return (
    <button className="contact-sheet-preview" type="button" onClick={() => void downloadProtectedArtifact(url, accessToken)}>
      <Image src={objectUrl} alt="리댁션 전후 비교 시트" width={860} height={520} unoptimized />
    </button>
  );
}

function ArtifactButton({
  label,
  primary = false,
  ready,
  url,
  accessToken,
}: {
  label: string;
  primary?: boolean;
  ready: boolean;
  url?: string | null;
  accessToken: string | null;
}) {
  return (
    <button
      className={`artifact-link${primary ? " artifact-link--primary" : ""}`}
      disabled={!ready || !url || !accessToken}
      onClick={() => {
        if (url && accessToken) {
          void downloadProtectedArtifact(url, accessToken);
        }
      }}
      type="button"
    >
      {label}
    </button>
  );
}

export function VideoResultCard({ status, result, accessToken }: VideoResultCardProps) {
  const ready = Boolean(result) && status === "completed";
  const totals = result?.qa_summary?.detection_totals ?? {};

  if (!ready) {
    return (
      <section className="result-compact">
        <div className="cluster-between">
          <div className="stack-xs">
            <p className="eyebrow">결과 산출물</p>
            <h3 className="surface-heading">대기 중</h3>
          </div>
          <StatusBadge label="완료 후 표시" tone="neutral" />
        </div>
        <div className="result-compact__empty">렌더 완료 후 영상, 비교 시트, QA 리포트가 표시됩니다.</div>
      </section>
    );
  }

  return (
    <section className="stack-md">
      <div className="cluster-between">
        <div className="stack-xs">
          <p className="eyebrow">결과 산출물</p>
          <h3 className="surface-heading">출력 전달</h3>
        </div>
        <StatusBadge label={ready ? "다운로드 준비됨" : "완료 대기 중"} tone={ready ? "success" : "neutral"} />
      </div>

      {result?.contact_sheet_url && accessToken ? (
        <ProtectedContactSheet accessToken={accessToken} url={result.contact_sheet_url} />
      ) : (
        <div className="preview-placeholder" style={{ minHeight: "220px" }}>
          배치 작업이 완료되면 전후 비교 시트가 여기에 표시됩니다.
        </div>
      )}

      <div className="qa-report-grid">
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">처리 프레임</p>
          <p className="field-tile__value">{formatMetric(result?.qa_summary?.processed_frames)}</p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">검출 얼굴</p>
          <p className="field-tile__value">{formatMetric(totals.faces_total)}</p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">리댁션 얼굴</p>
          <p className="field-tile__value">{formatMetric(totals.faces_redacted)}</p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">번호판 / 텍스트</p>
          <p className="field-tile__value">
            {formatMetric(totals.plates_redacted, "0")} / {formatMetric(totals.text_regions_redacted, "0")}
          </p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">블러 감소율</p>
          <p className="field-tile__value">
            {typeof result?.qa_summary?.average_blur_reduction_pct === "number"
              ? `${result.qa_summary.average_blur_reduction_pct}%`
              : "없음"}
          </p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">누락 의심 프레임</p>
          <p className="field-tile__value">{formatMetric(result?.qa_summary?.suspect_frame_count, "0")}</p>
        </div>
      </div>

      <div className="stack-sm">
        <div className="artifact-strip">
          <ArtifactButton accessToken={accessToken} label="결과 영상" primary ready={ready} url={result?.download_url} />
          <ArtifactButton accessToken={accessToken} label="qa-report.json" ready={ready} url={result?.qa_report_json_url} />
          <ArtifactButton accessToken={accessToken} label="qa-report.md" ready={ready} url={result?.qa_report_markdown_url} />
        </div>
        <div className="field-tile">
          <p className="field-tile__label">다운로드 URL</p>
          {result ? (
            <a href={result.download_url} className="link-inline">
              {result.download_url}
            </a>
          ) : (
            <p style={{ margin: "0.35rem 0 0", color: "#0f172a" }}>결과 URL 대기 중</p>
          )}
        </div>
        <div className="field-tile">
          <p className="field-tile__label">썸네일 URL</p>
          <p style={{ margin: "0.35rem 0 0", color: "#0f172a" }}>{result?.preview_thumbnail_url ?? "썸네일 대기 중"}</p>
        </div>
        <div className="field-tile">
          <p className="field-tile__label">QA 리포트 URL</p>
          <p style={{ margin: "0.35rem 0 0", color: "#0f172a", wordBreak: "break-all" }}>
            {result?.qa_report_json_url ?? "JSON 대기 중"} · {result?.qa_report_markdown_url ?? "Markdown 대기 중"}
          </p>
        </div>
        <div className="field-tile">
          <p className="field-tile__label">만료 시각</p>
          <p style={{ margin: "0.35rem 0 0", color: "#0f172a" }}>{result?.expires_at ?? "아직 제공되지 않음"}</p>
        </div>
      </div>
    </section>
  );
}
