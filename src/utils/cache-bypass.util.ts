import type { Request } from 'express';

/** Paths where `fresh=1` may bypass HTTP response cache even in production (no extra upstream calls when Redis sync is warm). */
const LIVE_FRESH_BYPASS_SUFFIXES = [
  '/fixtures/live',
] as const;

const LIVE_FRESH_BYPASS_PATTERNS = [
  /^\/fixtures\/\d+$/,
  /^\/fixtures\/\d+\/events$/,
] as const;

function getFootballCachePath(req: Request): string {
  const joined = `${req.baseUrl || ''}${req.path || ''}`.split('?')[0] || '/';
  const normalized = joined.startsWith('/') ? joined : `/${joined}`;
  const footballPrefix = '/api/football';
  if (normalized.startsWith(footballPrefix)) {
    return normalized.slice(footballPrefix.length) || '/';
  }
  return normalized;
}

export function isLiveFootballFreshBypassPath(req: Request): boolean {
  const path = getFootballCachePath(req);
  if (LIVE_FRESH_BYPASS_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
    return true;
  }
  return LIVE_FRESH_BYPASS_PATTERNS.some((pattern) => pattern.test(path));
}

/**
 * In production, only live-critical football GET paths honor `fresh=1`.
 * Other routes keep shared HTTP cache to protect API-Football quota.
 * Development keeps full bypass for debugging.
 */
export function shouldHonorFreshCacheBypass(req: Request): boolean {
  const wantsFresh = req.query.fresh === '1' || req.query.refresh === 'true';
  if (!wantsFresh) return false;

  if (process.env.NODE_ENV === 'production') {
    return isLiveFootballFreshBypassPath(req);
  }
  return true;
}
