import type { Fixture, FixtureEvent, TeamStatistics } from '../services/apiFootball';

/**
 * Build minimal match statistics from score + events when API-Football
 * returns no /fixtures/statistics payload (common for lower-tier leagues).
 */
export function buildFallbackStatisticsFromEvents(
  fixture: Fixture,
  events: FixtureEvent[],
): TeamStatistics[] {
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;

  const countForTeam = (teamId: number, predicate: (e: FixtureEvent) => boolean) =>
    events.filter((e) => e.team.id === teamId && predicate(e)).length;

  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;

  const homeYellow = countForTeam(homeId, (e) => e.type === 'Card' && e.detail === 'Yellow Card');
  const awayYellow = countForTeam(awayId, (e) => e.type === 'Card' && e.detail === 'Yellow Card');
  const homeRed = countForTeam(
    homeId,
    (e) => e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card'),
  );
  const awayRed = countForTeam(
    awayId,
    (e) => e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card'),
  );
  const homeSubs = countForTeam(homeId, (e) => e.type === 'subst');
  const awaySubs = countForTeam(awayId, (e) => e.type === 'subst');

  const mkStats = (
    team: { id: number; name: string; logo: string },
    goals: number,
    yellow: number,
    red: number,
    subs: number,
  ): TeamStatistics => ({
    team,
    statistics: [
      { type: 'Goals', value: goals },
      { type: 'Yellow Cards', value: yellow },
      { type: 'Red Cards', value: red },
      { type: 'Substitutions', value: subs },
    ],
  });

  return [
    mkStats(fixture.teams.home, homeGoals, homeYellow, homeRed, homeSubs),
    mkStats(fixture.teams.away, awayGoals, awayYellow, awayRed, awaySubs),
  ];
}

export function hasApiStatistics(data: TeamStatistics[] | null | undefined): boolean {
  if (!data?.length) return false;
  return data.some((row) => Array.isArray(row.statistics) && row.statistics.length > 0);
}

/** Stat types the events-derived fallback can produce on its own. */
const EVENT_DERIVED_STAT_TYPES = new Set(['goals', 'yellow cards', 'red cards', 'substitutions']);

/**
 * True when the payload holds provider statistics (possession, shots, corners…)
 * rather than only the goals/cards/subs counts we can derive from events.
 */
export function hasRichStatistics(data: TeamStatistics[] | null | undefined): boolean {
  if (!hasApiStatistics(data)) return false;
  return (data ?? []).some((row) =>
    (row.statistics ?? []).some(
      (stat) => !EVENT_DERIVED_STAT_TYPES.has(String(stat?.type ?? '').trim().toLowerCase()),
    ),
  );
}
