import { StatusBadge } from "../../components/common/status-badge";
import type { VideoJobResult, VideoJobUiStatus } from "../../services/video-api";

type VideoResultCardProps = {
  status: VideoJobUiStatus;
  result: VideoJobResult | null;
};

export function VideoResultCard({ status, result }: VideoResultCardProps) {
  const ready = Boolean(result) && status === "completed";

  return (
    <section style={{ display: "grid", gap: "0.9rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            VideoResultCard
          </p>
          <h3 style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", color: "#111827" }}>Result artifact</h3>
        </div>
        <StatusBadge label={ready ? "Download ready" : "Awaiting completion"} tone={ready ? "success" : "neutral"} />
      </div>

      <div
        style={{
          borderRadius: "16px",
          border: "1px dashed #cbd5e1",
          minHeight: "220px",
          display: "grid",
          placeItems: "center",
          color: "#64748b",
          backgroundColor: "#f8fafc",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        {ready ? "Thumbnail preview available" : "Preview thumbnail appears here after the batch job completes."}
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>Download URL</p>
          {result ? (
            <a href={result.download_url} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
              {result.download_url}
            </a>
          ) : (
            <p style={{ margin: "0.35rem 0 0", color: "#111827" }}>Result URL pending</p>
          )}
        </div>
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>Thumbnail URL</p>
          <p style={{ margin: "0.35rem 0 0", color: "#111827" }}>{result?.preview_thumbnail_url ?? "Thumbnail pending"}</p>
        </div>
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>Expires at</p>
          <p style={{ margin: "0.35rem 0 0", color: "#111827" }}>{result?.expires_at ?? "Not available yet"}</p>
        </div>
      </div>
    </section>
  );
}
