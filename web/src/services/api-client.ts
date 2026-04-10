import { API_BASE_PATH } from "../lib/runtime-config";

export { API_BASE_PATH };

export type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: unknown;
  [key: string]: unknown;
};

export type ApiEnvelope<T> = {
  request_id: string;
  data: T;
  error: ApiErrorPayload | null;
};

export type ApiHeaders = {
  requestId: string | null;
  traceLatencyMs: number | null;
  contentType: string | null;
};

export type ApiResult<T> = {
  data: T;
  requestId: string;
  headers: ApiHeaders;
  status: number;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly details: ApiErrorPayload | string | null;

  constructor(message: string, options: { status: number; requestId?: string | null; details?: ApiErrorPayload | string | null }) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.requestId = options.requestId ?? null;
    this.details = options.details ?? null;
  }
}

type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | null;
  headers?: HeadersInit;
};

function normalizeApiPath(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith(API_BASE_PATH)) {
    return path;
  }

  if ((API_BASE_PATH.startsWith("http://") || API_BASE_PATH.startsWith("https://")) && path.startsWith("/api/v1")) {
    const origin = API_BASE_PATH.endsWith("/api/v1") ? API_BASE_PATH.slice(0, -"/api/v1".length) : API_BASE_PATH;
    return `${origin}${path}`;
  }

  return `${API_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

function readHeaders(response: Response): ApiHeaders {
  const requestId = response.headers.get("X-Request-Id");
  const traceLatencyValue = response.headers.get("X-Trace-Latency-Ms");

  return {
    requestId,
    traceLatencyMs: traceLatencyValue ? Number.parseInt(traceLatencyValue, 10) || null : null,
    contentType: response.headers.get("content-type"),
  };
}

async function buildError(response: Response): Promise<ApiClientError> {
  const headers = readHeaders(response);
  const contentType = headers.contentType ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | ApiErrorPayload | null;

    if (payload && typeof payload === "object" && "error" in payload) {
      const envelope = payload as ApiEnvelope<unknown>;
      const message = envelope.error?.message ?? `API request failed with status ${response.status}.`;
      return new ApiClientError(message, {
        status: response.status,
        requestId: envelope.request_id ?? headers.requestId,
        details: envelope.error,
      });
    }

    return new ApiClientError(`API request failed with status ${response.status}.`, {
      status: response.status,
      requestId: headers.requestId,
      details: payload,
    });
  }

  const text = await response.text().catch(() => "");
  return new ApiClientError(text || `API request failed with status ${response.status}.`, {
    status: response.status,
    requestId: headers.requestId,
    details: text || null,
  });
}

export async function requestApiEnvelope<T>(path: string, init: ApiRequestInit = {}): Promise<ApiResult<T>> {
  const response = await fetch(normalizeApiPath(path), init);

  if (!response.ok) {
    throw await buildError(response);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (payload.error) {
    throw new ApiClientError(payload.error.message ?? "API returned an error payload.", {
      status: response.status,
      requestId: payload.request_id,
      details: payload.error,
    });
  }

  return {
    data: payload.data,
    requestId: payload.request_id,
    headers: readHeaders(response),
    status: response.status,
  };
}

export async function requestApiResponse(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const response = await fetch(normalizeApiPath(path), init);

  if (!response.ok) {
    throw await buildError(response);
  }

  return response;
}

export function buildJsonRequest(body: unknown, init: ApiRequestInit = {}): ApiRequestInit {
  return {
    ...init,
    body: JSON.stringify(body),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  };
}

export function buildMultipartRequest(formData: FormData, init: ApiRequestInit = {}): ApiRequestInit {
  return {
    ...init,
    body: formData,
    headers: {
      Accept: "application/json, image/jpeg",
      ...init.headers,
    },
  };
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function getErrorMessage(error: unknown, fallback = "Unexpected error") {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function getRequestIdFromHeaders(response: Response) {
  return response.headers.get("X-Request-Id");
}

export function getTraceLatencyFromHeaders(response: Response) {
  const latencyHeader = response.headers.get("X-Trace-Latency-Ms");
  return latencyHeader ? Number.parseInt(latencyHeader, 10) || null : null;
}
