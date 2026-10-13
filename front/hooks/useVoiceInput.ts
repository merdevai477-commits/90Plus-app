/**
 * Voice → text for the AI chat composer: records with expo-audio, uploads the
 * clip to `/api/chat/transcribe`, and hands the transcript back to the caller.
 * The transcript only fills the input — sending stays a separate user action.
 *
 * The server owns the voice quota; this hook only mirrors what it reports
 * (`onQuota`) and skips uploads it knows would be rejected (too short, silent).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';

import { API_CONFIG } from '../constants/theme';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import { useLanguageStore } from '../src/i18n/store';
import { logger } from '../services/logger';
import {
  MAX_VOICE_DURATION_MS,
  addMeterSample,
  emptyMeterStats,
  evaluateRecording,
  makeVoiceIdempotencyKey,
  normalizeLevel,
  type MeterStats,
} from './voiceRecordingCheck';
import {
  mapTranscribeResponse,
  type TranscribeResult,
  type VoiceInputError,
  type VoiceQuotaUpdate,
} from './voiceTranscribeResponse';

export type { VoiceInputError, VoiceQuotaUpdate } from './voiceTranscribeResponse';
export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing';

const LEVEL_SAMPLES = 28;
const POLL_MS = 80;
const NETWORK_RETRY_DELAY_MS = 800;

/** AAC (Android) and 16-bit WAV (iOS) are both formats Gemini accepts as inline audio. */
const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 48000,
  android: {
    extension: '.aac',
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
    sampleRate: 16000,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

const MIME_BY_EXT: Record<string, string> = {
  aac: 'audio/aac',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
};

function isAbortError(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'AbortError';
}

type UseVoiceInputOptions = {
  onTranscript: (text: string) => void;
  onError: (reason: VoiceInputError) => void;
  /** Authoritative voice quota from the server, after every response that carries it. */
  onQuota?: (quota: VoiceQuotaUpdate) => void;
  /** Return a reason to refuse recording (e.g. a quota the server already reported as used up). */
  canStart?: () => VoiceInputError | null;
  /** Auto-stop point for the next recording; read when recording starts. */
  maxDurationMs?: number;
};

export function useVoiceInput({ onTranscript, onError, onQuota, canStart, maxDurationMs }: UseVoiceInputOptions) {
  const { getToken } = useAuth();
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const recorderState = useAudioRecorderState(recorder, POLL_MS);
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_SAMPLES).fill(0));

  const statusRef = useRef<VoiceInputStatus>('idle');
  const callbacksRef = useRef({ onTranscript, onError, onQuota, canStart, maxDurationMs });
  callbacksRef.current = { onTranscript, onError, onQuota, canStart, maxDurationMs };
  /** Fixed for the whole recording, so a quota update mid-recording can't move the stop point. */
  const capRef = useRef(MAX_VOICE_DURATION_MS);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const meterRef = useRef<MeterStats>(emptyMeterStats());
  /** Bumped by every start/cancel/unmount; async work from an older operation is discarded. */
  const operationRef = useRef(0);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const isTranscribing = () => statusRef.current === 'transcribing';

  const setStatusBoth = useCallback((next: VoiceInputStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    if (status !== 'recording') return;
    meterRef.current = addMeterSample(meterRef.current, recorderState.metering);
    const level = normalizeLevel(recorderState.metering);
    setLevels((prev) => [...prev.slice(1), level]);
  }, [recorderState.metering, recorderState.durationMillis, status]);

  const releaseAudioMode = useCallback(() => {
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (statusRef.current !== 'idle') return;
    const refusal = callbacksRef.current.canStart?.() ?? null;
    if (refusal) {
      callbacksRef.current.onError(refusal);
      return;
    }
    const op = ++operationRef.current;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (op !== operationRef.current) return;
      if (!permission.granted) {
        // After "don't ask again" the system dialog never shows; only Settings can grant it.
        callbacksRef.current.onError(permission.canAskAgain ? 'permission' : 'permissionBlocked');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (op !== operationRef.current) {
        releaseAudioMode();
        return;
      }
      capRef.current = Math.min(
        MAX_VOICE_DURATION_MS,
        callbacksRef.current.maxDurationMs ?? MAX_VOICE_DURATION_MS,
      );
      recorder.record();
      meterRef.current = emptyMeterStats();
      setLevels(Array(LEVEL_SAMPLES).fill(0));
      setStatusBoth('recording');
    } catch (err) {
      logger.warn('[voice] failed to start recording', err);
      releaseAudioMode();
      if (op !== operationRef.current) return;
      setStatusBoth('idle');
      callbacksRef.current.onError('failed');
    }
  }, [recorder, releaseAudioMode, setStatusBoth]);

  /** Stops recording without uploading, or abandons an in-flight upload. */
  const cancel = useCallback(async () => {
    const was = statusRef.current;
    if (was === 'idle') return;
    operationRef.current += 1;
    setStatusBoth('idle');
    if (was === 'transcribing') {
      uploadAbortRef.current?.abort();
      uploadAbortRef.current = null;
      return;
    }
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    releaseAudioMode();
  }, [recorder, releaseAudioMode, setStatusBoth]);

  const upload = useCallback(
    async (uri: string, idempotencyKey: string, signal: AbortSignal): Promise<TranscribeResult> => {
      const ext = (uri.split('.').pop() ?? 'aac').toLowerCase();
      const language = useLanguageStore.getState().language === 'en' ? 'en' : 'ar';

      for (let attempt = 0; ; attempt += 1) {
        const form = new FormData();
        form.append('audio', {
          uri,
          name: `voice.${ext}`,
          type: MIME_BY_EXT[ext] ?? 'audio/aac',
        } as unknown as Blob);
        form.append('language', language);
        try {
          const token = await getClerkBearerToken(getTokenRef.current, { retries: 4 });
          const res = await fetch(`${API_CONFIG.baseUrl}/api/chat/transcribe`, {
            method: 'POST',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'x-user-language': language,
              // Same key on the retry: the server replays a finished transcript instead of billing twice.
              'Idempotency-Key': idempotencyKey,
            },
            body: form,
            signal,
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) logger.warn('[voice] transcribe HTTP', res.status, Platform.OS);
          return mapTranscribeResponse(res.status, body);
        } catch (err) {
          if (isAbortError(err) || signal.aborted) throw err;
          // Only a network throw is retried; any HTTP answer is final.
          if (attempt >= 1) {
            logger.warn('[voice] transcribe failed', err);
            return { kind: 'error', error: 'network', quota: null };
          }
          await new Promise((r) => setTimeout(r, NETWORK_RETRY_DELAY_MS));
          if (signal.aborted) throw err;
        }
      }
    },
    [],
  );

  const finish = useCallback(async () => {
    if (statusRef.current !== 'recording') return;
    const op = operationRef.current;
    const duration = recorder.getStatus().durationMillis;
    setStatusBoth('transcribing');
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    releaseAudioMode();
    if (op !== operationRef.current) return;

    const uri = recorder.uri;
    const verdict = uri ? evaluateRecording(duration, meterRef.current) : 'tooShort';
    if (!uri || verdict !== 'ok') {
      setStatusBoth('idle');
      callbacksRef.current.onError(verdict === 'ok' ? 'tooShort' : verdict);
      return;
    }

    const abort = new AbortController();
    uploadAbortRef.current = abort;
    try {
      const result = await upload(uri, makeVoiceIdempotencyKey(), abort.signal);
      if (op !== operationRef.current) return;
      if (result.quota) callbacksRef.current.onQuota?.(result.quota);
      if (result.kind === 'text') callbacksRef.current.onTranscript(result.text);
      else callbacksRef.current.onError(result.error);
    } catch (err) {
      if (op !== operationRef.current || isAbortError(err)) return;
      logger.warn('[voice] transcribe failed', err);
      callbacksRef.current.onError('failed');
    } finally {
      if (uploadAbortRef.current === abort) uploadAbortRef.current = null;
      if (op === operationRef.current && isTranscribing()) setStatusBoth('idle');
    }
  }, [recorder, releaseAudioMode, setStatusBoth, upload]);

  // Hitting the cap stops and uploads what was captured — nothing is thrown away.
  useEffect(() => {
    if (status === 'recording' && recorderState.durationMillis >= capRef.current) {
      void finish();
    }
  }, [finish, recorderState.durationMillis, status]);

  // Tabs stay mounted (and frozen) when the user leaves the chat, so unmount cleanup alone would leave the mic live.
  useFocusEffect(
    useCallback(
      () => () => {
        void cancel();
      },
      [cancel],
    ),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      // A finished clip keeps uploading so a quick app switch doesn't lose the transcript.
      if (next === 'background' && statusRef.current === 'recording') void cancel();
    });
    return () => sub.remove();
  }, [cancel]);

  useEffect(
    () => () => {
      operationRef.current += 1;
      uploadAbortRef.current?.abort();
      if (statusRef.current === 'recording') {
        try {
          recorder.stop().catch(() => {});
        } catch {
          // Recorder already released by expo-audio's own cleanup.
        }
        releaseAudioMode();
      }
    },
    [recorder, releaseAudioMode],
  );

  return {
    status,
    durationMs: status === 'recording' ? recorderState.durationMillis : 0,
    levels,
    start,
    finish,
    cancel,
  };
}
