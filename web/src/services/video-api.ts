import { API_BASE_PATH } from "./api-client";

export const VIDEO_JOB_BASE_PATH = `${API_BASE_PATH}/videos/jobs`;
export const VIDEO_CANDIDATE_BASE_PATH = `${API_BASE_PATH}/videos/candidates`;

export type VideoJobUiStatus =
  | "idle"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type VideoJobServerStatus = Exclude<VideoJobUiStatus, "idle" | "uploading">;
export type VideoJobProcessingMode = "video_privacy" | "blur" | "preserve" | "character";
export type CandidateAction = "preserve" | "character" | "blur" | "track";

export type PrivacyOptions = {
  blur_faces: boolean;
  blur_plates: boolean;
  blur_text: boolean;
};

export type OutputOptions = {
  container: "mp4";
  video_codec: "mp4v";
  keep_audio: boolean;
};

export type VideoJobConfig = {
  mode: VideoJobProcessingMode;
  character_id?: string | null;
  analysis_id?: string | null;
  candidate_access_token?: string | null;
  candidate_actions?: Record<string, CandidateAction>;
  privacy_options: PrivacyOptions;
  output_options: OutputOptions;
};

export type VideoJobProgress = {
  percent: number;
  processed_frames: number;
  total_frames: number;
  eta_sec: number;
};

export type VideoJobResult = {
  download_url: string;
  preview_thumbnail_url: string | null;
  contact_sheet_url?: string | null;
  qa_report_json_url?: string | null;
  qa_report_markdown_url?: string | null;
  qa_summary?: {
    processed_frames?: number;
    detection_totals?: Record<string, number>;
    average_blur_reduction_pct?: number | null;
    suspect_frame_count?: number;
    character_style?: {
      enabled?: boolean;
      preset_id?: string | null;
      model?: string | null;
      generated_count?: number;
      warnings?: string[];
    };
  } | null;
  expires_at: string | null;
};

export type VideoJobCreateData = {
  job_id: string;
  status: "queued";
  access_token: string;
  status_endpoint: string;
  cancel_endpoint: string;
};

export type VideoJobStatusData = {
  job_id: string;
  status: VideoJobServerStatus;
  progress: VideoJobProgress;
  result: VideoJobResult | null;
};

export type VideoJobCancelData = {
  job_id: string;
  status: "cancelled";
};

export type VideoJobCreateResponse = {
  request_id: string;
  data: VideoJobCreateData;
  error: null;
};

export type VideoJobStatusResponse = {
  request_id: string;
  data: VideoJobStatusData;
  error: null;
};

export type VideoJobCancelResponse = {
  request_id: string;
  data: VideoJobCancelData;
  error: null;
};

export type VideoFaceCandidate = {
  candidate_id: string;
  image_url: string;
  frame_index: number;
  bbox: [number, number, number, number];
  confidence: number;
};

export type VideoCandidateAnalysisData = {
  analysis_id: string;
  access_token: string;
  source_filename: string;
  candidates: VideoFaceCandidate[];
};

export type VideoCandidateAnalysisResponse = {
  request_id: string;
  data: VideoCandidateAnalysisData;
  error: null;
};

export type FetchLike = typeof fetch;

export const DEFAULT_VIDEO_JOB_CONFIG: VideoJobConfig = {
  mode: "blur",
  character_id: "anime_portrait",
  analysis_id: null,
  candidate_access_token: null,
  candidate_actions: {},
  privacy_options: {
    blur_faces: true,
    blur_plates: false,
    blur_text: false,
  },
  output_options: {
    container: "mp4",
    video_codec: "mp4v",
    keep_audio: false,
  },
};

const DEFAULT_PROGRESS: VideoJobProgress = {
  percent: 0,
  processed_frames: 0,
  total_frames: 0,
  eta_sec: 0,
};

export class VideoApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "VideoApiError";
    this.status = status;
    this.details = details;
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit, fetchImpl: FetchLike): Promise<T> {
  const response = await fetchImpl(input, init);
  const body = await readResponseBody(response);

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? "영상 API 요청이 실패했습니다."
        : `영상 API 요청이 실패했습니다. 상태 코드: ${response.status}`;

    throw new VideoApiError(message, response.status, body);
  }

  return body as T;
}

export function buildVideoJobFormData(file: File, config: VideoJobConfig): FormData {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("config", JSON.stringify(config));
  return formData;
}

export function createEmptyProgress(): VideoJobProgress {
  return { ...DEFAULT_PROGRESS };
}

export function isTerminalVideoJobStatus(status: VideoJobUiStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function getVideoJobStatusUrl(jobId: string): string {
  return `${VIDEO_JOB_BASE_PATH}/${encodeURIComponent(jobId)}`;
}

export function getVideoJobCancelUrl(jobId: string): string {
  return `${VIDEO_JOB_BASE_PATH}/${encodeURIComponent(jobId)}/cancel`;
}

export function getVideoJobResultUrl(jobId: string): string {
  return `${VIDEO_JOB_BASE_PATH}/${encodeURIComponent(jobId)}/result`;
}

function accessHeaders(accessToken: string): HeadersInit {
  return { "X-Access-Token": accessToken };
}

export async function analyzeVideoCandidates(file: File, fetchImpl: FetchLike = fetch): Promise<VideoCandidateAnalysisData> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await requestJson<VideoCandidateAnalysisResponse>(
    VIDEO_CANDIDATE_BASE_PATH,
    {
      method: "POST",
      body: formData,
    },
    fetchImpl,
  );

  return response.data;
}

export async function createVideoJob(
  file: File,
  config: VideoJobConfig,
  fetchImpl: FetchLike = fetch,
): Promise<VideoJobCreateData> {
  const response = await requestJson<VideoJobCreateResponse>(
    VIDEO_JOB_BASE_PATH,
    {
      method: "POST",
      body: buildVideoJobFormData(file, config),
    },
    fetchImpl,
  );

  return response.data;
}

export async function getVideoJobStatus(
  jobId: string,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<VideoJobStatusData> {
  const response = await requestJson<VideoJobStatusResponse>(
    getVideoJobStatusUrl(jobId),
    { method: "GET", headers: accessHeaders(accessToken) },
    fetchImpl,
  );

  return response.data;
}

export async function cancelVideoJob(jobId: string, accessToken: string, fetchImpl: FetchLike = fetch): Promise<VideoJobCancelData> {
  const response = await requestJson<VideoJobCancelResponse>(
    getVideoJobCancelUrl(jobId),
    { method: "POST", headers: accessHeaders(accessToken) },
    fetchImpl,
  );

  return response.data;
}
