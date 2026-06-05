"use client";

import Image from "next/image";

import { StatusBadge } from "../../components/common/status-badge";
import type { VideoJobResult, VideoJobUiStatus } from "../../services/video-api";

type VideoResultCardProps = {
  status: VideoJobUiStatus;
  result: VideoJobResult | null;
};

function formatMetric(value: number | null | undefined, fallback = "Pending"): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value}` : fallback;
}

export function VideoResultCard({ status, result }: VideoResultCardProps) {
  const ready = Boolean(result) && status === "completed";
  const totals = result?.qa_summary?.detection_totals ?? {};

  return (
    <section className="stack-md">
      <div className="cluster-between">
        <div className="stack-xs">
          <p className="eyebrow">Result artifact</p>
          <h3 className="surface-heading">Output delivery</h3>
        </div>
        <StatusBadge label={ready ? "Download ready" : "Awaiting completion"} tone={ready ? "success" : "neutral"} />
      </div>

      {ready && result?.contact_sheet_url ? (
        <a href={result.contact_sheet_url} className="contact-sheet-preview" target="_blank" rel="noreferrer">
          <Image src={result.contact_sheet_url} alt="Before and after redaction contact sheet" width={860} height={520} unoptimized />
        </a>
      ) : (
        <div className="preview-placeholder" style={{ minHeight: "220px" }}>
          Contact sheet appears here after the batch job completes.
        </div>
      )}

      <div className="qa-report-grid">
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">Frames processed</p>
          <p className="field-tile__value">{formatMetric(result?.qa_summary?.processed_frames)}</p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">Faces detected</p>
          <p className="field-tile__value">{formatMetric(totals.faces_total)}</p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">Faces redacted</p>
          <p className="field-tile__value">{formatMetric(totals.faces_redacted)}</p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">Plates / text</p>
          <p className="field-tile__value">
            {formatMetric(totals.plates_redacted, "0")} / {formatMetric(totals.text_regions_redacted, "0")}
          </p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">Blur reduction</p>
          <p className="field-tile__value">
            {typeof result?.qa_summary?.average_blur_reduction_pct === "number"
              ? `${result.qa_summary.average_blur_reduction_pct}%`
              : "N/A"}
          </p>
        </div>
        <div className="field-tile field-tile--metric">
          <p className="field-tile__label">Suspect frames</p>
          <p className="field-tile__value">{formatMetric(result?.qa_summary?.suspect_frame_count, "0")}</p>
        </div>
      </div>

      <div className="stack-sm">
        <div className="artifact-strip">
          <a className="artifact-link artifact-link--primary" href={result?.download_url ?? "#"} aria-disabled={!ready}>
            Result video
          </a>
          <a className="artifact-link" href={result?.qa_report_json_url ?? "#"} download aria-disabled={!ready || !result?.qa_report_json_url}>
            qa-report.json
          </a>
          <a
            className="artifact-link"
            href={result?.qa_report_markdown_url ?? "#"}
            download
            aria-disabled={!ready || !result?.qa_report_markdown_url}
          >
            qa-report.md
          </a>
        </div>
        <div className="field-tile">
          <p className="field-tile__label">Download URL</p>
          {result ? (
            <a href={result.download_url} className="link-inline">
              {result.download_url}
            </a>
          ) : (
            <p style={{ margin: "0.35rem 0 0", color: "#0f172a" }}>Result URL pending</p>
          )}
        </div>
        <div className="field-tile">
          <p className="field-tile__label">Thumbnail URL</p>
          <p style={{ margin: "0.35rem 0 0", color: "#0f172a" }}>{result?.preview_thumbnail_url ?? "Thumbnail pending"}</p>
        </div>
        <div className="field-tile">
          <p className="field-tile__label">QA report URLs</p>
          <p style={{ margin: "0.35rem 0 0", color: "#0f172a", wordBreak: "break-all" }}>
            {result?.qa_report_json_url ?? "JSON pending"} · {result?.qa_report_markdown_url ?? "Markdown pending"}
          </p>
        </div>
        <div className="field-tile">
          <p className="field-tile__label">Expires at</p>
          <p style={{ margin: "0.35rem 0 0", color: "#0f172a" }}>{result?.expires_at ?? "Not available yet"}</p>
        </div>
      </div>
    </section>
  );
}
