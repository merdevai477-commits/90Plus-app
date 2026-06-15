/**
 * Football-specific observability counters.
 *
 * Tracks outbound API-Football usage, cache hit rate, deduplication, and per-endpoint volume.
 */

import { logger } from './logger';

export type FootballApiCallSource = 'user' | 'job' | 'internal' | 'unknown';

interface EndpointStats {
  calls: number;
  apiUpstream: number;
  cacheHits: number;
  cacheMisses: number;
  dedupWaits: number;
  staleFallbacks: number;
}

interface FootballMetricsState {
  totalApiCalls: number;
  apiSuccess: number;
  apiFailure: number;
  cacheHits: number;
  cacheMisses: number;
  dedupWaits: number;
  staleFallbacks: number;
  resolverAttempts: number;
  resolverResolved: number;
  teamResolverAttempts: number;
  teamResolverResolved: number;
  totalResponseTimeMs: number;
  responseSamples: number;
  dailyApiCalls: number;
  dailyResetAt: number;
  byEndpoint: Map<string, EndpointStats>;
  bySource: Map<FootballApiCallSource, number>;
}

function emptyEndpointStats(): EndpointStats {
  return {
    calls: 0,
    apiUpstream: 0,
    cacheHits: 0,
    cacheMisses: 0,
    dedupWaits: 0,
    staleFallbacks: 0,
  };
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\?.*$/, '').slice(0, 120);
}

class FootballMetrics {
  private s: FootballMetricsState = {
    totalApiCalls: 0,
    apiSuccess: 0,
    apiFailure: 0,
    cacheHits: 0,
    cacheMisses: 0,
    dedupWaits: 0,
    staleFallbacks: 0,
    resolverAttempts: 0,
    resolverResolved: 0,
    teamResolverAttempts: 0,
    teamResolverResolved: 0,
    totalResponseTimeMs: 0,
    responseSamples: 0,
    dailyApiCalls: 0,
    dailyResetAt: FootballMetrics.startOfUtcDay(),
    byEndpoint: new Map(),
    bySource: new Map(),
  };

  private static startOfUtcDay(): number {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }

  private rollDailyIfNeeded(): void {
    const start = FootballMetrics.startOfUtcDay();
    if (start !== this.s.dailyResetAt) {
      this.s.dailyApiCalls = 0;
      this.s.dailyResetAt = start;
    }
  }

  private endpointStats(endpoint: string): EndpointStats {
    const key = normalizeEndpoint(endpoint);
    let stats = this.s.byEndpoint.get(key);
    if (!stats) {
      stats = emptyEndpointStats();
      this.s.byEndpoint.set(key, stats);
    }
    stats.calls += 1;
    return stats;
  }

  recordEndpointAccess(endpoint: string, source: FootballApiCallSource = 'unknown'): void {
    this.endpointStats(endpoint);
    this.s.bySource.set(source, (this.s.bySource.get(source) ?? 0) + 1);
  }

  recordCacheHit(endpoint?: string, source: FootballApiCallSource = 'unknown'): void {
    this.s.cacheHits += 1;
    if (endpoint) {
      this.endpointStats(endpoint).cacheHits += 1;
    }
    if (source !== 'unknown') {
      this.s.bySource.set(source, (this.s.bySource.get(source) ?? 0) + 1);
    }
  }

  recordCacheMiss(endpoint?: string, source: FootballApiCallSource = 'unknown'): void {
    this.s.cacheMisses += 1;
    if (endpoint) {
      this.endpointStats(endpoint).cacheMisses += 1;
    }
    if (source !== 'unknown') {
      this.s.bySource.set(source, (this.s.bySource.get(source) ?? 0) + 1);
    }
  }

  recordDedupWait(endpoint: string): void {
    this.s.dedupWaits += 1;
    this.endpointStats(endpoint).dedupWaits += 1;
  }

  recordStaleFallback(endpoint: string): void {
    this.s.staleFallbacks += 1;
    this.endpointStats(endpoint).staleFallbacks += 1;
  }

  recordApiSuccess(ms?: number, endpoint?: string, source: FootballApiCallSource = 'unknown'): void {
    this.rollDailyIfNeeded();
    this.s.totalApiCalls += 1;
    this.s.apiSuccess += 1;
    this.s.dailyApiCalls += 1;
    if (endpoint) {
      const stats = this.endpointStats(endpoint);
      stats.apiUpstream += 1;
    }
    if (source !== 'unknown') {
      this.s.bySource.set(source, (this.s.bySource.get(source) ?? 0) + 1);
    }
    if (typeof ms === 'number' && ms >= 0) {
      this.s.totalResponseTimeMs += ms;
      this.s.responseSamples += 1;
    }
  }

  recordApiFailure(ms?: number, endpoint?: string, source: FootballApiCallSource = 'unknown'): void {
    this.rollDailyIfNeeded();
    this.s.totalApiCalls += 1;
    this.s.apiFailure += 1;
    if (endpoint) {
      this.endpointStats(endpoint).apiUpstream += 1;
    }
    if (source !== 'unknown') {
      this.s.bySource.set(source, (this.s.bySource.get(source) ?? 0) + 1);
    }
    if (typeof ms === 'number' && ms >= 0) {
      this.s.totalResponseTimeMs += ms;
      this.s.responseSamples += 1;
    }
  }

  recordResolver(resolved: boolean): void {
    this.s.resolverAttempts += 1;
    if (resolved) this.s.resolverResolved += 1;
  }

  recordTeamResolver(resolved: boolean): void {
    this.s.teamResolverAttempts += 1;
    if (resolved) this.s.teamResolverResolved += 1;
  }

  private rate(num: number, den: number): number {
    return den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;
  }

  getSnapshot(): Record<string, unknown> {
    const cacheTotal = this.s.cacheHits + this.s.cacheMisses;
    const topEndpoints = [...this.s.byEndpoint.entries()]
      .sort((a, b) => b[1].apiUpstream - a[1].apiUpstream)
      .slice(0, 15)
      .map(([endpoint, stats]) => ({ endpoint, ...stats }));

    return {
      totalApiCalls: this.s.totalApiCalls,
      apiSuccess: this.s.apiSuccess,
      apiFailure: this.s.apiFailure,
      apiSuccessRate: this.rate(this.s.apiSuccess, this.s.totalApiCalls),
      dailyApiCalls: this.s.dailyApiCalls,
      dailyResetAt: new Date(this.s.dailyResetAt).toISOString(),
      cacheHits: this.s.cacheHits,
      cacheMisses: this.s.cacheMisses,
      cacheHitRate: this.rate(this.s.cacheHits, cacheTotal),
      dedupWaits: this.s.dedupWaits,
      staleFallbacks: this.s.staleFallbacks,
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
      bySource: Object.fromEntries(this.s.bySource),
      topEndpoints,
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
      dedupWaits: 0,
      staleFallbacks: 0,
      resolverAttempts: 0,
      resolverResolved: 0,
      teamResolverAttempts: 0,
      teamResolverResolved: 0,
      totalResponseTimeMs: 0,
      responseSamples: 0,
      dailyApiCalls: 0,
      dailyResetAt: FootballMetrics.startOfUtcDay(),
      byEndpoint: new Map(),
      bySource: new Map(),
    };
  }
}

export const footballMetrics = new FootballMetrics();

export function getFootballMetrics(): Record<string, unknown> {
  return footballMetrics.getSnapshot();
}
