import type { Request } from 'express';

/** Keep in sync with LIVE_STATUSES in match-cache.service.ts */
const PTR_LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'] as const;

export const PTR_INTERVAL_LIVE_ACTIVE_MS = 12_000;
export const PTR_INTERVAL_LIVE_IDLE_MS = 30_000;
export const PTR_INTERVAL_IDLE_MS = 60_000;
export const PTR_RECENT_ACTIVITY_MS = 45_000;
export const PTR_ABUSE_WINDOW_SEC = 60;
export const PTR_ABUSE_MAX = 12;

export type PullRefreshOutcome =
  | 'cache_fresh'
  | 'scheduled'
  | 'coalesced'
  | 'rate_limited'
  | 'latched'
  | 'backoff'
  | 'list';

export type PullRefreshResult = {
  outcome: PullRefreshOutcome;
  intervalMs: number;
  coalescedCount: number;
};

export function wantsPullRefresh(req: Request): boolean {
  const pull = req.query?.pull;
  return pull === '1' || pull === 'true';
}

export function resolvePullIntervalMs(
  statusShort: string | null | undefined,
  updatedAtMs?: number | null,
  now = Date.now(),
): number {
  const status = String(statusShort ?? '').toUpperCase();
  if ((PTR_LIVE_STATUSES as readonly string[]).includes(status)) {
    const recent =
      typeof updatedAtMs === 'number' &&
      Number.isFinite(updatedAtMs) &&
      now - updatedAtMs <= PTR_RECENT_ACTIVITY_MS;
    return recent ? PTR_INTERVAL_LIVE_ACTIVE_MS : PTR_INTERVAL_LIVE_IDLE_MS;
  }
  return PTR_INTERVAL_IDLE_MS;
}

export function pullRefreshClientKey(req: Request): string {
  const userId = (req as { auth?: { userId?: string } }).auth?.userId;
  if (userId) return `user:${userId}`;
  const xff = req.headers?.['x-forwarded-for'];
  const raw =
    (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim() ||
    req.headers?.['x-real-ip']?.toString()?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  return `ip:${raw}`;
}

export function fixtureUpdatedAtMs(fixture: {
  fixture?: { date?: string | null };
  updatedAt?: string | Date | null;
} | null): number | null {
  const raw = (fixture as { updatedAt?: string | Date | null } | null)?.updatedAt;
  if (raw instanceof Date && Number.isFinite(raw.getTime())) return raw.getTime();
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  return null;
}
