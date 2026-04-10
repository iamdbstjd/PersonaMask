"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_VIDEO_JOB_CONFIG,
  VideoApiError,
  type FetchLike,
  type PrivacyOptions,
  type VideoJobConfig,
  type VideoJobCreateData,
  type VideoJobProgress,
  type VideoJobResult,
  type VideoJobServerStatus,
  type VideoJobUiStatus,
  cancelVideoJob,
  createEmptyProgress,
  createVideoJob,
  getVideoJobStatus,
  isTerminalVideoJobStatus,
} from "../services/video-api";

export type VideoJobSnapshot = {
  jobId: string;
  status: VideoJobServerStatus;
  progress: VideoJobProgress;
  result: VideoJobResult | null;
  statusEndpoint: string;
  cancelEndpoint: string;
};

export type UseVideoJobOptions = {
  fetchImpl?: FetchLike;
  pollIntervalMs?: number;
  initialConfig?: VideoJobConfig;
};

export type UseVideoJobResult = {
  config: VideoJobConfig;
  selectedFile: File | null;
  dragActive: boolean;
  status: VideoJobUiStatus;
  job: VideoJobSnapshot | null;
  lastError: string | null;
  canSubmit: boolean;
  canCancel: boolean;
  selectFile: (file: File | null) => void;
  setDragActive: (active: boolean) => void;
  updatePrivacyOption: (option: keyof PrivacyOptions, value: boolean) => void;
  updateKeepAudio: (value: boolean) => void;
  resetConfig: () => void;
  submit: () => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
};

function createQueuedSnapshot(data: VideoJobCreateData): VideoJobSnapshot {
  return {
    jobId: data.job_id,
    status: data.status,
    progress: createEmptyProgress(),
    result: null,
    statusEndpoint: data.status_endpoint,
    cancelEndpoint: data.cancel_endpoint,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof VideoApiError) {
    return `${error.message} (HTTP ${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected video job error.";
}

export function useVideoJob({
  fetchImpl = fetch,
  pollIntervalMs = 3000,
  initialConfig = DEFAULT_VIDEO_JOB_CONFIG,
}: UseVideoJobOptions = {}): UseVideoJobResult {
  const [config, setConfig] = useState<VideoJobConfig>(initialConfig);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<VideoJobUiStatus>("idle");
  const [job, setJob] = useState<VideoJobSnapshot | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!job?.jobId) {
      return;
    }

    try {
      const next = await getVideoJobStatus(job.jobId, fetchImpl);
      setJob((previous) => {
        if (!previous || previous.jobId !== next.job_id) {
          return {
            jobId: next.job_id,
            status: next.status,
            progress: next.progress,
            result: next.result,
            statusEndpoint: `/api/v1/videos/jobs/${next.job_id}`,
            cancelEndpoint: `/api/v1/videos/jobs/${next.job_id}/cancel`,
          };
        }

        return {
          ...previous,
          status: next.status,
          progress: next.progress,
          result: next.result,
        };
      });
      setStatus(next.status);
      setLastError(null);
    } catch (error) {
      setLastError(toErrorMessage(error));
    }
  }, [fetchImpl, job?.jobId]);

  useEffect(() => {
    if (!job?.jobId || (status !== "queued" && status !== "processing")) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [job?.jobId, pollIntervalMs, refresh, status]);

  const selectFile = useCallback((file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setJob(null);
      setLastError(null);
      setStatus("idle");
    }
  }, []);

  const updatePrivacyOption = useCallback((option: keyof PrivacyOptions, value: boolean) => {
    setConfig((previous) => ({
      ...previous,
      privacy_options: {
        ...previous.privacy_options,
        [option]: value,
      },
    }));
  }, []);

  const updateKeepAudio = useCallback((value: boolean) => {
    setConfig((previous) => ({
      ...previous,
      output_options: {
        ...previous.output_options,
        keep_audio: value,
      },
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const submit = useCallback(async () => {
    if (!selectedFile) {
      setLastError("Choose a video file before submitting the privacy batch job.");
      return;
    }

    setStatus("uploading");
    setLastError(null);

    try {
      const created = await createVideoJob(selectedFile, config, fetchImpl);
      const queued = createQueuedSnapshot(created);
      setJob(queued);
      setStatus(queued.status);
    } catch (error) {
      setStatus("failed");
      setLastError(toErrorMessage(error));
    }
  }, [config, fetchImpl, selectedFile]);

  const cancel = useCallback(async () => {
    if (!job?.jobId || !job.cancelEndpoint || isTerminalVideoJobStatus(status)) {
      return;
    }

    try {
      await cancelVideoJob(job.jobId, fetchImpl);
      setJob((previous) =>
        previous
          ? {
              ...previous,
              status: "cancelled",
            }
          : previous,
      );
      setStatus("cancelled");
      setLastError(null);
    } catch (error) {
      setLastError(toErrorMessage(error));
    }
  }, [fetchImpl, job, status]);

  const reset = useCallback(() => {
    setSelectedFile(null);
    setDragActive(false);
    setStatus("idle");
    setJob(null);
    setLastError(null);
    setConfig(initialConfig);
  }, [initialConfig]);

  const canSubmit = useMemo(() => {
    return Boolean(selectedFile) && status !== "uploading" && status !== "processing" && status !== "queued";
  }, [selectedFile, status]);

  const canCancel = useMemo(() => {
    return Boolean(job?.jobId) && (status === "queued" || status === "processing");
  }, [job?.jobId, status]);

  return {
    config,
    selectedFile,
    dragActive,
    status,
    job,
    lastError,
    canSubmit,
    canCancel,
    selectFile,
    setDragActive,
    updatePrivacyOption,
    updateKeepAudio,
    resetConfig,
    submit,
    cancel,
    reset,
    refresh,
  };
}
