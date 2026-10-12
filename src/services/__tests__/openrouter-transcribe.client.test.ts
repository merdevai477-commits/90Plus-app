import {
  audioFormatForMime,
  isOpenRouterTranscribeConfigured,
  transcribeAudioWithOpenRouter,
} from '../openrouter-transcribe.client';
import { cleanTranscript } from '../gemini-text.client';

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const ENV_KEYS = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_TRANSCRIBE_API_KEY',
  'OPENROUTER_TRANSCRIBE_MODEL',
  'OPENROUTER_TRANSCRIBE_FALLBACK_MODEL',
  'OPENROUTER_TRANSCRIBE_ENABLED',
  'OPENROUTER_BASE_URL',
] as const;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('openrouter-transcribe.client', () => {
  const saved: Record<string, string | undefined> = {};
  const fetchMock = jest.fn();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('is configured by either key and can be switched off', () => {
    expect(isOpenRouterTranscribeConfigured()).toBe(false);
    process.env.OPENROUTER_API_KEY = 'shared';
    expect(isOpenRouterTranscribeConfigured()).toBe(true);
    process.env.OPENROUTER_TRANSCRIBE_ENABLED = 'false';
    expect(isOpenRouterTranscribeConfigured()).toBe(false);
  });

  it('maps the formats the app records', () => {
    expect(audioFormatForMime('audio/aac')).toBe('aac');
    expect(audioFormatForMime('audio/wav')).toBe('wav');
    expect(audioFormatForMime('audio/mp4')).toBe('m4a');
    expect(audioFormatForMime('audio/webm')).toBeNull();
  });

  it('sends input_audio to flash-lite with the dedicated key', async () => {
    process.env.OPENROUTER_API_KEY = 'shared';
    process.env.OPENROUTER_TRANSCRIBE_API_KEY = 'voice-only';
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { choices: [{ message: { content: '"مين جاب الجول؟"' } }] }),
    );

    const result = await transcribeAudioWithOpenRouter({
      audio: Buffer.from('abc'),
      mimeType: 'audio/aac',
      language: 'ar',
    });

    expect(result).toEqual({ text: 'مين جاب الجول؟', model: 'google/gemini-2.5-flash-lite' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer voice-only');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('google/gemini-2.5-flash-lite');
    expect(body.temperature).toBe(0);
    expect(body.messages[0].content[1]).toEqual({
      type: 'input_audio',
      input_audio: { data: Buffer.from('abc').toString('base64'), format: 'aac' },
    });
  });

  it('falls back to the second model on a transient error', async () => {
    process.env.OPENROUTER_API_KEY = 'k';
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'overloaded' } }))
      .mockResolvedValueOnce(jsonResponse(200, { choices: [{ message: { content: 'hello' } }] }));

    const result = await transcribeAudioWithOpenRouter({ audio: Buffer.from('a'), mimeType: 'audio/wav' });

    expect(result).toEqual({ text: 'hello', model: 'google/gemini-2.5-flash' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry another model when the key or credits are bad', async () => {
    process.env.OPENROUTER_API_KEY = 'k';
    fetchMock.mockResolvedValue(jsonResponse(402, { error: { message: 'Insufficient credits' } }));

    await expect(
      transcribeAudioWithOpenRouter({ audio: Buffer.from('a'), mimeType: 'audio/wav' }),
    ).rejects.toThrow(/402/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('cleanTranscript', () => {
  it('strips labels, wrapping quotes and non-speech markers', () => {
    expect(cleanTranscript('Transcript: "Who scored?"')).toBe('Who scored?');
    expect(cleanTranscript('  «مين جاب الجول»  ')).toBe('مين جاب الجول');
    expect(cleanTranscript('[silence]')).toBe('');
    expect(cleanTranscript('(no speech)')).toBe('');
    expect(cleanTranscript('Salah (Liverpool) scored')).toBe('Salah (Liverpool) scored');
  });
});
