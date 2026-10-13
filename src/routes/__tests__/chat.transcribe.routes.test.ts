/**
 * POST /api/chat/transcribe and GET /api/chat/limit over real HTTP, with the
 * speech providers and quota storage mocked (no provider credits are spent).
 * The response-field mapping is the real one from chat-voice-quota.service.
 */

import type { AddressInfo } from 'net';
import type { Server } from 'http';

jest.mock('../../lib/prisma', () => ({ __esModule: true, prisma: {}, default: {} }));
jest.mock('../../middleware/clerk.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const userId = req.headers['x-test-user'];
    if (!userId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized - Invalid token' });
      return;
    }
    req.auth = { userId };
    next();
  },
}));
jest.mock('../../middleware/rateLimit.middleware', () => ({
  voiceTranscribeLimiter: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../services/chat.service', () => ({
  getRemaining: jest.fn(),
  incrementLimit: jest.fn(),
  decrementLimit: jest.fn(),
  getResetTimeForUser: jest.fn(async () => new Date('2026-10-14T10:00:00.000Z')),
  getDailyMessageLimit: () => 10,
  isChatUnlimitedUser: jest.fn(() => false),
  migrateLegacyFileStore: jest.fn(async () => undefined),
}));
jest.mock('../../services/chat-voice-quota.service', () => ({
  ...jest.requireActual('../../services/chat-voice-quota.service'),
  getVoiceQuota: jest.fn(),
  getVoiceQuotaConfig: () => ({ dailyMs: 150_000, maxSeconds: 30, serverMaxSeconds: 35, reservationTtlMs: 120000 }),
  reserveVoiceDuration: jest.fn(),
  commitVoiceOperation: jest.fn(async () => true),
  releaseVoiceOperation: jest.fn(async () => true),
  markVoiceTimedOut: jest.fn(async () => true),
}));
jest.mock('../../services/openrouter-transcribe.client', () => ({
  isOpenRouterTranscribeConfigured: jest.fn(() => true),
  audioFormatForMime: (mime: string) => (mime === 'audio/wav' ? 'wav' : 'aac'),
  transcribeAudioWithOpenRouter: jest.fn(),
}));
jest.mock('../../services/gemini-text.client', () => ({
  isGeminiAudioConfigured: jest.fn(() => false),
  transcribeAudioWithGemini: jest.fn(),
  isTimeoutError: (err: any) => err?.name === 'TimeoutError' || err?.name === 'AbortError',
}));
jest.mock('../../services/gemini-chat.client', () => ({
  isGeminiChatConfigured: () => false,
  buildGeminiChatClient: jest.fn(),
  resolveGeminiChatModel: jest.fn(),
  resolveGeminiChatFallbackModel: jest.fn(),
}));
jest.mock('../../services/bedrock-chat.client', () => ({
  isBedrockChatConfigured: () => false,
  buildBedrockChatClient: jest.fn(),
  resolveBedrockChatModel: jest.fn(),
}));
jest.mock('../../services/chat-football-tools.service', () => ({}));
jest.mock('../../services/chat-answer-cache.service', () => ({}));
jest.mock('../../services/player-info-cache.service', () => ({}));
jest.mock('../../services/chat-suggestions.service', () => ({}));
jest.mock('../../services/chat-agent.service', () => ({ isChatAgentConfigured: () => false }));
jest.mock('../../services/chat-deterministic-fallback.service', () => ({}));

import express from 'express';
import router from '../chat.routes';
import * as chatService from '../../services/chat.service';
import * as quota from '../../services/chat-voice-quota.service';
import * as openrouter from '../../services/openrouter-transcribe.client';

const mocked = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock;

function wav(seconds: number): Buffer {
  const dataBytes = Math.round(seconds * 16000) * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

/** Quota as the service reports it: whole seconds left of a 150s allowance. */
const QUOTA = (remainingSeconds: number) => ({
  limitMs: 150_000,
  usedMs: 150_000 - remainingSeconds * 1000,
  remainingMs: remainingSeconds * 1000,
  exhausted: remainingSeconds < 1,
  unlimited: false,
  resetAt: new Date('2026-10-14T10:00:00.000Z'),
});

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api', router);
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  jest.clearAllMocks();
  mocked(chatService.getRemaining).mockResolvedValue(7);
  mocked(chatService.isChatUnlimitedUser).mockReturnValue(false);
  mocked(openrouter.isOpenRouterTranscribeConfigured).mockReturnValue(true);
  mocked(quota.getVoiceQuota).mockResolvedValue(QUOTA(150));
  mocked(quota.reserveVoiceDuration).mockImplementation(async (_u: string, _k: string, ms: number) => ({
    kind: 'reserved',
    operationId: 'op-1',
    attempt: 1,
    chargedMs: ms,
    quota: QUOTA(150 - ms / 1000),
  }));
});

async function transcribe(audio: Buffer | null, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (audio) form.append('audio', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'voice.wav');
  form.append('language', 'ar');
  const res = await fetch(`${baseUrl}/chat/transcribe`, {
    method: 'POST',
    headers: { 'x-test-user': 'user_1', ...headers },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('POST /chat/transcribe', () => {
  it('reserves the measured duration, commits it and never touches the message quota', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: ' مرحبا ', model: 'm' });
    const { status, body } = await transcribe(wav(10), { 'Idempotency-Key': 'voice-abc12345' });

    expect(status).toBe(200);
    expect(body).toEqual({
      text: 'مرحبا',
      voiceRemainingSeconds: 140,
      voiceLimitSeconds: 150,
      voiceResetAt: '2026-10-14T10:00:00.000Z',
    });
    expect(quota.reserveVoiceDuration).toHaveBeenCalledWith('user_1', 'voice-abc12345', 10_000);
    expect(quota.commitVoiceOperation).toHaveBeenCalledWith('op-1', 1, 'مرحبا');
    expect(quota.releaseVoiceOperation).not.toHaveBeenCalled();
    expect(chatService.incrementLimit).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'audio/wav', language: 'ar' }),
    );
  });

  it('a 30s clip reserves 30s', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: 'x', model: 'm' });
    const { body } = await transcribe(wav(30));
    expect(mocked(quota.reserveVoiceDuration).mock.calls[0][2]).toBe(30_000);
    expect(body.voiceRemainingSeconds).toBe(120);
  });

  it('the charge comes from the decoded audio, not from anything the client claims', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: 'x', model: 'm' });
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(wav(12))], { type: 'audio/wav' }), 'voice.wav');
    form.append('durationMs', '1000');
    await fetch(`${baseUrl}/chat/transcribe`, {
      method: 'POST',
      headers: { 'x-test-user': 'user_1', 'x-voice-duration': '1' },
      body: form,
    });
    expect(mocked(quota.reserveVoiceDuration).mock.calls[0][2]).toBe(12_000);
  });

  it('an empty transcript releases the reservation and keeps the 200 + empty text contract', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: '', model: 'm' });
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(200);
    expect(body).toMatchObject({ text: '', code: 'VOICE_EMPTY', voiceRemainingSeconds: 150 });
    expect(quota.releaseVoiceOperation).toHaveBeenCalledWith('op-1', 1, 'empty_transcript');
    expect(quota.commitVoiceOperation).not.toHaveBeenCalled();
  });

  it('a provider failure releases the reservation', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockRejectedValue(new Error('OpenRouter HTTP 500'));
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(502);
    expect(body.code).toBe('VOICE_PROVIDER_FAILED');
    expect(quota.releaseVoiceOperation).toHaveBeenCalledWith('op-1', 1, 'provider_failed');
    expect(quota.commitVoiceOperation).not.toHaveBeenCalled();
  });

  it('a provider timeout is recorded as ambiguous and not retried elsewhere', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    mocked(openrouter.transcribeAudioWithOpenRouter).mockRejectedValue(timeout);
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(504);
    expect(body.code).toBe('VOICE_PROVIDER_TIMEOUT');
    expect(quota.markVoiceTimedOut).toHaveBeenCalledWith('op-1', 1);
    expect(quota.releaseVoiceOperation).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).toHaveBeenCalledTimes(1);
  });

  it('a used-up allowance never reaches the provider and reports 0 seconds left', async () => {
    mocked(quota.getVoiceQuota).mockResolvedValue(QUOTA(0));
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(429);
    expect(body).toEqual({
      error: 'Daily voice limit reached',
      code: 'VOICE_QUOTA_EXHAUSTED',
      voiceRemainingSeconds: 0,
      voiceLimitSeconds: 150,
      voiceResetAt: '2026-10-14T10:00:00.000Z',
    });
    expect(quota.reserveVoiceDuration).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('losing the reservation race never reaches the provider', async () => {
    mocked(quota.reserveVoiceDuration).mockResolvedValue({ kind: 'exhausted', quota: QUOTA(0) });
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(429);
    expect(body).toMatchObject({ code: 'VOICE_QUOTA_EXHAUSTED', voiceRemainingSeconds: 0 });
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('a clip longer than the time left is refused with the time that is left', async () => {
    mocked(quota.getVoiceQuota).mockResolvedValue(QUOTA(10));
    mocked(quota.reserveVoiceDuration).mockResolvedValue({ kind: 'insufficient', quota: QUOTA(10) });
    const { status, body } = await transcribe(wav(25));

    expect(status).toBe(429);
    expect(body).toMatchObject({
      code: 'VOICE_QUOTA_INSUFFICIENT',
      voiceRemainingSeconds: 10,
      durationSeconds: 25,
    });
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('an exhausted message quota never reaches the provider', async () => {
    mocked(chatService.getRemaining).mockResolvedValue(0);
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(429);
    expect(body.code).toBe('MESSAGE_QUOTA_EXHAUSTED');
    expect(quota.reserveVoiceDuration).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('audio past the server duration cap is refused before reserving', async () => {
    const { status, body } = await transcribe(wav(40));

    expect(status).toBe(413);
    expect(body).toMatchObject({ code: 'VOICE_AUDIO_TOO_LONG', maxSeconds: 35 });
    expect(quota.reserveVoiceDuration).not.toHaveBeenCalled();
  });

  it('a clip under the minimum is refused before reserving', async () => {
    const { status, body } = await transcribe(wav(0.5));

    expect(status).toBe(422);
    expect(body.code).toBe('VOICE_AUDIO_TOO_SHORT');
    expect(quota.reserveVoiceDuration).not.toHaveBeenCalled();
  });

  it('non-audio bytes are refused before reserving, whatever the filename claims', async () => {
    const { status, body } = await transcribe(Buffer.from('definitely not a wav file'));

    expect(status).toBe(415);
    expect(body.code).toBe('VOICE_AUDIO_INVALID');
    expect(quota.reserveVoiceDuration).not.toHaveBeenCalled();
  });

  it('a missing file is a 400 with a code', async () => {
    const { status, body } = await transcribe(null);
    expect(status).toBe(400);
    expect(body.code).toBe('VOICE_AUDIO_INVALID');
  });

  it('a replayed idempotency key returns the stored transcript without calling the provider', async () => {
    mocked(quota.reserveVoiceDuration).mockResolvedValue({ kind: 'cached', transcript: 'نص محفوظ', quota: QUOTA(140) });
    const { status, body } = await transcribe(wav(10), { 'Idempotency-Key': 'voice-replay123' });

    expect(status).toBe(200);
    expect(body).toMatchObject({ text: 'نص محفوظ', voiceRemainingSeconds: 140 });
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
    expect(quota.commitVoiceOperation).not.toHaveBeenCalled();
  });

  it('a key that is still in flight gets 409', async () => {
    mocked(quota.reserveVoiceDuration).mockResolvedValue({ kind: 'in_progress', quota: QUOTA(140) });
    const { status, body } = await transcribe(wav(3), { 'Idempotency-Key': 'voice-inflight1' });
    expect(status).toBe(409);
    expect(body.code).toBe('VOICE_IN_PROGRESS');
  });

  it('older clients (no idempotency key) still get a fresh server key and a text field', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: 'hi', model: 'm' });
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(200);
    expect(body.text).toBe('hi');
    expect(mocked(quota.reserveVoiceDuration).mock.calls[0][1]).toMatch(/^srv-/);
  });

  it('keeps 501 when no provider is configured', async () => {
    mocked(openrouter.isOpenRouterTranscribeConfigured).mockReturnValue(false);
    const saved = { a: process.env.AI_TRANSCRIBE_KEY, o: process.env.OPENAI_API_KEY };
    delete process.env.AI_TRANSCRIBE_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const { status, body } = await transcribe(wav(3));
      expect(status).toBe(501);
      expect(body.code).toBe('VOICE_UNAVAILABLE');
    } finally {
      if (saved.a !== undefined) process.env.AI_TRANSCRIBE_KEY = saved.a;
      if (saved.o !== undefined) process.env.OPENAI_API_KEY = saved.o;
    }
  });

  it('an unauthenticated request is refused before anything else', async () => {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(wav(1))]), 'voice.wav');
    const res = await fetch(`${baseUrl}/chat/transcribe`, { method: 'POST', body: form });
    expect(res.status).toBe(401);
    expect(quota.reserveVoiceDuration).not.toHaveBeenCalled();
  });
});

describe('GET /chat/limit', () => {
  it('adds the voice allowance in seconds without changing the message fields', async () => {
    mocked(quota.getVoiceQuota).mockResolvedValue(QUOTA(95));
    const res = await fetch(`${baseUrl}/chat/limit`, { headers: { 'x-test-user': 'user_1' } });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      remaining: 7,
      used: 3,
      limit: 10,
      unlimited: false,
      voiceRemainingSeconds: 95,
      voiceLimitSeconds: 150,
      voiceResetAt: '2026-10-14T10:00:00.000Z',
    });
    expect(body.resetAt).toBeDefined();
    expect(body.voiceRemaining).toBeUndefined();
  });

  it('still answers when the voice quota lookup fails', async () => {
    mocked(quota.getVoiceQuota).mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/chat/limit`, { headers: { 'x-test-user': 'user_1' } });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.remaining).toBe(7);
    expect(body.voiceRemainingSeconds).toBeUndefined();
  });
});
