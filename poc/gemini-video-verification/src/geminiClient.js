import { GoogleGenAI } from '@google/genai';
import { requireGeminiApiKey, maskSecret } from './loadEnv.js';

export function createGeminiClient() {
  const apiKey = requireGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  return {
    ai,
    apiKeyPresent: true,
    apiKeyFingerprint: maskSecret(apiKey),
  };
}

/**
 * Retry wrapper for transient / rate-limit errors.
 * Does not log secrets.
 */
export async function withRetries(fn, { maxRetries = 2, label = 'request', onRetry } = {}) {
  let attempt = 0;
  let lastError;
  while (attempt <= maxRetries) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const status = error?.status ?? error?.code ?? null;
      const retriable =
        status === 429 ||
        status === 500 ||
        status === 503 ||
        /RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate/i.test(String(error?.message || ''));
      if (!retriable || attempt === maxRetries) break;
      attempt += 1;
      const delayMs = Math.min(8000, 500 * 2 ** attempt);
      onRetry?.({ attempt, delayMs, status, label });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export function extractHttpStatus(error) {
  if (!error) return null;
  if (typeof error.status === 'number') return error.status;
  if (typeof error.code === 'number') return error.code;
  const m = String(error.message || '').match(/\b(429|401|403|404|500|503)\b/);
  return m ? Number(m[1]) : null;
}

export function responseText(response) {
  if (!response) return '';
  if (typeof response.text === 'string') return response.text;
  if (typeof response.text === 'function') {
    try {
      return response.text() || '';
    } catch {
      /* fall through */
    }
  }
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('');
}
