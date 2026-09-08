/**
 * Pull-to-refresh coordinator (Railway multi-instance).
 *
 * - HTTP `?pull=1` bypasses the shared response cache so the client re-reads Redis.
 * - It MUST NOT set forceRefresh / fresh=1 (that path calls 365 directly).
 * - Always return the existing cache/DB bundle (HTTP 200). If the per-fixture
 *   interval has elapsed, one instance may schedule FootballDataCacheService's
 *   existing SWR refresh (buildFreshDetailsBundle, forceRefresh=false).
 * - Coalesce with Redis SET NX, not only in-process pending maps.
 * - Terminal latch + empty-upstream backoff stay in force — never schedule then.
 * - Abuse INCR per client+fixture; over limit still returns cache, skips schedule.
 */

import type { Request } from 'express';
import { TERMINAL_LATCH_STATUSES } from './match-cache.service';
import { isTerminalLatched } from './live-fixture-cache.service';
import { shouldSkipEmptyUpstreamPoll } from './empty-upstream-backoff.service';
import { footballDataCacheService } from './football-data-cache.service';
import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import { footballMetrics } from '../utils/football-metrics';
import { addBreadcrumb } from '../config/sentry.config';
import {
  footballPtrAbuseKey,
  footballPtrLastKey,
  footballPtrLockKey,
  footballPtrWaitersKey,
} from '../utils/football-cache-keys.util';
import {
  PTR_ABUSE_MAX,
  PTR_ABUSE_WINDOW_SEC,
  PTR_INTERVAL_IDLE_MS,
  fixtureUpdatedAtMs,
  pullRefreshClientKey,
  resolvePullIntervalMs,
  type PullRefreshOutcome,
  type PullRefreshResult,
} from '../utils/pull-refresh.util';

export {
  wantsPullRefresh,
  resolvePullIntervalMs,
  pullRefreshClientKey,
  PTR_INTERVAL_LIVE_ACTIVE_MS,
  PTR_INTERVAL_LIVE_IDLE_MS,
  PTR_INTERVAL_IDLE_MS,
} from '../utils/pull-refresh.util';

export async function noteListPullRefresh(req: Request): Promise<PullRefreshResult> {
  footballMetrics.recordPullRefresh('list');
  logger.info('[PTR] list pull', { client: pullRefreshClientKey(req) });
  return { outcome: 'list', intervalMs: PTR_INTERVAL_IDLE_MS, coalescedCount: 0 };
}

export async function noteFixturePullRefresh(options: {
  req: Request;
  fixtureId: number;
  statusShort?: string | null;
  fixture?: { fixture?: { date?: string | null }; updatedAt?: string | Date | null } | null;
  language?: string | null;
}): Promise<PullRefreshResult> {
  const { req, fixtureId, language } = options;
  const statusShort = options.statusShort ?? '';
  const intervalMs = resolvePullIntervalMs(
    statusShort,
    fixtureUpdatedAtMs(options.fixture ?? null),
  );
  const clientKey = pullRefreshClientKey(req);

  if (await isAbuseLimited(clientKey, fixtureId)) {
    footballMetrics.recordPullRefresh('rate_limited');
    logger.info('[PTR] rate_limited', { fixtureId, clientKey });
    return { outcome: 'rate_limited', intervalMs, coalescedCount: 0 };
  }

  if (TERMINAL_LATCH_STATUSES.includes(String(statusShort).toUpperCase())) {
    if (await isTerminalLatched(fixtureId)) {
      footballMetrics.recordPullRefresh('latched');
      logger.info('[PTR] latched', { fixtureId, statusShort });
      return { outcome: 'latched', intervalMs, coalescedCount: 0 };
    }
  }

  if (await shouldSkipEmptyUpstreamPoll(fixtureId)) {
    footballMetrics.recordPullRefresh('backoff');
    logger.info('[PTR] backoff', { fixtureId });
    return { outcome: 'backoff', intervalMs, coalescedCount: 0 };
  }

  const redis = getRedisClient();
  if (!redis) {
    footballMetrics.recordPullRefresh('cache_fresh');
    return { outcome: 'cache_fresh', intervalMs, coalescedCount: 0 };
  }

  const lastRaw = await redis.get(footballPtrLastKey(fixtureId));
  const lastMs = lastRaw ? Number(lastRaw) : 0;
  if (Number.isFinite(lastMs) && lastMs > 0 && Date.now() - lastMs < intervalMs) {
    footballMetrics.recordPullRefresh('cache_fresh');
    footballMetrics.recordCacheHit('ptr/details', 'user');
    return { outcome: 'cache_fresh', intervalMs, coalescedCount: 0 };
  }

  const lockTtlSec = Math.max(2, Math.ceil(intervalMs / 1000));
  const lockKey = footballPtrLockKey(fixtureId);
  const waitersKey = footballPtrWaitersKey(fixtureId);
  let acquired = false;
  try {
    const ok = await redis.set(lockKey, '1', 'EX', lockTtlSec, 'NX');
    acquired = ok === 'OK';
  } catch (error) {
    logger.warn('[PTR] lock failed; skipping schedule', {
      fixtureId,
      message: error instanceof Error ? error.message : String(error),
    });
    footballMetrics.recordPullRefresh('cache_fresh');
    return { outcome: 'cache_fresh', intervalMs, coalescedCount: 0 };
  }

  if (!acquired) {
    let coalescedCount = 1;
    try {
      coalescedCount = await redis.incr(waitersKey);
      await redis.expire(waitersKey, lockTtlSec);
    } catch {
      coalescedCount = 1;
    }
    footballMetrics.recordPullRefresh('coalesced');
    footballMetrics.recordDedupWait('ptr/details');
    logger.info('[PTR] coalesced', { fixtureId, coalescedCount });
    addBreadcrumb('PTR coalesced', 'ptr', 'info', { fixtureId, coalescedCount });
    return { outcome: 'coalesced', intervalMs, coalescedCount };
  }

  try {
    await redis.set(footballPtrLastKey(fixtureId), String(Date.now()), 'EX', 24 * 60 * 60);
    await redis.del(waitersKey);
  } catch {
    /* best-effort */
  }

  const started = await footballDataCacheService.requestBackgroundDetailsRefresh(
    fixtureId,
    language,
  );
  const outcome: PullRefreshOutcome = started === 'already_in_flight' ? 'coalesced' : 'scheduled';
  footballMetrics.recordPullRefresh(outcome);
  if (outcome === 'scheduled') {
    footballMetrics.recordCacheMiss('ptr/details', 'user');
  } else {
    footballMetrics.recordDedupWait('ptr/details');
  }
  logger.info('[PTR] schedule', { fixtureId, outcome, intervalMs, statusShort });
  addBreadcrumb('PTR schedule', 'ptr', 'info', { fixtureId, outcome, intervalMs, statusShort });
  return { outcome, intervalMs, coalescedCount: outcome === 'coalesced' ? 1 : 0 };
}

async function isAbuseLimited(clientKey: string, fixtureId: number): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    const key = footballPtrAbuseKey(clientKey, fixtureId);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, PTR_ABUSE_WINDOW_SEC);
    return count > PTR_ABUSE_MAX;
  } catch {
    return false;
  }
}
