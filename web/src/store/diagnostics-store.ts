import { useSyncExternalStore } from "react";

import type { RuntimeDiagnosticsSnapshot } from "../services/diagnostics-api";

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
  currentPreset: string;
  recentLatencyMs: number | null;
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
  currentPreset: "디퓨전 대체",
  recentLatencyMs: null,
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

export function formatDiagnosticsStatus(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes("healthy") || normalized.includes("ready") || normalized === "ok") {
    return "정상";
  }

  if (normalized.includes("warn")) {
    return "주의";
  }

  if (normalized.includes("degrad")) {
    return "성능 저하";
  }

  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("down")) {
    return "오류";
  }

  if (normalized.includes("unknown")) {
    return "알 수 없음";
  }

  return status;
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
  setError(message: string | null) {
    patchState({ lastError: message, lastUpdatedAt: new Date().toISOString() });
  },
};

export function selectDiagnosticsItems(snapshot: DiagnosticsStoreState): DiagnosticsItem[] {
  return [
    { label: "API", value: formatDiagnosticsStatus(snapshot.apiStatus), tone: toneFromStatus(snapshot.apiStatus) },
    { label: "GPU", value: formatDiagnosticsStatus(snapshot.gpuStatus), tone: toneFromStatus(snapshot.gpuStatus) },
    { label: "런타임", value: formatDiagnosticsStatus(snapshot.runtimeStatus), tone: toneFromStatus(snapshot.runtimeStatus) },
    {
      label: "지연시간",
      value: snapshot.recentLatencyMs === null ? "-" : `${snapshot.recentLatencyMs}ms`,
      tone: snapshot.recentLatencyMs !== null && snapshot.recentLatencyMs > 180 ? "warning" : "neutral",
    },
    {
      label: "대기열",
      value: snapshot.queueDepth === null ? "-" : `${snapshot.queueDepth}개`,
      tone: snapshot.queueDepth && snapshot.queueDepth > 0 ? "warning" : "neutral",
    },
  ];
}

export function useDiagnosticsStore<T>(selector: (state: DiagnosticsStoreState) => T) {
  return useSyncExternalStore(diagnosticsStore.subscribe, () => selector(diagnosticsStore.getState()), () => selector(INITIAL_STATE));
}
