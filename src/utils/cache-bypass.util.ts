import type { Request } from 'express';

/**
 * In production, `fresh=1` / `refresh=true` must not bypass HTTP response cache.
 * Development keeps the bypass so engineers can force upstream refresh.
 */
export function shouldHonorFreshCacheBypass(req: Request): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return req.query.fresh === '1' || req.query.refresh === 'true';
}
