/**
 * Shared Redis keys for football live data written by sync jobs and read by ingestors.
 */

export const FOOTBALL_LIVE_MATCHES_KEY = 'football:live_matches';
export const FOOTBALL_EVENTS_KEY_PREFIX = 'events:';

export function footballEventsRedisKey(fixtureId: number): string {
  return `${FOOTBALL_EVENTS_KEY_PREFIX}${fixtureId}`;
}
