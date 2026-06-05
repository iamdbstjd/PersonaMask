"use client";

import Image from "next/image";

import { StatusBadge } from "../../components/common/status-badge";
import type { VideoJobResult, VideoJobUiStatus } from "../../services/video-api";

type VideoResultCardProps = {
  status: VideoJobUiStatus;
  result: VideoJobResult | null;
};

function formatMetric(value: number | null | undefined, fallback = "대기 중"): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value}` : fallback;
}

export function VideoResultCard({ status, result }: VideoResultCardProps) {
  const ready = Boolean(result) && status === "completed";
  const totals = result?.qa_summary?.detection_totals ?? {};

  return (
    <section className="stack-md">
      <div className="cluster-between">
        <div className="stack-xs">
          <p className="eyebrow">결과 산출물</p>
          <h3 className="surface-heading">출력 전달</h3>
        </div>
        <StatusBadge label={ready ? "다운로드 준비됨" : "완료 대기 중"} tone={ready ? "success" : "neutral"} />
      </div>

      {ready && result?.contact_sheet_url ? (
        <a href={result.contact_sheet_url} className="contact-sheet-preview" target="_blank" rel="noreferrer">
          <Image src={result.contact_sheet_url} alt="리댁션 전후 비교 시트" width={860} height={520} unoptimized />
        </a>
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
          <a className="artifact-link artifact-link--primary" href={result?.download_url ?? "#"} aria-disabled={!ready}>
            결과 영상
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
