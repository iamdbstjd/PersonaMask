"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_VIDEO_JOB_CONFIG,
  VideoApiError,
  analyzeVideoCandidates,
  type CandidateAction,
  type FetchLike,
  type PrivacyOptions,
  type VideoCandidateAnalysisData,
  type VideoJobConfig,
  type VideoJobCreateData,
  type VideoJobProcessingMode,
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
  accessToken: string;
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
  candidateAnalysis: VideoCandidateAnalysisData | null;
  candidateActions: Record<string, CandidateAction>;
  lastError: string | null;
  isAnalyzingCandidates: boolean;
  canSubmit: boolean;
  canAnalyzeCandidates: boolean;
  canCancel: boolean;
  selectFile: (file: File | null) => void;
  setDragActive: (active: boolean) => void;
  analyzeCandidates: () => Promise<void>;
  updateCandidateAction: (candidateId: string, action: CandidateAction) => void;
  updatePrivacyOption: (option: keyof PrivacyOptions, value: boolean) => void;
  updateCharacterPreset: (presetId: string) => void;
  updateMode: (mode: VideoJobProcessingMode) => void;
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
    accessToken: data.access_token,
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

  return "예상하지 못한 영상 작업 오류가 발생했습니다.";
}

function deriveModeFromActions(actions: Record<string, CandidateAction>, fallback: VideoJobProcessingMode): VideoJobProcessingMode {
  const values = Object.values(actions);
  if (values.includes("character")) {
    return "character";
  }
  if (values.includes("preserve") || values.includes("track")) {
    return "preserve";
  }
  if (values.length > 0) {
    return "blur";
  }
  return fallback;
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
  const [candidateAnalysis, setCandidateAnalysis] = useState<VideoCandidateAnalysisData | null>(null);
  const [candidateActions, setCandidateActions] = useState<Record<string, CandidateAction>>({});
  const [isAnalyzingCandidates, setIsAnalyzingCandidates] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!job?.jobId) {
      return;
    }

    try {
      const next = await getVideoJobStatus(job.jobId, job.accessToken, fetchImpl);
      setJob((previous) => {
        if (!previous || previous.jobId !== next.job_id) {
          return {
            jobId: next.job_id,
            accessToken: previous?.accessToken ?? job.accessToken,
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
  }, [fetchImpl, job?.accessToken, job?.jobId]);

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
      setCandidateAnalysis(null);
      setCandidateActions({});
      setLastError(null);
      setStatus("idle");
      setConfig((previous) => ({
        ...previous,
        analysis_id: null,
        candidate_access_token: null,
        candidate_actions: {},
      }));
    }
  }, []);

  const analyzeCandidates = useCallback(async () => {
    if (!selectedFile) {
      setLastError("후보 분석을 실행하기 전에 영상 파일을 선택하세요.");
      return;
    }

    setIsAnalyzingCandidates(true);
    setLastError(null);
    try {
      const analysis = await analyzeVideoCandidates(selectedFile, fetchImpl);
      const defaultActions: Record<string, CandidateAction> = Object.fromEntries(
        analysis.candidates.map((candidate) => [candidate.candidate_id, "blur" as CandidateAction]),
      );
      setCandidateAnalysis(analysis);
      setCandidateActions(defaultActions);
      setConfig((previous) => ({
        ...previous,
        analysis_id: analysis.analysis_id,
        candidate_access_token: analysis.access_token,
        candidate_actions: defaultActions,
        mode: deriveModeFromActions(defaultActions, previous.mode),
      }));
    } catch (error) {
      setLastError(toErrorMessage(error));
    } finally {
      setIsAnalyzingCandidates(false);
    }
  }, [fetchImpl, selectedFile]);

  const updateCandidateAction = useCallback((candidateId: string, action: CandidateAction) => {
    setCandidateActions((previous) => {
      const next = { ...previous, [candidateId]: action };
      setConfig((current) => ({
        ...current,
        candidate_actions: next,
        mode: deriveModeFromActions(next, current.mode),
      }));
      return next;
    });
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

  const updateCharacterPreset = useCallback((presetId: string) => {
    setConfig((previous) => ({
      ...previous,
      character_id: presetId,
    }));
  }, []);

  const updateMode = useCallback((mode: VideoJobProcessingMode) => {
    setConfig((previous) => ({
      ...previous,
      mode,
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
    setConfig({
      ...initialConfig,
      analysis_id: candidateAnalysis?.analysis_id ?? null,
      candidate_access_token: candidateAnalysis?.access_token ?? null,
      candidate_actions: candidateActions,
      mode: deriveModeFromActions(candidateActions, initialConfig.mode),
      privacy_options: initialConfig.privacy_options,
    });
  }, [candidateActions, candidateAnalysis?.access_token, candidateAnalysis?.analysis_id, initialConfig]);

  const submit = useCallback(async () => {
    if (!selectedFile) {
      setLastError("프라이버시 배치 작업을 제출하기 전에 영상 파일을 선택하세요.");
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
      await cancelVideoJob(job.jobId, job.accessToken, fetchImpl);
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
    setCandidateAnalysis(null);
    setCandidateActions({});
    setIsAnalyzingCandidates(false);
    setLastError(null);
    setConfig(initialConfig);
  }, [initialConfig]);

  const canAnalyzeCandidates = useMemo(() => {
    return Boolean(selectedFile) && !isAnalyzingCandidates && status !== "uploading" && status !== "processing" && status !== "queued";
  }, [isAnalyzingCandidates, selectedFile, status]);

  const canSubmit = useMemo(() => {
    return Boolean(selectedFile) && candidateAnalysis !== null && status !== "uploading" && status !== "processing" && status !== "queued";
  }, [candidateAnalysis, selectedFile, status]);

  const canCancel = useMemo(() => {
    return Boolean(job?.jobId) && (status === "queued" || status === "processing");
  }, [job?.jobId, status]);

  return {
    config,
    selectedFile,
    dragActive,
    status,
    job,
    candidateAnalysis,
    candidateActions,
    lastError,
    isAnalyzingCandidates,
    canSubmit,
    canAnalyzeCandidates,
    canCancel,
    selectFile,
    setDragActive,
    analyzeCandidates,
    updateCandidateAction,
    updatePrivacyOption,
    updateCharacterPreset,
    updateMode,
    updateKeepAudio,
    resetConfig,
    submit,
    cancel,
    reset,
    refresh,
  };
}
