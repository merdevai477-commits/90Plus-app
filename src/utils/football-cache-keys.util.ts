/**
 * Shared Redis keys for football live data written by sync jobs and read by ingestors.
 */

export const FOOTBALL_LIVE_MATCHES_KEY = 'football:live_matches';
export const FOOTBALL_API_LIVE_MATCHES_KEY = 'football:live_matches:api-football';
export const FOOTBALL_365_LIVE_MATCHES_KEY = 'football:live_matches:365';
export const FOOTBALL_LIVE_FIXTURE_KEY_PREFIX = 'football:live_fixture:';
export const FOOTBALL_API_LIVE_FIXTURE_KEY_PREFIX = 'football:live_fixture:api-football:';
export const FOOTBALL_365_LIVE_FIXTURE_KEY_PREFIX = 'football:live_fixture:365:';
export const FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX = 'football:fixture_terminal:';
export const FOOTBALL_EVENTS_KEY_PREFIX = 'events:';
export const FOOTBALL_MOMENTUM_KEY_PREFIX = 'momentum:';
export const FOOTBALL_LINEUPS_KEY_PREFIX = 'lineups:';
export const FOOTBALL_STATISTICS_KEY_PREFIX = 'statistics:';
export const FOOTBALL_DETAILS_KEY_PREFIX = 'details:';

export function footballEventsRedisKey(fixtureId: number): string {
  return `${FOOTBALL_EVENTS_KEY_PREFIX}${fixtureId}`;
}

export function footballMomentumRedisKey(fixtureId: number): string {
  return `${FOOTBALL_MOMENTUM_KEY_PREFIX}${fixtureId}`;
}

export function footballLineupsRedisKey(fixtureId: number): string {
  return `${FOOTBALL_LINEUPS_KEY_PREFIX}${fixtureId}`;
}

export function footballStatisticsRedisKey(fixtureId: number): string {
  return `${FOOTBALL_STATISTICS_KEY_PREFIX}${fixtureId}`;
}

export function footballDetailsRedisKey(fixtureId: number): string {
  return `${FOOTBALL_DETAILS_KEY_PREFIX}${fixtureId}`;
}

/** Detail keys cleared on LIVE→FT / status transitions so TTL alone cannot serve stale bundles. */
export function footballFixtureDetailCacheKeys(fixtureId: number): string[] {
  return [
    footballLineupsRedisKey(fixtureId),
    footballEventsRedisKey(fixtureId),
    footballStatisticsRedisKey(fixtureId),
    footballMomentumRedisKey(fixtureId),
    footballDetailsRedisKey(fixtureId),
  ];
}
