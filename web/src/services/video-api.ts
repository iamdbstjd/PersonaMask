export const VIDEO_JOB_BASE_PATH = "/api/v1/videos/jobs";

export type VideoJobUiStatus =
  | "idle"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type VideoJobServerStatus = Exclude<VideoJobUiStatus, "idle" | "uploading">;

export type PrivacyOptions = {
  blur_faces: boolean;
  blur_plates: boolean;
  blur_text: boolean;
  allowlist_enabled: boolean;
};

export type OutputOptions = {
  container: "mp4";
  video_codec: "h264";
  keep_audio: boolean;
};

export type VideoJobConfig = {
  mode: "video_privacy";
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
  preview_thumbnail_url: string;
  expires_at: string;
};

export type VideoJobCreateData = {
  job_id: string;
  status: "queued";
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

export type FetchLike = typeof fetch;

export const DEFAULT_VIDEO_JOB_CONFIG: VideoJobConfig = {
  mode: "video_privacy",
  privacy_options: {
    blur_faces: true,
    blur_plates: true,
    blur_text: true,
    allowlist_enabled: true,
  },
  output_options: {
    container: "mp4",
    video_codec: "h264",
    keep_audio: true,
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
        ? "Video API request failed"
        : `Video API request failed with status ${response.status}`;

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
  return `${getVideoJobStatusUrl(jobId)}/cancel`;
}

export function getVideoJobResultUrl(jobId: string): string {
  return `${getVideoJobStatusUrl(jobId)}/result`;
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

export async function getVideoJobStatus(jobId: string, fetchImpl: FetchLike = fetch): Promise<VideoJobStatusData> {
  const response = await requestJson<VideoJobStatusResponse>(
    getVideoJobStatusUrl(jobId),
    { method: "GET" },
    fetchImpl,
  );

  return response.data;
}

export async function cancelVideoJob(jobId: string, fetchImpl: FetchLike = fetch): Promise<VideoJobCancelData> {
  const response = await requestJson<VideoJobCancelResponse>(
    getVideoJobCancelUrl(jobId),
    { method: "POST" },
    fetchImpl,
  );

  return response.data;
}
