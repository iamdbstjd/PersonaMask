"use client";

import Image from "next/image";
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
    <PanelCard kicker={kicker} title={title} description={description} tone="accent">
      <div className="preview-frame">
        {imageSrc ? (
          <Image src={imageSrc} alt={title} fill unoptimized style={{ objectFit: "cover", display: "block" }} />
        ) : (
          <div className="preview-placeholder">
            <span>{emptyLabel}</span>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
