/**
 * Long-term Redis cache for resolved quiz image URLs.
 * Priority in enricher: cached URL → apiId lookup → fuzzy search.
 */

import { redisCacheService } from './redis-cache.service';
import { logger } from '../utils/logger';

const QUIZ_IMAGE_CACHE_NS = 'quiz:image:';
/** 7 days — images rarely change mid-season. */
const QUIZ_IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(kind: string, apiId: number): string {
  return `${QUIZ_IMAGE_CACHE_NS}${kind}:${apiId}`;
}

export async function getCachedQuizImageUrl(
  kind: 'player' | 'team' | 'venue' | 'league',
  apiId: number,
): Promise<string | null> {
  if (!apiId) return null;
  try {
    const url = await redisCacheService.get<string>(cacheKey(kind, apiId));
    return typeof url === 'string' && url.trim() ? url.trim() : null;
  } catch (err) {
    logger.warn(`[QuizImageCache] read failed ${kind}:${apiId}`, err);
    return null;
  }
}

export async function setCachedQuizImageUrl(
  kind: 'player' | 'team' | 'venue' | 'league',
  apiId: number,
  imageUrl: string,
): Promise<void> {
  if (!apiId || !imageUrl?.trim()) return;
  try {
    await redisCacheService.set(cacheKey(kind, apiId), imageUrl.trim(), QUIZ_IMAGE_CACHE_TTL_MS);
  } catch (err) {
    logger.warn(`[QuizImageCache] write failed ${kind}:${apiId}`, err);
  }
}
