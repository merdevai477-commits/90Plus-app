/**
 * Football name translation — batch EN→AR with persistent cache.
 *
 * Priority:
 *  1. Redis / in-memory cache (shared across users)
 *  2. OpenRouter (fast model) for batches
 *  3. MyMemory free API as last resort
 */

import crypto from 'crypto';
import OpenAI from 'openai';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';
import {
  getCuratedArabicLeagueName,
  isAmbiguousLeagueName,
} from '../data/league-translations';

const CACHE_PREFIX = 'ft:en:ar:';
const CACHE_TTL_SEC = 90 * 24 * 60 * 60; // 90 days
const BATCH_SIZE = 60;
const MAX_TEXTS_PER_REQUEST = 200;

const memoryCache = new Map<string, string>();

function cacheKey(text: string): string {
  const hash = crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex').slice(0, 32);
  return `${CACHE_PREFIX}${hash}`;
}

async function readCache(text: string): Promise<string | null> {
  const key = cacheKey(text);
  const mem = memoryCache.get(key);
  if (mem) return mem;

  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    try {
      const val = await redis.get(key);
      if (val) {
        memoryCache.set(key, val);
        return val;
      }
    } catch (err) {
      logger.warn('football-translation Redis read failed:', err);
    }
  }
  return null;
}

async function writeCache(source: string, translated: string): Promise<void> {
  const key = cacheKey(source);
  memoryCache.set(key, translated);

  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    try {
      await redis.setex(key, CACHE_TTL_SEC, translated);
    } catch (err) {
      logger.warn('football-translation Redis write failed:', err);
    }
  }
}

function buildOpenRouterClient(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  if (!apiKey) return null;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ??
    process.env.AI_BASE_URL ??
    'https://openrouter.ai/api/v1';
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      'HTTP-Referer': 'https://90plus.pro',
      'X-Title': '90Plus Football Names',
    },
  });
}

async function translateBatchWithOpenRouter(texts: string[]): Promise<Record<string, string>> {
  const client = buildOpenRouterClient();
  if (!client) return {};

  const model =
    process.env.OPENROUTER_TRANSLATE_MODEL ??
    process.env.OPENROUTER_CHAT_MODEL ??
    'google/gemini-2.5-flash';

  const listJson = JSON.stringify(texts);
  const system = `You translate football team, league, and country names from English to Arabic.
Rules:
- Return ONLY valid JSON: an object whose keys are the EXACT input strings and values are Arabic names.
- Use names Arabic-speaking football fans actually use (e.g. Manchester United → مانشستر يونايتد).
- Do NOT translate abbreviations inside names unless standard in Arabic.
- Keep JSON keys identical to inputs (case-sensitive).`;

  const user = `Translate each name to Arabic:\n${listJson}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const map =
      (parsed.translations as Record<string, string> | undefined) ??
      (parsed.names as Record<string, string> | undefined) ??
      (parsed as Record<string, string>);
    const out: Record<string, string> = {};
    for (const text of texts) {
      const val = map[text] ?? map[text.toLowerCase()];
      if (typeof val === 'string' && val.trim()) {
        out[text] = val.trim();
      }
    }
    return out;
  } catch (err) {
    logger.warn('football-translation OpenRouter batch failed:', err);
    return {};
  }
}

async function translateOneMyMemory(text: string): Promise<string | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    const translated = data.responseData?.translatedText?.trim();
    if (!translated || translated.toUpperCase() === text.toUpperCase()) return null;
    return translated;
  } catch {
    return null;
  }
}

async function translateMissing(texts: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    const fromAi = await translateBatchWithOpenRouter(chunk);
    for (const text of chunk) {
      if (fromAi[text]) {
        result[text] = fromAi[text];
        continue;
      }
      const fromMem = await translateOneMyMemory(text);
      if (fromMem) result[text] = fromMem;
    }
  }

  return result;
}

export async function translateFootballNames(
  texts: string[],
  targetLang: 'ar' | 'en' = 'ar',
): Promise<Record<string, string>> {
  if (targetLang !== 'ar') {
    const identity: Record<string, string> = {};
    for (const t of texts) identity[t] = t;
    return identity;
  }

  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TEXTS_PER_REQUEST);
  const output: Record<string, string> = {};
  const missing: string[] = [];

  for (const text of unique) {
    const curated = getCuratedArabicLeagueName(text);
    if (curated) {
      output[text] = curated;
      continue;
    }

    if (isAmbiguousLeagueName(text)) {
      output[text] = text;
      continue;
    }

    const cached = await readCache(text);
    if (cached) {
      output[text] = cached;
    } else {
      missing.push(text);
    }
  }

  if (missing.length === 0) return output;

  const fresh = await translateMissing(missing);
  for (const text of missing) {
    const translated = fresh[text] ?? text;
    output[text] = translated;
    if (translated !== text) {
      await writeCache(text, translated);
    }
  }

  return output;
}
