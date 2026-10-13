/**
 * POST /api/chat/transcribe and GET /api/chat/limit over real HTTP, with the
 * speech providers and quota storage mocked (no provider credits are spent).
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
  getVoiceQuota: jest.fn(),
  getVoiceQuotaConfig: () => ({ dailyLimit: 5, maxSeconds: 30, serverMaxSeconds: 35, reservationTtlMs: 120000 }),
  reserveVoiceUnit: jest.fn(),
  commitVoiceUnit: jest.fn(async () => true),
  releaseVoiceUnit: jest.fn(async () => true),
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
  const dataBytes = Math.round(seconds * 16000 * 2);
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

const QUOTA = (remaining: number) => ({
  limit: 5,
  remaining,
  used: 5 - remaining,
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
  mocked(quota.getVoiceQuota).mockResolvedValue(QUOTA(3));
  mocked(quota.reserveVoiceUnit).mockResolvedValue({
    kind: 'reserved',
    operationId: 'op-1',
    attempt: 1,
    quota: QUOTA(2),
  });
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
  it('returns the transcript, commits one unit and never touches the message quota', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: ' مرحبا ', model: 'm' });
    const { status, body } = await transcribe(wav(3), { 'Idempotency-Key': 'voice-abc12345' });

    expect(status).toBe(200);
    expect(body).toMatchObject({ text: 'مرحبا', voiceRemaining: 2, voiceLimit: 5 });
    expect(quota.reserveVoiceUnit).toHaveBeenCalledWith('user_1', 'voice-abc12345');
    expect(quota.commitVoiceUnit).toHaveBeenCalledWith('op-1', 1, 'مرحبا');
    expect(quota.releaseVoiceUnit).not.toHaveBeenCalled();
    expect(chatService.incrementLimit).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'audio/wav', language: 'ar' }),
    );
  });

  it('an empty transcript releases the unit and keeps the legacy 200 + empty text contract', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: '', model: 'm' });
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(200);
    expect(body).toMatchObject({ text: '', code: 'VOICE_EMPTY', voiceRemaining: 3 });
    expect(quota.releaseVoiceUnit).toHaveBeenCalledWith('op-1', 1, 'empty_transcript');
    expect(quota.commitVoiceUnit).not.toHaveBeenCalled();
  });

  it('a provider failure releases the unit', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockRejectedValue(new Error('OpenRouter HTTP 500'));
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(502);
    expect(body.code).toBe('VOICE_PROVIDER_FAILED');
    expect(quota.releaseVoiceUnit).toHaveBeenCalledWith('op-1', 1, 'provider_failed');
    expect(quota.commitVoiceUnit).not.toHaveBeenCalled();
  });

  it('a provider timeout is recorded as ambiguous and not retried elsewhere', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    mocked(openrouter.transcribeAudioWithOpenRouter).mockRejectedValue(timeout);
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(504);
    expect(body.code).toBe('VOICE_PROVIDER_TIMEOUT');
    expect(quota.markVoiceTimedOut).toHaveBeenCalledWith('op-1', 1);
    expect(quota.releaseVoiceUnit).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).toHaveBeenCalledTimes(1);
  });

  it('zero voice quota never reaches the provider', async () => {
    mocked(quota.getVoiceQuota).mockResolvedValue(QUOTA(0));
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(429);
    expect(body).toMatchObject({ code: 'VOICE_QUOTA_EXHAUSTED', voiceRemaining: 0, voiceLimit: 5 });
    expect(quota.reserveVoiceUnit).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('losing the reservation race never reaches the provider', async () => {
    mocked(quota.reserveVoiceUnit).mockResolvedValue({ kind: 'exhausted', quota: QUOTA(0) });
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(429);
    expect(body.code).toBe('VOICE_QUOTA_EXHAUSTED');
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('an exhausted message quota never reaches the provider', async () => {
    mocked(chatService.getRemaining).mockResolvedValue(0);
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(429);
    expect(body.code).toBe('MESSAGE_QUOTA_EXHAUSTED');
    expect(quota.reserveVoiceUnit).not.toHaveBeenCalled();
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('audio past the server duration cap is refused before reserving', async () => {
    const { status, body } = await transcribe(wav(40));

    expect(status).toBe(413);
    expect(body).toMatchObject({ code: 'VOICE_AUDIO_TOO_LONG', maxSeconds: 35 });
    expect(quota.reserveVoiceUnit).not.toHaveBeenCalled();
  });

  it('non-audio bytes are refused before reserving, whatever the filename claims', async () => {
    const { status, body } = await transcribe(Buffer.from('definitely not a wav file'));

    expect(status).toBe(415);
    expect(body.code).toBe('VOICE_AUDIO_INVALID');
    expect(quota.reserveVoiceUnit).not.toHaveBeenCalled();
  });

  it('a missing file is a 400 with a code', async () => {
    const { status, body } = await transcribe(null);
    expect(status).toBe(400);
    expect(body.code).toBe('VOICE_AUDIO_INVALID');
  });

  it('a replayed idempotency key returns the stored transcript without calling the provider', async () => {
    mocked(quota.reserveVoiceUnit).mockResolvedValue({ kind: 'cached', transcript: 'نص محفوظ', quota: QUOTA(2) });
    const { status, body } = await transcribe(wav(3), { 'Idempotency-Key': 'voice-replay123' });

    expect(status).toBe(200);
    expect(body).toMatchObject({ text: 'نص محفوظ', voiceRemaining: 2 });
    expect(openrouter.transcribeAudioWithOpenRouter).not.toHaveBeenCalled();
  });

  it('a key that is still in flight gets 409', async () => {
    mocked(quota.reserveVoiceUnit).mockResolvedValue({ kind: 'in_progress', quota: QUOTA(2) });
    const { status, body } = await transcribe(wav(3), { 'Idempotency-Key': 'voice-inflight1' });
    expect(status).toBe(409);
    expect(body.code).toBe('VOICE_IN_PROGRESS');
  });

  it('older clients (no idempotency key) still get a fresh server key and a text field', async () => {
    mocked(openrouter.transcribeAudioWithOpenRouter).mockResolvedValue({ text: 'hi', model: 'm' });
    const { status, body } = await transcribe(wav(3));

    expect(status).toBe(200);
    expect(body.text).toBe('hi');
    expect(mocked(quota.reserveVoiceUnit).mock.calls[0][1]).toMatch(/^srv-/);
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
    expect(quota.reserveVoiceUnit).not.toHaveBeenCalled();
  });
});

describe('GET /chat/limit', () => {
  it('adds voice fields without changing the existing ones', async () => {
    const res = await fetch(`${baseUrl}/chat/limit`, { headers: { 'x-test-user': 'user_1' } });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      remaining: 7,
      used: 3,
      limit: 10,
      unlimited: false,
      voiceRemaining: 3,
      voiceLimit: 5,
      voiceResetAt: '2026-10-14T10:00:00.000Z',
    });
    expect(body.resetAt).toBeDefined();
  });

  it('still answers when the voice quota lookup fails', async () => {
    mocked(quota.getVoiceQuota).mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/chat/limit`, { headers: { 'x-test-user': 'user_1' } });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.remaining).toBe(7);
    expect(body.voiceRemaining).toBeUndefined();
  });
});
