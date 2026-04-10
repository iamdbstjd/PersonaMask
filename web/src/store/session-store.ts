import { useSyncExternalStore } from "react";

import type { DetectionCounts, RealtimeMode, RealtimeSession, StreamProfile } from "../services/realtime-api";

export type RealtimeUiState = "idle" | "camera_loading" | "session_starting" | "streaming" | "degraded" | "error";
export type CameraPermissionState = "idle" | "requesting" | "granted" | "denied";

export type SessionStoreState = {
  status: RealtimeUiState;
  mode: RealtimeMode;
  sessionId: string | null;
  acceptedProfile: StreamProfile | null;
  requestId: string | null;
  lastFrameId: number | null;
  lastServerLatencyMs: number | null;
  lastDetectionCounts: DetectionCounts | null;
  lastError: string | null;
  isCameraReady: boolean;
  cameraPermission: CameraPermissionState;
  originalFrameSrc: string | null;
  processedFrameSrc: string | null;
  processedFrameIsObjectUrl: boolean;
  isUploading: boolean;
};

const INITIAL_STATE: SessionStoreState = {
  status: "idle",
  mode: "privacy",
  sessionId: null,
  acceptedProfile: null,
  requestId: null,
  lastFrameId: null,
  lastServerLatencyMs: null,
  lastDetectionCounts: null,
  lastError: null,
  isCameraReady: false,
  cameraPermission: "idle",
  originalFrameSrc: null,
  processedFrameSrc: null,
  processedFrameIsObjectUrl: false,
  isUploading: false,
};

let state: SessionStoreState = INITIAL_STATE;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function revokeIfNeeded(frameSrc: string | null, isObjectUrl: boolean) {
  if (frameSrc && isObjectUrl && typeof URL !== "undefined") {
    URL.revokeObjectURL(frameSrc);
  }
}

function setState(nextState: SessionStoreState) {
  if (nextState.processedFrameSrc !== state.processedFrameSrc || nextState.processedFrameIsObjectUrl !== state.processedFrameIsObjectUrl) {
    revokeIfNeeded(state.processedFrameSrc, state.processedFrameIsObjectUrl);
  }

  state = nextState;
  emit();
}

function patchState(patch: Partial<SessionStoreState>) {
  setState({ ...state, ...patch });
}

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState() {
    return state;
  },
  reset() {
    setState({ ...INITIAL_STATE, isCameraReady: state.isCameraReady, cameraPermission: state.cameraPermission });
  },
  setCameraLoading() {
    patchState({ status: "camera_loading", cameraPermission: "requesting", lastError: null });
  },
  setCameraReady(isCameraReady: boolean) {
    patchState({ isCameraReady, cameraPermission: isCameraReady ? "granted" : state.cameraPermission });
  },
  setCameraDenied(message = "카메라 권한이 거부되었습니다.") {
    patchState({ cameraPermission: "denied", isCameraReady: false, status: "error", lastError: message });
  },
  setMode(mode: RealtimeMode) {
    patchState({ mode });
  },
  setSessionStarting(mode: RealtimeMode) {
    patchState({ mode, status: "session_starting", lastError: null });
  },
  setStreamingSession(session: RealtimeSession) {
    patchState({
      mode: session.mode,
      status: "streaming",
      sessionId: session.sessionId,
      acceptedProfile: session.acceptedProfile,
      requestId: session.requestId,
      lastError: null,
    });
  },
  setUploading(isUploading: boolean) {
    patchState({ isUploading });
  },
  setOriginalFrame(originalFrameSrc: string | null) {
    patchState({ originalFrameSrc });
  },
  setFrameResult(input: {
    frameId: number;
    requestId: string | null;
    processedFrameSrc: string;
    processedFrameIsObjectUrl: boolean;
    serverLatencyMs: number | null;
    detections: DetectionCounts;
  }) {
    patchState({
      status: "streaming",
      lastFrameId: input.frameId,
      requestId: input.requestId,
      processedFrameSrc: input.processedFrameSrc,
      processedFrameIsObjectUrl: input.processedFrameIsObjectUrl,
      lastServerLatencyMs: input.serverLatencyMs,
      lastDetectionCounts: input.detections,
      lastError: null,
    });
  },
  setDegraded(message: string) {
    patchState({ status: "degraded", lastError: message, isUploading: false });
  },
  setError(message: string) {
    patchState({ status: "error", lastError: message, isUploading: false });
  },
};

export function useSessionStore<T>(selector: (state: SessionStoreState) => T) {
  return useSyncExternalStore(sessionStore.subscribe, () => selector(sessionStore.getState()), () => selector(INITIAL_STATE));
}
