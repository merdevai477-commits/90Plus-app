/**
 * Football-specific observability counters.
 *
 * Tracks outbound API-Football usage (success/failure), cache hit rate at the
 * football.service layer, and name-resolution accuracy for both player and team
 * resolvers. Purely in-process (mirrors src/utils/metrics.ts) and additive —
 * nothing here changes existing behavior; it only records.
 */

import { logger } from './logger';

interface FootballMetricsState {
  totalApiCalls: number;
  apiSuccess: number;
  apiFailure: number;
  cacheHits: number;
  cacheMisses: number;
  resolverAttempts: number;
  resolverResolved: number;
  teamResolverAttempts: number;
  teamResolverResolved: number;
  totalResponseTimeMs: number;
  responseSamples: number;
}

class FootballMetrics {
  private s: FootballMetricsState = {
    totalApiCalls: 0,
    apiSuccess: 0,
    apiFailure: 0,
    cacheHits: 0,
    cacheMisses: 0,
    resolverAttempts: 0,
    resolverResolved: 0,
    teamResolverAttempts: 0,
    teamResolverResolved: 0,
    totalResponseTimeMs: 0,
    responseSamples: 0,
  };

  /** An outbound API-Football call succeeded. `ms` = round-trip time. */
  recordApiSuccess(ms?: number): void {
    this.s.totalApiCalls += 1;
    this.s.apiSuccess += 1;
    if (typeof ms === 'number' && ms >= 0) {
      this.s.totalResponseTimeMs += ms;
      this.s.responseSamples += 1;
    }
  }

  /** An outbound API-Football call failed (network/HTTP/quota). */
  recordApiFailure(ms?: number): void {
    this.s.totalApiCalls += 1;
    this.s.apiFailure += 1;
    if (typeof ms === 'number' && ms >= 0) {
      this.s.totalResponseTimeMs += ms;
      this.s.responseSamples += 1;
    }
  }

  recordCacheHit(): void {
    this.s.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.s.cacheMisses += 1;
  }

  /** Player-name resolver: one attempt, resolved=true when an apiPlayerId was found. */
  recordResolver(resolved: boolean): void {
    this.s.resolverAttempts += 1;
    if (resolved) this.s.resolverResolved += 1;
  }

  /** Team-name resolver: one attempt, resolved=true when an apiTeamId was found. */
  recordTeamResolver(resolved: boolean): void {
    this.s.teamResolverAttempts += 1;
    if (resolved) this.s.teamResolverResolved += 1;
  }

  private rate(num: number, den: number): number {
    return den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;
  }

  getSnapshot(): Record<string, number> {
    const cacheTotal = this.s.cacheHits + this.s.cacheMisses;
    return {
      totalApiCalls: this.s.totalApiCalls,
      apiSuccess: this.s.apiSuccess,
      apiFailure: this.s.apiFailure,
      apiSuccessRate: this.rate(this.s.apiSuccess, this.s.totalApiCalls),
      cacheHits: this.s.cacheHits,
      cacheMisses: this.s.cacheMisses,
      cacheHitRate: this.rate(this.s.cacheHits, cacheTotal),
      resolverAttempts: this.s.resolverAttempts,
      resolverResolved: this.s.resolverResolved,
      resolverAccuracy: this.rate(this.s.resolverResolved, this.s.resolverAttempts),
      teamResolverAttempts: this.s.teamResolverAttempts,
      teamResolverResolved: this.s.teamResolverResolved,
      teamResolverAccuracy: this.rate(
        this.s.teamResolverResolved,
        this.s.teamResolverAttempts,
      ),
      avgResponseTimeMs:
        this.s.responseSamples > 0
          ? Number((this.s.totalResponseTimeMs / this.s.responseSamples).toFixed(2))
          : 0,
    };
  }

  logSummary(): void {
    logger.info('⚽ Football Metrics:', this.getSnapshot());
  }

  reset(): void {
    this.s = {
      totalApiCalls: 0,
      apiSuccess: 0,
      apiFailure: 0,
      cacheHits: 0,
      cacheMisses: 0,
      resolverAttempts: 0,
      resolverResolved: 0,
      teamResolverAttempts: 0,
      teamResolverResolved: 0,
      totalResponseTimeMs: 0,
      responseSamples: 0,
    };
  }
}

export const footballMetrics = new FootballMetrics();

/** Snapshot helper for the /api/metrics handler (additive surface). */
export function getFootballMetrics(): Record<string, number> {
  return footballMetrics.getSnapshot();
}
