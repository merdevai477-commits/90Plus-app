/**
 * Recording lifecycle of useVoiceInput with expo-audio and the network mocked:
 * what gets uploaded, what never leaves the device, and races with cancel/unmount.
 *
 *   npx jest -c jest.render.config.js hooks/__tests__/useVoiceInput.render.test.tsx
 */

import { act, renderHook } from '@testing-library/react-native';

const mockState = { durationMillis: 0, metering: undefined as number | undefined };
const mockRecorder = {
  uri: 'file:///cache/voice.aac' as string | null,
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  stop: jest.fn(async () => undefined),
  getStatus: jest.fn(() => ({ durationMillis: mockState.durationMillis })),
};
const mockPermission = jest.fn(async () => ({ granted: true, canAskAgain: true }));

jest.mock('expo-audio', () => ({
  AudioQuality: { HIGH: 96 },
  IOSOutputFormat: { LINEARPCM: 'lpcm' },
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: () => mockPermission(),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ ...mockState }),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (cb: () => () => void) => useEffect(cb, [cb]) };
});
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ getToken: async () => 'token' }) }));
jest.mock('../../utils/clerkAuthToken', () => ({ getClerkBearerToken: async () => 'token' }));
jest.mock('../../constants/theme', () => ({ API_CONFIG: { baseUrl: 'https://api.test' } }));
jest.mock('../../src/i18n/store', () => ({ useLanguageStore: { getState: () => ({ language: 'ar' }) } }));
jest.mock('../../services/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import { useVoiceInput } from '../useVoiceInput';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const quotaBody = (remaining: number) => ({ voiceRemainingSeconds: remaining, voiceLimitSeconds: 150, voiceResetAt: null });
const quotaUpdate = (remaining: number) => ({ remainingSeconds: remaining, limitSeconds: 150, resetAt: null });

function setup(extra: { canStart?: () => null | 'voiceQuota'; maxDurationMs?: number } = {}) {
  const onTranscript = jest.fn();
  const onError = jest.fn();
  const onQuota = jest.fn();
  const hook = renderHook(() => useVoiceInput({ onTranscript, onError, onQuota, ...extra }));
  return { ...hook, onTranscript, onError, onQuota };
}

/** Feeds meter samples the way expo-audio's polling would (one re-render per sample). */
function speak(rerender: (p: unknown) => void, dbs: number[], durationMillis: number) {
  dbs.forEach((db, i) => {
    mockState.metering = db;
    mockState.durationMillis = Math.round(((i + 1) / dbs.length) * durationMillis);
    rerender({});
  });
}

async function startRecording(result: { current: ReturnType<typeof useVoiceInput> }) {
  await act(async () => {
    await result.current.start();
  });
  expect(result.current.status).toBe('recording');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState.durationMillis = 0;
  mockState.metering = undefined;
  mockRecorder.uri = 'file:///cache/voice.aac';
  mockPermission.mockResolvedValue({ granted: true, canAskAgain: true });
});

describe('useVoiceInput', () => {
  it('cancelling a recording uploads nothing', async () => {
    const { result, rerender, onError, onTranscript } = setup();
    await startRecording(result);
    speak(rerender, [-30, -20, -25], 4000);

    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.status).toBe('idle');
    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('a recording under one second is rejected on the device', async () => {
    const { result, rerender, onError } = setup();
    await startRecording(result);
    speak(rerender, [-30, -20], 600);

    await act(async () => {
      await result.current.finish();
    });

    expect(onError).toHaveBeenCalledWith('tooShort');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a silent recording is rejected on the device', async () => {
    const { result, rerender, onError } = setup();
    await startRecording(result);
    speak(rerender, [-60, -59, -61, -58.5], 3000);

    await act(async () => {
      await result.current.finish();
    });

    expect(onError).toHaveBeenCalledWith('silent');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a refused start never asks for the mic', async () => {
    const { result, onError } = setup({ canStart: () => 'voiceQuota' });
    await act(async () => {
      await result.current.start();
    });

    expect(onError).toHaveBeenCalledWith('voiceQuota');
    expect(mockPermission).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('a permanently denied mic asks the user to open Settings', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const { result, onError } = setup();
    await act(async () => {
      await result.current.start();
    });
    expect(onError).toHaveBeenCalledWith('permissionBlocked');
  });

  it('hitting the 30s cap stops and uploads what was captured', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { text: 'مين جاب الجول', ...quotaBody(120) }));
    const { result, rerender, onTranscript, onQuota } = setup();
    await startRecording(result);

    await act(async () => {
      speak(rerender, [-40, -20, -15, -35], 30_000);
    });

    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/chat/transcribe');
    expect(init.headers['Idempotency-Key']).toMatch(/^voice-/);
    expect(onTranscript).toHaveBeenCalledWith('مين جاب الجول');
    expect(onQuota).toHaveBeenCalledWith(quotaUpdate(120));
    expect(result.current.status).toBe('idle');
  });

  it('with less voice time left than 30s, recording stops at the time left', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { text: 'ok', ...quotaBody(0) }));
    const { result, rerender } = setup({ maxDurationMs: 12_000 });
    await startRecording(result);

    await act(async () => {
      speak(rerender, [-40, -20, -15], 11_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('recording');

    await act(async () => {
      speak(rerender, [-30], 12_000);
    });
    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a dropped connection once with the same idempotency key', async () => {
    jest.useFakeTimers();
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(jsonResponse(200, { text: 'hi', ...quotaBody(100) }));
    const { result, rerender, onTranscript } = setup();
    await startRecording(result);
    speak(rerender, [-40, -20, -25], 3000);

    await act(async () => {
      const done = result.current.finish();
      await jest.advanceTimersByTimeAsync(1000);
      await done;
    });
    jest.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      fetchMock.mock.calls[1][1].headers['Idempotency-Key'],
    );
    expect(onTranscript).toHaveBeenCalledWith('hi');
  });

  it('a server quota rejection reports the reason and the fresh quota', async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, { code: 'VOICE_QUOTA_EXHAUSTED', ...quotaBody(0) }));
    const { result, rerender, onError, onQuota, onTranscript } = setup();
    await startRecording(result);
    speak(rerender, [-40, -20, -25], 3000);

    await act(async () => {
      await result.current.finish();
    });

    expect(onError).toHaveBeenCalledWith('voiceQuota');
    expect(onQuota).toHaveBeenCalledWith(quotaUpdate(0));
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('leaving the chat mid-upload aborts it and drops the late result', async () => {
    let resolveFetch: (v: unknown) => void = () => undefined;
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      signal = init.signal;
      return new Promise((r) => {
        resolveFetch = r;
      });
    });
    const { result, rerender, unmount, onTranscript, onError } = setup();
    await startRecording(result);
    speak(rerender, [-40, -20, -25], 3000);

    let finishing: Promise<void> = Promise.resolve();
    await act(async () => {
      finishing = result.current.finish();
      await Promise.resolve();
    });
    unmount();
    resolveFetch(jsonResponse(200, { text: 'late', ...quotaBody(120) }));
    await finishing;

    expect(signal?.aborted).toBe(true);
    expect(onTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
