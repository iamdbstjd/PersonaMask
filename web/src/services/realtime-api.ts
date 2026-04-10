import {
  buildJsonRequest,
  buildMultipartRequest,
  getRequestIdFromHeaders,
  getTraceLatencyFromHeaders,
  requestApiEnvelope,
  requestApiResponse,
} from "./api-client";

export type RealtimeMode = "character" | "privacy";
export type ResponseMode = "binary_jpeg" | "json_base64";

export type StreamProfile = {
  targetFps: number;
  frameWidth: number;
  jpegQuality: number;
  responseMode: ResponseMode;
};

export type PrivacyOptions = {
  blurFaces: boolean;
  blurPlates: boolean;
  blurText: boolean;
  allowlistEnabled: boolean;
};

export type DetectionCounts = {
  facesTotal: number;
  facesRedacted: number;
  platesRedacted: number;
  textRegionsRedacted: number;
};

export type RealtimeSession = {
  requestId: string;
  sessionId: string;
  mode: RealtimeMode;
  acceptedProfile: StreamProfile;
  frameEndpoint: string;
  expiresInSec: number;
};

export type FrameUploadMeta = {
  frameId: number;
  timestampMs: number;
  clientWidth: number;
  clientHeight: number;
  rotationDeg: number;
  mode: RealtimeMode;
};

export type RealtimeFrameResult = {
  requestId: string | null;
  frameId: number;
  mimeType: string;
  processedImageSrc: string;
  processedImageIsObjectUrl: boolean;
  serverLatencyMs: number | null;
  detections: DetectionCounts;
  responseMode: ResponseMode;
};

type StreamProfileWire = {
  target_fps: number;
  frame_width: number;
  jpeg_quality: number;
  response_mode: ResponseMode;
};

type PrivacyOptionsWire = {
  blur_faces: boolean;
  blur_plates: boolean;
  blur_text: boolean;
  allowlist_enabled: boolean;
};

type RealtimeSessionWire = {
  session_id: string;
  mode: RealtimeMode;
  accepted_profile: StreamProfileWire;
  frame_endpoint: string;
  expires_in_sec: number;
};

type DetectionCountsWire = {
  faces_total: number;
  faces_redacted: number;
  plates_redacted: number;
  text_regions_redacted: number;
};

type RealtimeFrameJsonWire = {
  frame_id: number;
  mime_type: string;
  processed_image_base64: string;
  server_latency_ms: number;
  detections: DetectionCountsWire;
};

type FrameMetaWire = {
  frame_id?: number;
  server_latency_ms?: number;
  detections?: DetectionCountsWire;
};

function toStreamProfileWire(profile: StreamProfile): StreamProfileWire {
  return {
    target_fps: profile.targetFps,
    frame_width: profile.frameWidth,
    jpeg_quality: profile.jpegQuality,
    response_mode: profile.responseMode,
  };
}

function fromStreamProfileWire(profile: StreamProfileWire): StreamProfile {
  return {
    targetFps: profile.target_fps,
    frameWidth: profile.frame_width,
    jpegQuality: profile.jpeg_quality,
    responseMode: profile.response_mode,
  };
}

function toPrivacyOptionsWire(options: PrivacyOptions): PrivacyOptionsWire {
  return {
    blur_faces: options.blurFaces,
    blur_plates: options.blurPlates,
    blur_text: options.blurText,
    allowlist_enabled: options.allowlistEnabled,
  };
}

function fromDetectionCountsWire(detections?: DetectionCountsWire | null): DetectionCounts {
  return {
    facesTotal: detections?.faces_total ?? 0,
    facesRedacted: detections?.faces_redacted ?? 0,
    platesRedacted: detections?.plates_redacted ?? 0,
    textRegionsRedacted: detections?.text_regions_redacted ?? 0,
  };
}

function dataUrlFromBase64(mimeType: string, encoded: string) {
  if (encoded.startsWith("data:")) {
    return encoded;
  }

  return `data:${mimeType};base64,${encoded}`;
}

function parseFrameMeta(headerValue: string | null): FrameMetaWire | null {
  if (!headerValue) {
    return null;
  }

  try {
    return JSON.parse(headerValue) as FrameMetaWire;
  } catch {
    return null;
  }
}

export async function createRealtimeSession(input: {
  mode: RealtimeMode;
  presetId?: string;
  streamProfile: StreamProfile;
  privacyOptions: PrivacyOptions;
}): Promise<RealtimeSession> {
  const result = await requestApiEnvelope<RealtimeSessionWire>(
    "/realtime/sessions",
    buildJsonRequest({
      mode: input.mode,
      preset_id: input.presetId,
      stream_profile: toStreamProfileWire(input.streamProfile),
      privacy_options: toPrivacyOptionsWire(input.privacyOptions),
    }, {
      method: "POST",
    }),
  );

  return {
    requestId: result.requestId,
    sessionId: result.data.session_id,
    mode: result.data.mode,
    acceptedProfile: fromStreamProfileWire(result.data.accepted_profile),
    frameEndpoint: result.data.frame_endpoint,
    expiresInSec: result.data.expires_in_sec,
  };
}

export async function closeRealtimeSession(sessionId: string) {
  await requestApiEnvelope<{ closed: boolean }>(`/realtime/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
}

export async function processRealtimeFrame(input: {
  sessionId: string;
  frame: Blob;
  meta: FrameUploadMeta;
  signal?: AbortSignal;
}): Promise<RealtimeFrameResult> {
  const formData = new FormData();
  formData.append("frame", input.frame, `frame-${input.meta.frameId}.jpg`);
  formData.append(
    "meta",
    JSON.stringify({
      frame_id: input.meta.frameId,
      timestamp_ms: input.meta.timestampMs,
      client_width: input.meta.clientWidth,
      client_height: input.meta.clientHeight,
      rotation_deg: input.meta.rotationDeg,
      mode: input.meta.mode,
    }),
  );

  const response = await requestApiResponse(
    `/realtime/sessions/${input.sessionId}/frames`,
    buildMultipartRequest(formData, {
      method: "POST",
      headers: {
        "X-Session-Id": input.sessionId,
      },
      signal: input.signal,
    }),
  );

  const contentType = response.headers.get("content-type") ?? "";
  const requestId = getRequestIdFromHeaders(response);
  const traceLatencyMs = getTraceLatencyFromHeaders(response);

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      request_id: string;
      data: RealtimeFrameJsonWire;
      error: null;
    };

    return {
      requestId: payload.request_id,
      frameId: payload.data.frame_id,
      mimeType: payload.data.mime_type,
      processedImageSrc: dataUrlFromBase64(payload.data.mime_type, payload.data.processed_image_base64),
      processedImageIsObjectUrl: false,
      serverLatencyMs: payload.data.server_latency_ms,
      detections: fromDetectionCountsWire(payload.data.detections),
      responseMode: "json_base64",
    };
  }

  const blob = await response.blob();
  const frameMeta = parseFrameMeta(response.headers.get("X-Frame-Meta"));

  return {
    requestId,
    frameId: frameMeta?.frame_id ?? input.meta.frameId,
    mimeType: blob.type || "image/jpeg",
    processedImageSrc: URL.createObjectURL(blob),
    processedImageIsObjectUrl: true,
    serverLatencyMs: frameMeta?.server_latency_ms ?? traceLatencyMs,
    detections: fromDetectionCountsWire(frameMeta?.detections),
    responseMode: "binary_jpeg",
  };
}
