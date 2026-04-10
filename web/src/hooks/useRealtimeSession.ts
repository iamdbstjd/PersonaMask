"use client";

import { useCallback, useEffect, useState } from "react";

import { getErrorMessage } from "../services/api-client";
import { closeRealtimeSession, createRealtimeSession, type PrivacyOptions, type RealtimeMode, type StreamProfile } from "../services/realtime-api";
import { diagnosticsStore } from "../store/diagnostics-store";
import { sessionStore, useSessionStore } from "../store/session-store";

type UseRealtimeSessionOptions = {
  mode: RealtimeMode;
  presetLabel?: string;
  presetId?: string;
  streamProfile: StreamProfile;
  privacyOptions: PrivacyOptions;
};

export function useRealtimeSession(options: UseRealtimeSessionOptions) {
  const sessionId = useSessionStore((snapshot) => snapshot.sessionId);
  const status = useSessionStore((snapshot) => snapshot.status);
  const acceptedProfile = useSessionStore((snapshot) => snapshot.acceptedProfile);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    sessionStore.setMode(options.mode);
    diagnosticsStore.setSessionContext({ mode: options.mode, presetLabel: options.presetLabel ?? "Privacy Balanced" });
  }, [options.mode, options.presetLabel]);

  const startSession = useCallback(async () => {
    setIsBusy(true);
    sessionStore.setSessionStarting(options.mode);

    try {
      const session = await createRealtimeSession({
        mode: options.mode,
        presetId: options.presetId,
        streamProfile: options.streamProfile,
        privacyOptions: options.privacyOptions,
      });

      sessionStore.setStreamingSession(session);
      diagnosticsStore.setSessionContext({ mode: session.mode, presetLabel: options.presetLabel ?? "Privacy Balanced" });
      diagnosticsStore.setError(null);

      return session;
    } catch (error) {
      const message = getErrorMessage(error, "실시간 세션을 시작하지 못했습니다.");
      sessionStore.setError(message);
      diagnosticsStore.setError(message);
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [options.mode, options.presetId, options.presetLabel, options.privacyOptions, options.streamProfile]);

  const stopSession = useCallback(async () => {
    if (!sessionId) {
      sessionStore.reset();
      return;
    }

    setIsBusy(true);

    try {
      await closeRealtimeSession(sessionId);
      diagnosticsStore.setError(null);
    } catch (error) {
      const message = getErrorMessage(error, "실시간 세션을 종료하지 못했습니다.");
      diagnosticsStore.setError(message);
    } finally {
      sessionStore.reset();
      setIsBusy(false);
    }
  }, [sessionId]);

  return {
    sessionId,
    status,
    acceptedProfile,
    isBusy,
    startSession,
    stopSession,
  };
}
