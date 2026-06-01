/**
 * Minimal statistics from events + score when /fixtures/statistics is empty.
 */

export function hasApiStatistics(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  return data.some((row) => {
    const r = row as { statistics?: unknown[] };
    return Array.isArray(r.statistics) && r.statistics.length > 0;
  });
}

export function buildFallbackStatisticsFromEvents(
  fixture: {
    teams: {
      home: { id: number; name: string; logo: string };
      away: { id: number; name: string; logo: string };
    };
    goals: { home: number | null; away: number | null };
  },
  events: Array<{
    type: string;
    detail: string;
    team: { id: number };
  }>,
): unknown[] {
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;

  const countForTeam = (teamId: number, predicate: (e: (typeof events)[0]) => boolean) =>
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
  ) => ({
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
