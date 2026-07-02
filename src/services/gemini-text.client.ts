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
        // Transient upstream errors (503/5xx/429): try the fallback model before failing.
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
