import { requestApiEnvelope } from "./api-client";

export type RuntimeDiagnosticsSnapshot = {
  requestId: string;
  traceLatencyMs: number | null;
  apiStatus: string;
  gpuStatus: string;
  runtimeStatus: string;
  queueDepth: number | null;
  raw: Record<string, unknown>;
};

export type PresetItem = {
  presetId: string;
  label: string;
  mode: "character";
  thumbnailUrl: string;
  engine: string;
};

type DiagnosticsResponseData = Record<string, unknown>;

type PresetItemWire = {
  preset_id: string;
  label: string;
  mode: "character";
  thumbnail_url: string;
  engine: string;
};

type PresetsResponseData = {
  items: PresetItemWire[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readStatus(record: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function formatPresetLabel(label: string): string {
  const labels: Record<string, string> = {
    "Animated Portrait": "애니메이션 초상",
    "Clay Avatar": "클레이 아바타",
    "Comic Ink": "코믹 잉크",
  };

  return labels[label] ?? label;
}

export async function fetchRuntimeDiagnostics(): Promise<RuntimeDiagnosticsSnapshot> {
  const result = await requestApiEnvelope<DiagnosticsResponseData>("/diagnostics/runtime", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const raw = asRecord(result.data);

  return {
    requestId: result.requestId,
    traceLatencyMs: result.headers.traceLatencyMs,
    apiStatus: readStatus(raw, ["api_status", "api", "apiStatus"], "unknown"),
    gpuStatus: readStatus(raw, ["gpu_status", "gpu", "gpuStatus"], "unknown"),
    runtimeStatus: readStatus(raw, ["runtime_status", "runtime", "runtimeStatus"], "unknown"),
    queueDepth:
      typeof raw.queue_depth === "number"
        ? raw.queue_depth
        : typeof raw.queueDepth === "number"
          ? raw.queueDepth
          : null,
    raw,
  };
}

export async function fetchPresets(): Promise<PresetItem[]> {
  const result = await requestApiEnvelope<PresetsResponseData>("/presets", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  return result.data.items.map((item) => ({
    presetId: item.preset_id,
    label: formatPresetLabel(item.label),
    mode: item.mode,
    thumbnailUrl: item.thumbnail_url,
    engine: item.engine,
  }));
}
