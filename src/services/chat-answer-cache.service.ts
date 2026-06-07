/**
 * DB-backed cache for factual Captain AI answers (player stats, standings, top
 * scorers, etc.). Identical questions are served from Postgres instead of
 * re-calling the LLM, cutting cost and latency. Only data-backed answers are
 * cached — live scores and personalized chit-chat are never stored here.
 */

import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/** Lowercase, strip punctuation/diacritics noise, collapse whitespace. */
export function normalizeQuestion(message: string): string {
  return message
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic diacritics
    .replace(/[?!.,;:؟،"'«»()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function questionHash(language: string, message: string): string {
  return createHash('sha256')
    .update(`${language}|${normalizeQuestion(message)}`)
    .digest('hex');
}

export interface CachedAnswer {
  answer: string;
  usedModel: string | null;
}

/**
 * Return a cached answer when one exists and is still fresh. Increments the hit
 * counter best-effort. Returns null on miss, staleness, or any DB error.
 */
export async function getCachedAnswer(
  language: string,
  message: string,
  maxAgeMs: number,
): Promise<CachedAnswer | null> {
  try {
    const hash = questionHash(language, message);
    const row = await prisma.chatAnswerCache.findUnique({ where: { questionHash: hash } });
    if (!row) return null;

    const age = Date.now() - new Date(row.createdAt).getTime();
    if (age > maxAgeMs) return null;

    // Best-effort hit counter — never block the response on it.
    prisma.chatAnswerCache
      .update({ where: { questionHash: hash }, data: { hits: { increment: 1 } } })
      .catch(() => {});

    return { answer: row.answer, usedModel: row.usedModel ?? null };
  } catch (err) {
    logger.warn('[ChatAnswerCache] lookup failed:', err);
    return null;
  }
}

/**
 * Upsert a freshly generated factual answer. Refreshes `createdAt` so the TTL
 * restarts on each regeneration. Best-effort — failures are swallowed.
 */
export async function saveCachedAnswer(
  language: string,
  message: string,
  answer: string,
  usedModel: string | null,
): Promise<void> {
  if (!answer || answer.trim().length < 8) return;
  try {
    const hash = questionHash(language, message);
    await prisma.chatAnswerCache.upsert({
      where: { questionHash: hash },
      create: {
        questionHash: hash,
        language,
        question: message.slice(0, 2000),
        answer,
        usedModel,
      },
      update: {
        answer,
        usedModel,
        createdAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('[ChatAnswerCache] save failed:', err);
  }
}
