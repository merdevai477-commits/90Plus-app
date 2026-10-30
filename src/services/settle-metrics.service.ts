/**
 * Settlement observability (E9): durable day counters in Redis, a PII-free
 * health summary from Postgres, and the SETTLE_STALE watchdog.
 */

import prisma from '../lib/prisma';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';

const METRICS_TTL_SEC = 14 * 24 * 60 * 60;
const SUMMARY_TTL_MS = 60_000;
/** A final match still holding pending rows this long is reported. */
export const SETTLE_STALE_AFTER_MS = 30 * 60 * 1000;
/** Without an in-process first-seen time (fresh boot), kickoff + this is stale. */
const STALE_BY_KICKOFF_MS = 6 * 60 * 60 * 1000;
const STALE_REPORT_EVERY_MS = 60 * 60 * 1000;

export function settleMetricsDayKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10).replace(/-/g, '');
}

function metricsKey(day: string): string {
  return `metrics:settle:${day}`;
}

/** Fire-and-forget counter bump; never throws, never blocks settlement. */
export function recordSettleMetric(field: string, by = 1): void {
  if (by <= 0 || !isRedisConnected()) return;
  const redis = getRedisClient();
  if (!redis) return;
  const key = metricsKey(settleMetricsDayKey());
  redis
    .multi()
    .hincrby(key, field, by)
    .expire(key, METRICS_TTL_SEC)
    .exec()
    .catch((err: any) => logger.debug('[SettleMetrics] hincrby failed:', err?.message));
}

export async function readSettleMetrics(
  days = 14,
  now: Date = new Date(),
): Promise<Array<{ day: string; counts: Record<string, number> }>> {
  const redis = isRedisConnected() ? getRedisClient() : null;
  if (!redis) return [];
  const out: Array<{ day: string; counts: Record<string, number> }> = [];
  for (let i = 0; i < days; i += 1) {
    const day = settleMetricsDayKey(new Date(now.getTime() - i * 86_400_000));
    const raw = (await redis.hgetall(metricsKey(day))) ?? {};
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) counts[k] = Number(v) || 0;
    if (Object.keys(counts).length > 0) out.push({ day, counts });
  }
  return out;
}

export type SettleHealthSummary = {
  pendingCount: number;
  /** Minutes since kickoff of the oldest pending row whose match is final in the cache. */
  oldestSettleablePendingAgeMin: number | null;
  settleablePendingMatches: number;
  lastSettleAt: string | null;
  today: Record<string, number>;
};

let summaryCache: { at: number; value: SettleHealthSummary } | null = null;

export async function getSettleHealthSummary(now: Date = new Date()): Promise<SettleHealthSummary> {
  if (summaryCache && now.getTime() - summaryCache.at < SUMMARY_TTL_MS) return summaryCache.value;

  const [pending, settleable, last, metrics] = await Promise.all([
    prisma.prediction.count({ where: { isCorrect: null, voidedAt: null } }),
    prisma.$queryRaw<Array<{ matches: number; oldest: Date | null }>>`
      SELECT COUNT(DISTINCT p."apiMatchId")::int AS matches, MIN(cf."matchDate") AS oldest
        FROM predictions p
        JOIN cached_fixtures cf ON cf."fixtureId" = p."apiMatchId"
       WHERE p."isCorrect" IS NULL AND p."voidedAt" IS NULL
         AND cf.status IN ('FT', 'AET', 'PEN')
    `,
    prisma.prediction.aggregate({ _max: { settledAt: true } }),
    readSettleMetrics(1, now),
  ]);

  const oldest = settleable[0]?.oldest ? new Date(settleable[0].oldest) : null;
  const value: SettleHealthSummary = {
    pendingCount: pending,
    oldestSettleablePendingAgeMin: oldest ? Math.round((now.getTime() - oldest.getTime()) / 60_000) : null,
    settleablePendingMatches: settleable[0]?.matches ?? 0,
    lastSettleAt: last._max.settledAt ? last._max.settledAt.toISOString() : null,
    today: metrics[0]?.counts ?? {},
  };
  summaryCache = { at: now.getTime(), value };
  return value;
}

export type StaleMatch = { apiMatchId: number; status: string; pending: number; kickoff: string; sinceKickoffMin: number };

const firstSeenFinal = new Map<number, number>();
const lastReported = new Map<number, number>();

/**
 * Watchdog, once per watcher tick: matches final in the cache that still hold
 * pending rows past SETTLE_STALE_AFTER_MS log SETTLE_STALE at error level
 * (→ Sentry), at most once an hour per match.
 */
export async function runSettleWatchdog(
  now: Date = new Date(),
  opts: { report?: boolean } = {},
): Promise<StaleMatch[]> {
  const report = opts.report !== false;
  const rows = await prisma.$queryRaw<
    Array<{ apiMatchId: number; status: string; pending: number; kickoff: Date }>
  >`
    SELECT p."apiMatchId", cf.status, COUNT(*)::int AS pending, cf."matchDate" AS kickoff
      FROM predictions p
      JOIN cached_fixtures cf ON cf."fixtureId" = p."apiMatchId"
     WHERE p."isCorrect" IS NULL AND p."voidedAt" IS NULL
       AND cf.status IN ('FT', 'AET', 'PEN')
     GROUP BY p."apiMatchId", cf.status, cf."matchDate"
  `;

  const nowMs = now.getTime();
  const present = new Set<number>();
  const stale: StaleMatch[] = [];
  for (const row of rows) {
    present.add(row.apiMatchId);
    const kickoffMs = new Date(row.kickoff).getTime();
    const seen = firstSeenFinal.get(row.apiMatchId) ?? nowMs;
    if (report) firstSeenFinal.set(row.apiMatchId, seen);
    const overdue =
      nowMs - seen >= SETTLE_STALE_AFTER_MS || nowMs - kickoffMs >= STALE_BY_KICKOFF_MS;
    if (!overdue) continue;
    stale.push({
      apiMatchId: row.apiMatchId,
      status: row.status,
      pending: row.pending,
      kickoff: new Date(row.kickoff).toISOString(),
      sinceKickoffMin: Math.round((nowMs - kickoffMs) / 60_000),
    });
  }
  if (!report) return stale;

  for (const id of [...firstSeenFinal.keys()]) {
    if (!present.has(id)) {
      firstSeenFinal.delete(id);
      lastReported.delete(id);
    }
  }

  for (const match of stale) {
    const last = lastReported.get(match.apiMatchId) ?? 0;
    if (nowMs - last < STALE_REPORT_EVERY_MS) continue;
    lastReported.set(match.apiMatchId, nowMs);
    recordSettleMetric('SETTLE_STALE');
    logger.error(JSON.stringify({ event: 'SETTLE_STALE', ...match }));
  }
  return stale;
}

export function __resetSettleMetricsForTests(): void {
  summaryCache = null;
  firstSeenFinal.clear();
  lastReported.clear();
}
