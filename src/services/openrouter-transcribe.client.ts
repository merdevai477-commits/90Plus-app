/**
 * Voice → text through OpenRouter chat completions (`input_audio` content parts).
 * Default model is google/gemini-2.5-flash-lite — the cheapest audio-capable
 * Gemini on OpenRouter (~$0.0006 per minute of speech).
 */

import { logger } from '../utils/logger';
import { buildTranscriptionInstruction, cleanTranscript } from './gemini-text.client';

const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = 'google/gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 30_000;
/** A 60s voice memo is ~200 words; this leaves headroom without inviting rambling. */
const MAX_OUTPUT_TOKENS = 1024;

/** OpenRouter wants a format name, not a MIME type. */
const FORMAT_BY_MIME: Record<string, string> = {
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
};

function resolveApiKey(): string | null {
  return (
    process.env.OPENROUTER_TRANSCRIBE_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    null
  );
}

function resolveBaseUrl(): string {
  return (process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
}

function resolveModels(): string[] {
  return [
    process.env.OPENROUTER_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL,
    process.env.OPENROUTER_TRANSCRIBE_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL,
  ].filter((m, i, all) => !!m && all.indexOf(m) === i);
}

export function isOpenRouterTranscribeConfigured(): boolean {
  const disabled = process.env.OPENROUTER_TRANSCRIBE_ENABLED?.trim().toLowerCase() === 'false';
  return !disabled && !!resolveApiKey();
}

export function audioFormatForMime(mimeType: string): string | null {
  return FORMAT_BY_MIME[mimeType.toLowerCase()] ?? null;
}

/** Bad key, no credits or a malformed request fail the same way on every model, so stop early. */
function isFatalStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 402 || status === 403;
}

type ChatCompletionPayload = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number };
};

export interface OpenRouterTranscribeParams {
  audio: Buffer;
  mimeType: string;
  language?: 'ar' | 'en';
}

export async function transcribeAudioWithOpenRouter(
  params: OpenRouterTranscribeParams,
): Promise<{ text: string; model: string }> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured (OPENROUTER_API_KEY)');
  }
  const format = audioFormatForMime(params.mimeType);
  if (!format) {
    throw new Error(`Unsupported audio type for OpenRouter: ${params.mimeType}`);
  }

  const instruction = buildTranscriptionInstruction(params.language);
  const audioBase64 = params.audio.toString('base64');
  const models = resolveModels();
  let lastErr: Error | null = null;

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    const hasFallback = i < models.length - 1;
    const startedAt = Date.now();
    try {
      const res = await fetch(`${resolveBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://90plus.pro',
          'X-Title': '90Plus Voice Transcription',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: MAX_OUTPUT_TOKENS,
          usage: { include: true },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: instruction },
                { type: 'input_audio', input_audio: { data: audioBase64, format } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErr = new Error(`OpenRouter HTTP ${res.status} (${model}): ${errText.slice(0, 300)}`);
        if (isFatalStatus(res.status)) break;
        if (hasFallback) continue;
        throw lastErr;
      }

      const payload = (await res.json()) as ChatCompletionPayload;
      if (payload.error) {
        lastErr = new Error(`OpenRouter error (${model}): ${payload.error.message ?? 'unknown'}`);
        if (hasFallback) continue;
        throw lastErr;
      }

      const text = cleanTranscript(payload.choices?.[0]?.message?.content ?? '');
      logger.info(
        `[transcribe] openrouter model=${model} format=${format} bytes=${params.audio.length} ` +
          `ms=${Date.now() - startedAt} tokens=${payload.usage?.prompt_tokens ?? '?'}/${payload.usage?.completion_tokens ?? '?'} ` +
          `cost=${payload.usage?.cost ?? '?'}`,
      );
      return { text, model };
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (hasFallback) continue;
      throw lastErr;
    }
  }

  throw lastErr ?? new Error('OpenRouter transcription failed');
}
