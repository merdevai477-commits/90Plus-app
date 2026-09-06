/**
 * API-Football daily quota guard (P0-1).
 *
 * Persists counters in Redis so Railway redeploys cannot reset the budget.
 * Fail-closed when Redis is unavailable (an uncounted call risks the key).
 *
 * Allowlist model: high-frequency jobs (live-sync, calendar, warmup) are barred.
 * The 98/day budget is reserved for finished-match verify, user reads, and
 * last-resort 365Scores failure rescue (`fallback`).
 */

import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import type { FootballApiCallSource } from '../utils/football-metrics';

/** Why this call wants to spend API-Football quota. */
export type ApiFootballQuotaPurpose =
  | 'verify-finished'
  | 'user'
  | 'fallback'
  | 'live-sync'
  | 'calendar-sync'
  | 'warmup'
  | 'probe-kickoff'
  | 'job'
  | 'internal'
  | 'unknown';

/** Last-resort 365 outage / miss — counts against the 98 daily pool, not the job cap. */
export const API_FOOTBALL_FALLBACK_CALL = {
  source: 'internal' as const,
  purpose: 'fallback' as const,
};

export const API_FOOTBALL_DAILY_LIMIT = 98;
export const API_FOOTBALL_JOB_LIMIT = 20;
/** Warn once when remaining drops to this many (or fewer). */
const APPROACHING_THRESHOLD = 80;
const QUOTA_KEY_TTL_SEC = 26 * 60 * 60;

/** Purposes that may spend any of the 98 daily requests. */
const ALLOWED_PURPOSES: ReadonlySet<ApiFootballQuotaPurpose> = new Set([
  'verify-finished',
  'user',
  'fallback',
]);

let warnedApproachingDay: string | null = null;
let warnedExhaustedDay: string | null = null;
let warnedJobExhaustedDay: string | null = null;

function utcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnight(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}

function globalKey(day = utcDateKey()): string {
  return `apifootball:quota:${day}`;
}

function jobKey(day = utcDateKey()): string {
  return `apifootball:quota:job:${day}`;
}

function isJobPurpose(purpose: ApiFootballQuotaPurpose): boolean {
  return (
    purpose === 'verify-finished' ||
    purpose === 'live-sync' ||
    purpose === 'calendar-sync' ||
    purpose === 'warmup' ||
    purpose === 'probe-kickoff' ||
    purpose === 'job'
  );
}

export function resolveQuotaPurpose(
  source: FootballApiCallSource | undefined,
  purpose?: ApiFootballQuotaPurpose,
): ApiFootballQuotaPurpose {
  if (purpose) return purpose;
  if (source === 'user') return 'user';
  if (source === 'job') return 'job';
  if (source === 'internal') return 'internal';
  return 'unknown';
}

async function readCounter(key: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;
  const raw = await redis.get(key);
  const n = raw == null ? 0 : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type ApiFootballQuotaStatus = {
  used: number;
  remaining: number;
  jobUsed: number;
  jobRemaining: number;
  dailyLimit: number;
  jobLimit: number;
  resetAt: Date;
  day: string;
  redisAvailable: boolean;
  status: 'active' | 'quota_exhausted' | 'suspended' | 'disabled';
};

/** Sync allowlist check (no Redis). Use for early job short-circuits. */
export function isPurposeAllowed(purpose: ApiFootballQuotaPurpose): boolean {
  return ALLOWED_PURPOSES.has(purpose);
}

/**
 * Check whether an outbound API-Football call is allowed.
 * Does NOT increment — call recordApiFootballCall only after dispatch.
 */
export async function canCallApiFootball(
  purpose: ApiFootballQuotaPurpose = 'unknown',
): Promise<boolean> {
  const day = utcDateKey();
  const redis = getRedisClient();

  if (!redis) {
    logger.info('[QuotaGuard] deny — Redis unavailable (fail-closed)', {
      purpose,
      day,
    });
    return false;
  }

  if (!isPurposeAllowed(purpose)) {
    // High-frequency barred purposes: debug only to avoid log storms.
    logger.debug('[QuotaGuard] deny — purpose not on allowlist', {
      purpose,
      day,
    });
    return false;
  }

  try {
    const used = await readCounter(globalKey(day));
    const jobUsed = isJobPurpose(purpose) ? await readCounter(jobKey(day)) : 0;

    if (used >= API_FOOTBALL_DAILY_LIMIT) {
      if (warnedExhaustedDay !== day) {
        warnedExhaustedDay = day;
        logger.warn('[QuotaGuard] API-Football daily budget exhausted', {
          purpose,
          used,
          dailyLimit: API_FOOTBALL_DAILY_LIMIT,
          day,
        });
      } else {
        logger.info('[QuotaGuard] deny — daily budget exhausted', {
          purpose,
          used,
          remaining: 0,
          day,
        });
      }
      return false;
    }

    if (isJobPurpose(purpose) && jobUsed >= API_FOOTBALL_JOB_LIMIT) {
      if (warnedJobExhaustedDay !== day) {
        warnedJobExhaustedDay = day;
        logger.warn('[QuotaGuard] API-Football job sub-budget exhausted', {
          purpose,
          jobUsed,
          jobLimit: API_FOOTBALL_JOB_LIMIT,
          used,
          day,
        });
      } else {
        logger.info('[QuotaGuard] deny — job sub-budget exhausted', {
          purpose,
          jobUsed,
          used,
          day,
        });
      }
      return false;
    }

    logger.info('[QuotaGuard] allow', {
      purpose,
      used,
      remaining: API_FOOTBALL_DAILY_LIMIT - used,
      jobUsed: isJobPurpose(purpose) ? jobUsed : undefined,
      day,
    });
    return true;
  } catch (err) {
    logger.warn('[QuotaGuard] deny — Redis read failed (fail-closed)', {
      purpose,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Increment counters after an outbound call was actually dispatched.
 * Returns the new global used count (0 if Redis unavailable).
 */
export async function recordApiFootballCall(
  purpose: ApiFootballQuotaPurpose = 'unknown',
): Promise<number> {
  const redis = getRedisClient();
  const day = utcDateKey();
  if (!redis) return 0;

  try {
    const gKey = globalKey(day);
    const used = await redis.incr(gKey);
    if (used === 1) {
      await redis.expire(gKey, QUOTA_KEY_TTL_SEC);
    }

    if (isJobPurpose(purpose)) {
      const jKey = jobKey(day);
      const jobUsed = await redis.incr(jKey);
      if (jobUsed === 1) {
        await redis.expire(jKey, QUOTA_KEY_TTL_SEC);
      }
    }

    if (used >= APPROACHING_THRESHOLD && warnedApproachingDay !== day) {
      warnedApproachingDay = day;
      logger.warn('[QuotaGuard] approaching daily API-Football budget', {
        used,
        dailyLimit: API_FOOTBALL_DAILY_LIMIT,
        remaining: Math.max(0, API_FOOTBALL_DAILY_LIMIT - used),
        purpose,
        day,
      });
    }

    if (used >= API_FOOTBALL_DAILY_LIMIT && warnedExhaustedDay !== day) {
      warnedExhaustedDay = day;
      logger.warn('[QuotaGuard] API-Football daily budget hit', {
        purpose,
        used,
        dailyLimit: API_FOOTBALL_DAILY_LIMIT,
        day,
      });
    }

    return used;
  } catch (err) {
    logger.warn('[QuotaGuard] record failed', {
      purpose,
      message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Align Redis counter with the provider's remaining header when present.
 * Provider remaining = limit - used_on_provider_side; we store our own used.
 * If the provider reports fewer remaining than our counter implies, bump ours up.
 */
export async function reconcileFromProviderRemaining(
  remainingHeader: string | null,
  providerDailyLimit = 100,
): Promise<void> {
  if (remainingHeader == null || remainingHeader === '') return;
  const remaining = parseInt(remainingHeader, 10);
  if (!Number.isFinite(remaining) || remaining < 0) return;

  const redis = getRedisClient();
  if (!redis) return;

  const day = utcDateKey();
  const gKey = globalKey(day);
  try {
    const providerUsed = Math.max(0, providerDailyLimit - remaining);
    const ourUsed = await readCounter(gKey);
    if (providerUsed > ourUsed) {
      await redis.set(gKey, String(providerUsed), 'EX', QUOTA_KEY_TTL_SEC);
      logger.info('[QuotaGuard] reconciled counter from provider header', {
        previous: ourUsed,
        providerUsed,
        remaining,
        day,
      });
    }
  } catch (err) {
    logger.warn('[QuotaGuard] reconcile failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getQuotaStatus(
  suspendedUntil = 0,
): Promise<ApiFootballQuotaStatus> {
  const day = utcDateKey();
  const resetAt = nextUtcMidnight();
  const redis = getRedisClient();
  const redisAvailable = !!redis;

  let used = 0;
  let jobUsed = 0;
  if (redis) {
    try {
      used = await readCounter(globalKey(day));
      jobUsed = await readCounter(jobKey(day));
    } catch {
      // keep zeros
    }
  }

  let status: ApiFootballQuotaStatus['status'] = 'active';
  if (!redisAvailable) {
    status = 'disabled';
  } else if (Date.now() < suspendedUntil) {
    status = 'suspended';
  } else if (used >= API_FOOTBALL_DAILY_LIMIT) {
    status = 'quota_exhausted';
  }

  return {
    used,
    remaining: Math.max(0, API_FOOTBALL_DAILY_LIMIT - used),
    jobUsed,
    jobRemaining: Math.max(0, API_FOOTBALL_JOB_LIMIT - jobUsed),
    dailyLimit: API_FOOTBALL_DAILY_LIMIT,
    jobLimit: API_FOOTBALL_JOB_LIMIT,
    resetAt,
    day,
    redisAvailable,
    status,
  };
}

/** Test helper — reset in-process warn latches. */
export function __resetQuotaWarnLatchesForTests(): void {
  warnedApproachingDay = null;
  warnedExhaustedDay = null;
  warnedJobExhaustedDay = null;
}
