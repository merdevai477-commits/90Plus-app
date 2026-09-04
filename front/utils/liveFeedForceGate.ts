/**
 * A7: calendar poll must not force-bust the live-feed TTL while WS is trusted.
 * Mirrors the gate in fetchTodayMatchesWithLiveFeed.
 */
export function shouldForceLiveFeedFetch(
  fresh: boolean,
  wsTrusted: boolean,
): boolean {
  return fresh === true && !wsTrusted;
}
