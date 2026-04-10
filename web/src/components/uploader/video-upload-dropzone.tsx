"use client";

import { useId, type ChangeEvent, type DragEvent } from "react";

import { StatusBadge } from "../common/status-badge";

type VideoUploadDropzoneProps = {
  file: File | null;
  disabled?: boolean;
  dragActive?: boolean;
  helperText?: string;
  errorMessage?: string | null;
  onFileSelected: (file: File | null) => void;
  onDragActiveChange?: (active: boolean) => void;
};

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoUploadDropzone({
  file,
  disabled = false,
  dragActive = false,
  helperText = "MP4, QuickTime, or WebM. The upload creates a background privacy batch job.",
  errorMessage,
  onFileSelected,
  onDragActiveChange,
}: VideoUploadDropzoneProps) {
  const inputId = useId();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    onFileSelected(nextFile);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    onDragActiveChange?.(false);

    if (disabled) {
      return;
    }

    const nextFile = event.dataTransfer.files?.[0] ?? null;
    onFileSelected(nextFile);
  };

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            onDragActiveChange?.(true);
          }
        }}
        onDragLeave={() => onDragActiveChange?.(false)}
        onDrop={handleDrop}
        style={{
          display: "grid",
          gap: "0.85rem",
          borderRadius: "18px",
          border: `1px dashed ${dragActive ? "#2563eb" : "#cbd5e1"}`,
          backgroundColor: dragActive ? "#eff6ff" : "#f8fafc",
          padding: "1rem",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <input
          id={inputId}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={disabled}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem" }}>
          <div>
            <p style={{ margin: 0, color: "#111827", fontWeight: 700 }}>Drop a source video or browse local files</p>
            <p style={{ margin: "0.35rem 0 0", color: "#4b5563", lineHeight: 1.6 }}>{helperText}</p>
          </div>
          <StatusBadge label={dragActive ? "Drop now" : "Ready"} tone={dragActive ? "warning" : "success"} />
        </div>

        <div
          style={{
            borderRadius: "14px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            padding: "0.9rem",
            minHeight: "96px",
            display: "grid",
            alignContent: "center",
            gap: "0.4rem",
          }}
        >
          {file ? (
            <>
              <strong style={{ color: "#111827" }}>{file.name}</strong>
              <span style={{ color: "#4b5563", fontSize: "0.9rem" }}>{formatFileSize(file.size)}</span>
            </>
          ) : (
            <>
              <strong style={{ color: "#111827" }}>No file selected</strong>
              <span style={{ color: "#4b5563", fontSize: "0.9rem" }}>
                Upload state remains separate from job polling so operators can leave the page after submission.
              </span>
            </>
          )}
        </div>
      </label>

      {errorMessage ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem", lineHeight: 1.5 }}>{errorMessage}</p>
      ) : null}
    </div>
  );
}
