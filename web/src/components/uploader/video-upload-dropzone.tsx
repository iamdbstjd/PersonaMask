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
  helperText = "MP4, QuickTime, WebM을 지원합니다. 업로드하면 백그라운드 프라이버시 배치 작업이 생성됩니다.",
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
    <div className="stack-sm">
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
        className={["dropzone", dragActive ? "dropzone--active" : null].filter(Boolean).join(" ")}
        style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.72 : 1 }}
      >
        <input
          id={inputId}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={disabled}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <div className="cluster-between">
          <div className="stack-xs">
            <span className="dropzone__icon" aria-hidden="true">업로드</span>
            <p style={{ margin: 0, color: "#0f172a", fontWeight: 800, fontSize: "1.02rem" }}>
              소스 영상을 드롭하거나 로컬 파일을 선택하세요
            </p>
            <p className="field-note" style={{ margin: 0 }}>{helperText}</p>
          </div>
          <StatusBadge label={dragActive ? "지금 놓기" : "준비됨"} tone={dragActive ? "warning" : "success"} />
        </div>

        <div className="dropzone__file">
          {file ? (
            <>
              <strong style={{ color: "#0f172a" }}>{file.name}</strong>
              <span className="text-muted" style={{ fontSize: "0.92rem" }}>{formatFileSize(file.size)}</span>
            </>
          ) : (
            <>
              <strong style={{ color: "#0f172a" }}>선택된 파일 없음</strong>
              <span className="text-muted" style={{ fontSize: "0.92rem" }}>
                업로드 상태와 작업 폴링은 분리되어 있어 제출 후에도 다른 화면으로 이동할 수 있습니다.
              </span>
            </>
          )}
        </div>
      </label>

      {errorMessage ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem", lineHeight: 1.6 }}>{errorMessage}</p>
      ) : null}
    </div>
  );
}
