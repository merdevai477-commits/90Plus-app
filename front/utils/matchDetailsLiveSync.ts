import type { Fixture, FixtureEvent } from '../services/apiFootball';

/**
 * When fixture and events come from different cache layers the header can lag
 * (e.g. 46' 0-0) while events already show goals at 60'+. Prefer the fresher
 * signal from events for live score + minute only when events are ahead.
 */
export function reconcileFixtureWithEvents(
  fixture: Fixture,
  events: FixtureEvent[],
): Fixture {
  if (!events.length) return fixture;

  // 365Scores is source of truth for WC experiment — never override its score from events.
  if ((fixture as Fixture & { _experiment?: string })._experiment === 'scores365') {
    return fixture;
  }
  const allFrom365 = events.every(
    (e) => (e as FixtureEvent & { _source?: string })._source === 'scores365-experiment',
  );
  if (allFrom365) return fixture;

  const homeId = fixture.teams?.home?.id;
  const awayId = fixture.teams?.away?.id;
  if (!homeId || !awayId) return fixture;

  let maxMinute = fixture.fixture.status.elapsed ?? 0;
  for (const e of events) {
    const m = e.time?.elapsed;
    if (typeof m === 'number' && m > maxMinute) maxMinute = m;
  }

  let homeGoals = 0;
  let awayGoals = 0;
  for (const e of events) {
    if (e.type !== 'Goal') continue;
    const detail = (e.detail || '').toLowerCase();
    if (detail.includes('missed')) continue;
    const isOwn = detail.includes('own');
    const teamId = e.team?.id;
    if (teamId === homeId) {
      if (isOwn) awayGoals++;
      else homeGoals++;
    } else if (teamId === awayId) {
      if (isOwn) homeGoals++;
      else awayGoals++;
    }
  }

  const apiHome = fixture.goals?.home ?? 0;
  const apiAway = fixture.goals?.away ?? 0;
  const apiElapsed = fixture.fixture.status.elapsed ?? 0;
  const eventGoalTotal = homeGoals + awayGoals;
  const apiGoalTotal = apiHome + apiAway;

  const goalsFromEventsAhead =
    eventGoalTotal > apiGoalTotal ||
    homeGoals > apiHome ||
    awayGoals > apiAway;
  const minuteAhead = maxMinute > apiElapsed;

  if (!goalsFromEventsAhead && !minuteAhead) return fixture;

  return {
    ...fixture,
    goals: goalsFromEventsAhead ? { home: homeGoals, away: awayGoals } : fixture.goals,
    fixture: {
      ...fixture.fixture,
      status: {
        ...fixture.fixture.status,
        elapsed: minuteAhead ? maxMinute : fixture.fixture.status.elapsed,
      },
    },
  };
}
