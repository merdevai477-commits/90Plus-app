/**
 * Football reliability rollout controls.
 *
 * Defaults are deliberately safe:
 * - standings SWR is enabled because it only changes cache orchestration and
 *   always preserves the last durable snapshot on refresh failure;
 * - historical DB-only reads are opt-in; dedicated historical modes still
 *   enforce durable coverage without globally blanking uncached dates;
 * - bounded-cache defaults are conservative and can be tuned without deploys.
 *
 * None of these controls changes the 5s live fixture/event delivery cadence.
 */

function enabledByDefault(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw == null || raw === '') return defaultValue;
  return raw === 'true' || raw === '1';
}

function positiveInt(name: string, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export function isStandingsSwrEnabled(): boolean {
  return enabledByDefault('FOOTBALL_STANDINGS_SWR_ENABLED', true);
}

export function isHistoricalHttpDbOnlyEnabled(): boolean {
  return enabledByDefault('FOOTBALL_HISTORICAL_HTTP_DB_ONLY', false);
}

export function standingsFreshMs(): number {
  // Preserve the pre-SWR five-minute freshness contract. The long stale
  // window is only a resilience fallback while one background refresh runs.
  return positiveInt('FOOTBALL_STANDINGS_FRESH_MS', 5 * 60 * 1000, 24 * 60 * 60 * 1000);
}

export function standingsStaleMs(): number {
  return positiveInt(
    'FOOTBALL_STANDINGS_STALE_MS',
    7 * 24 * 60 * 60 * 1000,
    30 * 24 * 60 * 60 * 1000,
  );
}

export function matchesByDateLocalMaxEntries(): number {
  return positiveInt('FOOTBALL_MATCHES_BY_DATE_LOCAL_MAX', 64, 366);
}

export function scores365RateLimitMapMaxEntries(): number {
  return positiveInt('SCORES365_RATE_LIMIT_MAP_MAX', 2_000, 20_000);
}
