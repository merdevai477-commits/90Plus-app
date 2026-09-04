import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import { FOOTBALL_EMPTY_UPSTREAM_STREAK_KEY_PREFIX } from '../utils/football-cache-keys.util';

/** Live-window TTL for empty streak state (6h). */
export const EMPTY_UPSTREAM_STREAK_TTL_SEC = 6 * 60 * 60;

/** Base retry interval after first empty result. */
export const EMPTY_UPSTREAM_BASE_BACKOFF_MS = 60_000;

/** Maximum backoff between empty upstream polls. */
export const EMPTY_UPSTREAM_MAX_BACKOFF_MS = 300_000;

export type EmptyUpstreamStreakState = {
  streak: number;
  nextAllowedAt: number;
};

export function emptyUpstreamStreakKey(fixtureId: number): string {
  return `${FOOTBALL_EMPTY_UPSTREAM_STREAK_KEY_PREFIX}${fixtureId}`;
}

/** Stepped exponential: 60s → 120s → 240s → cap 300s. */
export function computeEmptyUpstreamBackoffMs(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 0) return EMPTY_UPSTREAM_BASE_BACKOFF_MS;
  const stepped = EMPTY_UPSTREAM_BASE_BACKOFF_MS * 2 ** (streak - 1);
  return Math.min(stepped, EMPTY_UPSTREAM_MAX_BACKOFF_MS);
}

function parseStreakState(raw: string | null): EmptyUpstreamStreakState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EmptyUpstreamStreakState>;
    const streak = Number(parsed.streak);
    const nextAllowedAt = Number(parsed.nextAllowedAt);
    if (!Number.isFinite(streak) || streak < 0 || !Number.isFinite(nextAllowedAt)) return null;
    return { streak, nextAllowedAt };
  } catch {
    return null;
  }
}

export async function readEmptyUpstreamStreak(
  fixtureId: number,
): Promise<EmptyUpstreamStreakState | null> {
  const redis = getRedisClient();
  if (!redis || !Number.isFinite(fixtureId)) return null;
  try {
    return parseStreakState(await redis.get(emptyUpstreamStreakKey(fixtureId)));
  } catch {
    return null;
  }
}

/**
 * When Redis is unavailable, fail open (do not skip) so live fixtures stay responsive.
 */
export async function shouldSkipEmptyUpstreamPoll(
  fixtureId: number,
): Promise<{ skip: boolean; streak?: number; nextRetryInMs?: number }> {
  const state = await readEmptyUpstreamStreak(fixtureId);
  if (!state || state.streak <= 0) return { skip: false };

  const now = Date.now();
  if (now >= state.nextAllowedAt) return { skip: false, streak: state.streak };

  const nextRetryInMs = Math.max(0, state.nextAllowedAt - now);
  // Fires on every poll of a quiet fixture (~3/s in production); not worth info level.
  logger.debug(
    `[EmptyBackoff] fixture=${fixtureId} streak=${state.streak} nextRetryInMs=${nextRetryInMs} action=skip`,
  );
  return { skip: true, streak: state.streak, nextRetryInMs };
}

export async function recordEmptyUpstreamResult(
  fixtureId: number,
): Promise<{ streak: number; nextBackoffMs: number }> {
  const redis = getRedisClient();
  const prev = (await readEmptyUpstreamStreak(fixtureId))?.streak ?? 0;
  const streak = prev + 1;
  const nextBackoffMs = computeEmptyUpstreamBackoffMs(streak);
  const nextAllowedAt = Date.now() + nextBackoffMs;

  logger.info(
    `[EmptyBackoff] fixture=${fixtureId} streak=${streak} nextRetryInMs=${nextBackoffMs} action=empty`,
  );

  if (redis && Number.isFinite(fixtureId)) {
    try {
      const payload: EmptyUpstreamStreakState = { streak, nextAllowedAt };
      await redis.set(
        emptyUpstreamStreakKey(fixtureId),
        JSON.stringify(payload),
        'EX',
        EMPTY_UPSTREAM_STREAK_TTL_SEC,
      );
    } catch (err) {
      logger.warn(`[EmptyBackoff] failed to persist streak for fixture=${fixtureId}:`, err);
    }
  }

  return { streak, nextBackoffMs };
}

export async function recordNonEmptyUpstreamResult(fixtureId: number): Promise<void> {
  await clearEmptyUpstreamBackoff(fixtureId);
}

export async function clearEmptyUpstreamBackoff(fixtureId: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !Number.isFinite(fixtureId)) return;
  try {
    await redis.del(emptyUpstreamStreakKey(fixtureId));
  } catch (err) {
    logger.warn(`[EmptyBackoff] failed to clear streak for fixture=${fixtureId}:`, err);
  }
}

/** Test-only reset for in-memory/redis fake isolation. */
export function __resetEmptyUpstreamBackoffForTests(): void {
  // no module-level state; hook for symmetry with quota tests
}
