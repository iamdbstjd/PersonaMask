"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage } from "../services/api-client";
import { sessionStore } from "../store/session-store";

export type CameraPermission = "idle" | "requesting" | "granted" | "denied";

export type CapturedFrame = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
};

type CaptureOptions = {
  mimeType?: string;
  quality?: number;
  targetWidth?: number;
};

export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permission, setPermission] = useState<CameraPermission>("idle");
  const [isStarting, setIsStarting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const attachStream = useCallback((stream: MediaStream | null) => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    videoElement.srcObject = stream;

    if (stream) {
      void videoElement.play().catch(() => {
        // Autoplay can fail before user interaction; camera start itself still succeeded.
      });
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    attachStream(null);
    setIsStarting(false);
    setIsActive(false);
    sessionStore.setCameraReady(false);
  }, [attachStream]);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const message = "이 브라우저에서는 카메라 API를 사용할 수 없습니다.";
      setLastError(message);
      sessionStore.setError(message);
      return;
    }

    setIsStarting(true);
    setLastError(null);
    setPermission("requesting");
    sessionStore.setCameraLoading();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      attachStream(stream);
      setPermission("granted");
      setIsActive(true);
      sessionStore.setCameraReady(true);
    } catch (error) {
      const message = getErrorMessage(error, "카메라를 시작하지 못했습니다.");
      setPermission("denied");
      setLastError(message);
      sessionStore.setCameraDenied(message);
    } finally {
      setIsStarting(false);
    }
  }, [attachStream]);

  const captureFrame = useCallback(async (options: CaptureOptions = {}): Promise<CapturedFrame | null> => {
    const videoElement = videoRef.current;

    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return null;
    }

    const targetWidth = options.targetWidth ?? videoElement.videoWidth;
    const scale = targetWidth / videoElement.videoWidth;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(videoElement.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(videoElement.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const mimeType = options.mimeType ?? "image/jpeg";
    const quality = options.quality ?? 0.72;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });

    if (!blob) {
      return null;
    }

    return {
      blob,
      dataUrl: canvas.toDataURL(mimeType, quality),
      width: canvas.width,
      height: canvas.height,
    };
  }, []);

  useEffect(() => {
    attachStream(streamRef.current);
  }, [attachStream]);

  useEffect(() => stopCamera, [stopCamera]);

  return {
    videoRef,
    permission,
    isStarting,
    isActive,
    lastError,
    startCamera,
    stopCamera,
    captureFrame,
  };
}
