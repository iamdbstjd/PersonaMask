import { PanelCard } from "../common/panel-card";

type PreviewFrameProps = {
  title: string;
  kicker: string;
  description: string;
  imageSrc: string | null;
  emptyLabel: string;
};

export function PreviewFrame({ title, kicker, description, imageSrc, emptyLabel }: PreviewFrameProps) {
  return (
    <PanelCard kicker={kicker} title={title} description={description}>
      <div
        style={{
          minHeight: "240px",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid #dbeafe",
          background: imageSrc ? "#eff6ff" : "#f8fafc",
          display: "grid",
          placeItems: "center",
        }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <span style={{ color: "#64748b", padding: "1rem", textAlign: "center", lineHeight: 1.6 }}>{emptyLabel}</span>
        )}
      </div>
    </PanelCard>
  );
}
