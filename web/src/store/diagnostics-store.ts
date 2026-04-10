import { useSyncExternalStore } from "react";

import type { RuntimeDiagnosticsSnapshot } from "../services/diagnostics-api";
import type { DetectionCounts, RealtimeMode } from "../services/realtime-api";

export type DiagnosticsTone = "neutral" | "success" | "warning" | "danger";

export type DiagnosticsItem = {
  label: string;
  value: string;
  tone?: DiagnosticsTone;
};

export type DiagnosticsStoreState = {
  apiStatus: string;
  gpuStatus: string;
  runtimeStatus: string;
  queueDepth: number | null;
  currentMode: RealtimeMode;
  currentPreset: string;
  recentLatencyMs: number | null;
  recentDetectionCount: number | null;
  lastError: string | null;
  lastRequestId: string | null;
  lastUpdatedAt: string | null;
  rawRuntime: Record<string, unknown> | null;
};

const INITIAL_STATE: DiagnosticsStoreState = {
  apiStatus: "unknown",
  gpuStatus: "unknown",
  runtimeStatus: "unknown",
  queueDepth: null,
  currentMode: "privacy",
  currentPreset: "Privacy Balanced",
  recentLatencyMs: null,
  recentDetectionCount: null,
  lastError: null,
  lastRequestId: null,
  lastUpdatedAt: null,
  rawRuntime: null,
};

let state: DiagnosticsStoreState = INITIAL_STATE;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function patchState(patch: Partial<DiagnosticsStoreState>) {
  state = { ...state, ...patch };
  emit();
}

function countDetections(detections: DetectionCounts | null) {
  if (!detections) {
    return null;
  }

  return detections.facesRedacted + detections.platesRedacted + detections.textRegionsRedacted;
}

function toneFromStatus(status: string): DiagnosticsTone {
  const normalized = status.toLowerCase();

  if (normalized.includes("ready") || normalized.includes("healthy") || normalized.includes("ok")) {
    return "success";
  }

  if (normalized.includes("warn") || normalized.includes("degrad")) {
    return "warning";
  }

  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("down")) {
    return "danger";
  }

  return "neutral";
}

export const diagnosticsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState() {
    return state;
  },
  setRuntimeDiagnostics(snapshot: RuntimeDiagnosticsSnapshot) {
    patchState({
      apiStatus: snapshot.apiStatus,
      gpuStatus: snapshot.gpuStatus,
      runtimeStatus: snapshot.runtimeStatus,
      queueDepth: snapshot.queueDepth,
      lastRequestId: snapshot.requestId,
      recentLatencyMs: snapshot.traceLatencyMs,
      lastUpdatedAt: new Date().toISOString(),
      rawRuntime: snapshot.raw,
    });
  },
  setSessionContext(input: { mode: RealtimeMode; presetLabel?: string | null }) {
    patchState({ currentMode: input.mode, currentPreset: input.presetLabel?.trim() || state.currentPreset });
  },
  setFrameMetrics(input: { detections: DetectionCounts; latencyMs: number | null; requestId: string | null }) {
    patchState({
      recentDetectionCount: countDetections(input.detections),
      recentLatencyMs: input.latencyMs,
      lastRequestId: input.requestId,
      lastUpdatedAt: new Date().toISOString(),
    });
  },
  setError(message: string | null) {
    patchState({ lastError: message, lastUpdatedAt: new Date().toISOString() });
  },
};

export function selectDiagnosticsItems(snapshot: DiagnosticsStoreState): DiagnosticsItem[] {
  return [
    { label: "API", value: snapshot.apiStatus, tone: toneFromStatus(snapshot.apiStatus) },
    { label: "GPU", value: snapshot.gpuStatus, tone: toneFromStatus(snapshot.gpuStatus) },
    { label: "Runtime", value: snapshot.runtimeStatus, tone: toneFromStatus(snapshot.runtimeStatus) },
    {
      label: "Latency",
      value: snapshot.recentLatencyMs === null ? "—" : `${snapshot.recentLatencyMs} ms`,
      tone: snapshot.recentLatencyMs !== null && snapshot.recentLatencyMs > 180 ? "warning" : "neutral",
    },
    {
      label: "Detections",
      value: snapshot.recentDetectionCount === null ? "—" : `${snapshot.recentDetectionCount} redactions`,
      tone: snapshot.recentDetectionCount ? "warning" : "neutral",
    },
  ];
}

export function useDiagnosticsStore<T>(selector: (state: DiagnosticsStoreState) => T) {
  return useSyncExternalStore(diagnosticsStore.subscribe, () => selector(diagnosticsStore.getState()), () => selector(INITIAL_STATE));
}
