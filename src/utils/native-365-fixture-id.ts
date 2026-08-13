/** 365Scores stores gameId as fixtureId for non-API-Football matches (typically >= 4e6). */
export function isNative365FixtureId(fixtureId: number): boolean {
  return Number.isFinite(fixtureId) && fixtureId >= 4_000_000;
}
