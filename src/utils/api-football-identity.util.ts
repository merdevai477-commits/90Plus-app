import { isNative365FixtureId } from './native-365-fixture-id';
import { SCORES365_LEAGUE_ID_OFFSET } from './scores365-league-id.util';

/**
 * True when this id is safe to send to API-Football.
 * Native 365 gameIds and namespaced 365 league ids must never be queried there
 * (404 or an unrelated match).
 */
export function canQueryApiFootballFixtureId(fixtureId: number): boolean {
  return (
    Number.isFinite(fixtureId) &&
    fixtureId > 0 &&
    fixtureId < 4_000_000 &&
    fixtureId < SCORES365_LEAGUE_ID_OFFSET &&
    !isNative365FixtureId(fixtureId)
  );
}
