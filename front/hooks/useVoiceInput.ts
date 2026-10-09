/**
 * Voice → text for the AI chat composer: records with expo-audio, uploads the
 * clip to `/api/chat/transcribe`, and hands the transcript back to the caller.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
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

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing';
export type VoiceInputError = 'permission' | 'tooShort' | 'empty' | 'unavailable' | 'failed';

const MAX_DURATION_MS = 60_000;
const MIN_DURATION_MS = 700;
const LEVEL_SAMPLES = 28;
const POLL_MS = 80;

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

/** Metering is dBFS (≈ -60 silence … 0 loud); map to 0…1 for the level bars. */
function normalizeLevel(db: number | undefined): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 55) / 50));
}

type UseVoiceInputOptions = {
  onTranscript: (text: string) => void;
  onError: (reason: VoiceInputError) => void;
};

export function useVoiceInput({ onTranscript, onError }: UseVoiceInputOptions) {
  const { getToken } = useAuth();
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const recorderState = useAudioRecorderState(recorder, POLL_MS);
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_SAMPLES).fill(0));

  const statusRef = useRef<VoiceInputStatus>('idle');
  const callbacksRef = useRef({ onTranscript, onError });
  callbacksRef.current = { onTranscript, onError };
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const isTranscribing = () => statusRef.current === 'transcribing';

  const setStatusBoth = useCallback((next: VoiceInputStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    if (status !== 'recording') return;
    const level = normalizeLevel(recorderState.metering);
    setLevels((prev) => [...prev.slice(1), level]);
  }, [recorderState.metering, recorderState.durationMillis, status]);

  const releaseAudioMode = useCallback(() => {
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (statusRef.current !== 'idle') return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        callbacksRef.current.onError('permission');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setLevels(Array(LEVEL_SAMPLES).fill(0));
      setStatusBoth('recording');
    } catch (err) {
      logger.warn('[voice] failed to start recording', err);
      releaseAudioMode();
      setStatusBoth('idle');
      callbacksRef.current.onError('failed');
    }
  }, [recorder, releaseAudioMode, setStatusBoth]);

  const cancel = useCallback(async () => {
    if (statusRef.current !== 'recording') return;
    setStatusBoth('idle');
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    releaseAudioMode();
  }, [recorder, releaseAudioMode, setStatusBoth]);

  const finish = useCallback(async () => {
    if (statusRef.current !== 'recording') return;
    const duration = recorder.getStatus().durationMillis;
    setStatusBoth('transcribing');
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    releaseAudioMode();

    const uri = recorder.uri;
    if (!uri || duration < MIN_DURATION_MS) {
      setStatusBoth('idle');
      callbacksRef.current.onError('tooShort');
      return;
    }

    try {
      const ext = (uri.split('.').pop() ?? 'aac').toLowerCase();
      const language = useLanguageStore.getState().language === 'en' ? 'en' : 'ar';
      const form = new FormData();
      form.append('audio', {
        uri,
        name: `voice.${ext}`,
        type: MIME_BY_EXT[ext] ?? 'audio/aac',
      } as unknown as Blob);
      form.append('language', language);

      const token = await getClerkBearerToken(getTokenRef.current, { retries: 4 });
      const res = await fetch(`${API_CONFIG.baseUrl}/api/chat/transcribe`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-language': language,
        },
        body: form,
      });

      if (!isTranscribing()) return;
      if (res.status === 501) {
        callbacksRef.current.onError('unavailable');
        return;
      }
      if (!res.ok) {
        logger.warn('[voice] transcribe HTTP', res.status, Platform.OS);
        callbacksRef.current.onError('failed');
        return;
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? '').trim();
      if (!text) {
        callbacksRef.current.onError('empty');
        return;
      }
      callbacksRef.current.onTranscript(text);
    } catch (err) {
      logger.warn('[voice] transcribe failed', err);
      callbacksRef.current.onError('failed');
    } finally {
      if (isTranscribing()) setStatusBoth('idle');
    }
  }, [recorder, releaseAudioMode, setStatusBoth]);

  useEffect(() => {
    if (status === 'recording' && recorderState.durationMillis >= MAX_DURATION_MS) {
      void finish();
    }
  }, [finish, recorderState.durationMillis, status]);

  useEffect(
    () => () => {
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
