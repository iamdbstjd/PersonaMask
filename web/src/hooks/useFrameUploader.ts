"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getErrorMessage } from "../services/api-client";
import { processRealtimeFrame, type PrivacyOptions, type RealtimeMode, type StreamProfile } from "../services/realtime-api";
import { diagnosticsStore } from "../store/diagnostics-store";
import { sessionStore } from "../store/session-store";

import type { CapturedFrame } from "./useCameraStream";

type UseFrameUploaderOptions = {
  enabled: boolean;
  mode: RealtimeMode;
  sessionId: string | null;
  acceptedProfile: StreamProfile | null;
  privacyOptions: PrivacyOptions;
  captureFrame: (options?: { mimeType?: string; quality?: number; targetWidth?: number }) => Promise<CapturedFrame | null>;
};

export function useFrameUploader(options: UseFrameUploaderOptions) {
  const frameIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadError, setLastUploadError] = useState<string | null>(null);

  const intervalMs = useMemo(() => {
    if (!options.acceptedProfile?.targetFps) {
      return 220;
    }

    return Math.max(120, Math.round(1000 / Math.max(1, options.acceptedProfile.targetFps)));
  }, [options.acceptedProfile?.targetFps]);

  useEffect(() => {
    if (!options.enabled || !options.sessionId || !options.acceptedProfile) {
      setIsUploading(false);
      sessionStore.setUploading(false);
      return;
    }

    let cancelled = false;

    const clearScheduledTick = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleTick = (delay: number) => {
      clearScheduledTick();
      timerRef.current = window.setTimeout(() => {
        void tick();
      }, delay);
    };

    const tick = async () => {
      if (cancelled || inFlightRef.current || !options.sessionId || !options.acceptedProfile) {
        if (!cancelled) {
          scheduleTick(intervalMs);
        }
        return;
      }

      inFlightRef.current = true;
      setIsUploading(true);
      sessionStore.setUploading(true);
      abortRef.current = new AbortController();

      try {
        const frameId = ++frameIdRef.current;
        const captured = await options.captureFrame({
          mimeType: "image/jpeg",
          quality: options.acceptedProfile.jpegQuality,
          targetWidth: options.acceptedProfile.frameWidth,
        });

        if (!captured) {
          throw new Error("카메라 프레임을 아직 읽을 수 없습니다.");
        }

        sessionStore.setOriginalFrame(captured.dataUrl);

        const result = await processRealtimeFrame({
          sessionId: options.sessionId,
          frame: captured.blob,
          meta: {
            frameId,
            timestampMs: Date.now(),
            clientWidth: captured.width,
            clientHeight: captured.height,
            rotationDeg: 0,
            mode: options.mode,
          },
          signal: abortRef.current.signal,
        });

        sessionStore.setFrameResult({
          frameId: result.frameId,
          requestId: result.requestId,
          processedFrameSrc: result.processedImageSrc,
          processedFrameIsObjectUrl: result.processedImageIsObjectUrl,
          serverLatencyMs: result.serverLatencyMs,
          detections: result.detections,
        });
        diagnosticsStore.setFrameMetrics({
          detections: result.detections,
          latencyMs: result.serverLatencyMs,
          requestId: result.requestId,
        });
        diagnosticsStore.setError(null);
        setLastUploadError(null);
      } catch (error) {
        if (!cancelled) {
          const message = getErrorMessage(error, "프레임 업로드에 실패했습니다.");
          sessionStore.setDegraded(message);
          diagnosticsStore.setError(message);
          setLastUploadError(message);
        }
      } finally {
        abortRef.current = null;
        inFlightRef.current = false;
        setIsUploading(false);
        sessionStore.setUploading(false);

        if (!cancelled) {
          scheduleTick(intervalMs);
        }
      }
    };

    void tick();

    return () => {
      cancelled = true;
      clearScheduledTick();
      abortRef.current?.abort();
      abortRef.current = null;
      inFlightRef.current = false;
      setIsUploading(false);
      sessionStore.setUploading(false);
    };
  }, [options.acceptedProfile, options.captureFrame, options.enabled, intervalMs, options.mode, options.sessionId]);

  return {
    isUploading,
    lastUploadError,
    activePolicy: options.privacyOptions,
  };
}
