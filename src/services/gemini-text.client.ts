/**
 * Google Gemini non-streaming text/JSON generation (quiz, translation, etc.).
 * Native API with x-goog-api-key — supports AQ.* auth keys.
 */

function resolveGeminiQuizApiKey(): string | null {
  return (
    process.env.GEMINI_QUIZ_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    null
  );
}

function resolveGeminiBaseUrl(): string {
  return (
    process.env.GEMINI_BASE_URL?.trim() ||
    'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/$/, '');
}

export function resolveGeminiQuizModel(): string {
  return (
    process.env.GEMINI_QUIZ_MODEL?.trim() ||
    process.env.GEMINI_CHAT_MODEL?.trim() ||
    'gemini-3-flash-preview'
  );
}

export function resolveGeminiQuizFallbackModel(): string {
  return (
    process.env.GEMINI_QUIZ_FALLBACK_MODEL?.trim() ||
    process.env.GEMINI_CHAT_FALLBACK_MODEL?.trim() ||
    'gemini-3.5-flash'
  );
}

export function isGeminiQuizConfigured(): boolean {
  const provider = (
    process.env.QUIZ_AI_PROVIDER ??
    process.env.AI_QUIZ_PROVIDER ??
    'gemini'
  )
    .trim()
    .toLowerCase();
  if (provider === 'openrouter') return false;
  return !!resolveGeminiQuizApiKey();
}

/**
 * Per-request wall-clock cap for a single Gemini call. Kept well below the
 * pack-generation budget so a slow/hung model can't stall quiz generation.
 * Override with GEMINI_QUIZ_TIMEOUT_MS.
 */
export function resolveGeminiQuizTimeoutMs(): number {
  const raw = process.env.GEMINI_QUIZ_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 10_000) return n;
  }
  return 60_000;
}

/** HTTP statuses worth retrying on the fallback model (transient upstream). */
function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Skip Gemini quiz calls while free-tier / daily quota is exhausted. */
let geminiQuizCooldownUntilMs = 0;
const GEMINI_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;

export function isGeminiQuizInCooldown(): boolean {
  return Date.now() < geminiQuizCooldownUntilMs;
}

export function getGeminiQuizCooldownRemainingMs(): number {
  return Math.max(0, geminiQuizCooldownUntilMs - Date.now());
}

function markGeminiQuizQuotaCooldown(reason: string): void {
  const until = Date.now() + GEMINI_QUOTA_COOLDOWN_MS;
  // Only extend / announce when entering a fresh cooldown window.
  if (until > geminiQuizCooldownUntilMs + 1_000) {
    geminiQuizCooldownUntilMs = until;
    // Lazy require avoids a circular import with the logger at module load.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logger } = require('../utils/logger') as typeof import('../utils/logger');
      logger.warn('[Gemini] quiz quota cooldown — skipping Gemini for 15m', {
        reason: reason.slice(0, 160),
        until: new Date(until).toISOString(),
      });
    } catch {
      // ignore
    }
  } else {
    geminiQuizCooldownUntilMs = Math.max(geminiQuizCooldownUntilMs, until);
  }
}

function isGeminiQuotaExhaustedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  // Any 429 from Gemini quiz is treated as quota pressure — free tier is tiny (20/day).
  return /Gemini HTTP 429/i.test(msg);
}

/** Test-only. */
export function __resetGeminiQuizCooldownForTests(): void {
  geminiQuizCooldownUntilMs = 0;
}

export function isGeminiAudioConfigured(): boolean {
  return !!resolveGeminiQuizApiKey();
}

/** Thinking only adds latency to a verbatim transcript; the knob differs per model family. */
function minimalThinkingConfig(model: string): Record<string, unknown> | undefined {
  if (model.startsWith('gemini-3')) return { thinkingLevel: 'low' };
  if (model.includes('2.5-flash')) return { thinkingBudget: 0 };
  return undefined;
}

export interface GeminiTranscribeParams {
  audio: Buffer;
  mimeType: string;
  /** App language — biases the transcript script when speech is ambiguous. */
  language?: 'ar' | 'en';
}

/** Shared by every audio provider so transcripts read the same whichever one answers. */
export function buildTranscriptionInstruction(language?: 'ar' | 'en'): string {
  const languageHint =
    language === 'en'
      ? 'The speaker most likely speaks English.'
      : 'The speaker most likely speaks Arabic (often Egyptian dialect), possibly mixed with English football names.';
  return [
    'Transcribe this voice message verbatim, in the language and script it was spoken in.',
    languageHint,
    'It is a question for a football and sports-fitness assistant, so spell player, club and competition names correctly.',
    'Do not answer, summarize, translate or correct the speaker — only write down what was said.',
    'Output only the transcript text — no quotes, labels, timestamps or commentary.',
    'If there is no intelligible speech, output nothing.',
  ].join(' ');
}

const TRANSCRIPT_LABEL = /^(transcript(ion)?|النص|التفريغ)\s*[:：]\s*/i;
const WRAPPING_QUOTES = /^["'“”«»]+|["'“”«»]+$/g;
/** Models sometimes describe silence instead of returning nothing, e.g. "[silence]" or "(no speech)". */
const NON_SPEECH_ONLY = /^[[(][^\])]*[\])]$/;

export function cleanTranscript(raw: string): string {
  const text = raw.trim().replace(TRANSCRIPT_LABEL, '').replace(WRAPPING_QUOTES, '').trim();
  return NON_SPEECH_ONLY.test(text) ? '' : text;
}

/**
 * A timed-out request may still be processed (and billed) upstream, so
 * transcription never retries it on another model or provider.
 */
export function isTimeoutError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

export async function transcribeAudioWithGemini(
  params: GeminiTranscribeParams,
): Promise<{ text: string; model: string }> {
  const apiKey = resolveGeminiQuizApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured (GEMINI_API_KEY)');
  }

  const models = [
    process.env.GEMINI_TRANSCRIBE_MODEL?.trim(),
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    resolveGeminiQuizModel(),
  ].filter((m, i, all): m is string => !!m && all.indexOf(m) === i);

  const instruction = buildTranscriptionInstruction(params.language);

  const baseUrl = resolveGeminiBaseUrl();
  const audioBase64 = params.audio.toString('base64');
  let lastErr: Error | null = null;

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    const hasFallback = i < models.length - 1;
    const thinkingConfig = minimalThinkingConfig(model);
    try {
      const res = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: instruction },
                { inlineData: { mimeType: params.mimeType, data: audioBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
            ...(thinkingConfig ? { thinkingConfig } : {}),
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErr = new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
        if (hasFallback) continue;
        throw lastErr;
      }

      const payload = (await res.json()) as unknown;
      return { text: cleanTranscript(extractGeminiText(payload)), model };
    } catch (err: unknown) {
      if (isTimeoutError(err)) throw err;
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (hasFallback) continue;
      throw lastErr;
    }
  }

  throw lastErr ?? new Error('Gemini transcription failed');
}

export interface GeminiGenerateTextParams {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates) || !candidates.length) return '';
  const parts = (candidates[0] as { content?: { parts?: unknown[] } })?.content?.parts;
  if (!Array.isArray(parts)) return '';
  let out = '';
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const text = (part as { text?: string }).text;
    if (typeof text === 'string') out += text;
  }
  return out;
}

export async function generateGeminiText(
  params: GeminiGenerateTextParams,
): Promise<{ content: string; model: string }> {
  const apiKey = resolveGeminiQuizApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured (GEMINI_QUIZ_API_KEY / GEMINI_API_KEY)');
  }
  if (isGeminiQuizInCooldown()) {
    throw new Error(
      `Gemini quiz in quota cooldown (${Math.ceil(getGeminiQuizCooldownRemainingMs() / 1000)}s left)`,
    );
  }

  const primary = params.model ?? resolveGeminiQuizModel();
  const fallback = resolveGeminiQuizFallbackModel();
  const models = primary === fallback ? [primary] : [primary, fallback];

  const baseUrl = resolveGeminiBaseUrl();
  const timeoutMs = resolveGeminiQuizTimeoutMs();
  let lastErr: Error | null = null;

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    const hasFallback = i < models.length - 1;
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.system }] },
          contents: [{ role: 'user', parts: [{ text: params.user }] }],
          generationConfig: {
            temperature: params.temperature ?? 0.35,
            maxOutputTokens: params.maxOutputTokens ?? 12_000,
            ...(params.jsonMode !== false ? { responseMimeType: 'application/json' } : {}),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const err = new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 400)}`);
        if (res.status === 429) {
          markGeminiQuizQuotaCooldown(err.message);
          throw err; // don't burn the fallback model on the same exhausted quota
        }
        // Transient upstream errors (503/5xx): try the fallback model before failing.
        if (isRetryableGeminiStatus(res.status) && hasFallback) {
          lastErr = err;
          continue;
        }
        throw err;
      }

      const payload = (await res.json()) as unknown;
      const content = extractGeminiText(payload);
      if (!content.trim()) {
        throw new Error(`Gemini ${model} returned empty content`);
      }

      /*
       * A truncated answer is NOT a usable answer. Gemini 3 models spend part of
       * the same maxOutputTokens budget on reasoning (`thoughtsTokenCount`), so
       * a round that asks for a long JSON array can stop mid-structure and still
       * arrive as HTTP 200 with plenty of non-empty text — valid JSON prefix,
       * no closing brackets. Returning it made callers report the useless
       * "returned no usable JSON" with a preview that looks perfectly fine.
       * Detect it here, where the reason is actually known, and treat it like
       * any other retryable failure so the fallback model gets a turn.
       */
      const finishReason = (payload as { candidates?: Array<{ finishReason?: string }> })
        ?.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        const usage = (payload as { usageMetadata?: Record<string, number> })?.usageMetadata;
        const err = new Error(
          `Gemini ${model} hit MAX_TOKENS — output truncated ` +
            `(maxOutputTokens=${params.maxOutputTokens ?? 12_000}, ` +
            `thoughts=${usage?.thoughtsTokenCount ?? '?'}, ` +
            `candidates=${usage?.candidatesTokenCount ?? '?'})`,
        );
        if (hasFallback) {
          lastErr = err;
          continue;
        }
        throw err;
      }

      return { content, model };
    } catch (err: unknown) {
      // AbortError (timeout) and network failures also fall through to the
      // fallback model — a hung/slow primary model must never stall the pack.
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (hasFallback) continue;
      throw lastErr;
    }
  }

  throw lastErr ?? new Error('Gemini generateContent failed');
}
