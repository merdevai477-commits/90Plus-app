/**
 * Unit tests for overlaySnapshotsOnCalendar identity preservation.
 */
jest.mock('../../src/utils/snapshotToMatchRow', () => ({
  snapshotToMatchRow: (snap: {
    fixtureId: number;
    phase: string;
    fixture: {
      goals: { home: number | null; away: number | null };
      fixture: { status: { short: string; elapsed: number | null; extra: number | null } };
    };
  }) => ({
    id: String(snap.fixtureId),
    homeTeam: { id: 1, name: 'Home', logo: '' },
    awayTeam: { id: 2, name: 'Away', logo: '' },
    score: {
      home: snap.fixture.goals.home ?? 0,
      away: snap.fixture.goals.away ?? 0,
    },
    status: snap.phase === 'finished' ? 'finished' : snap.phase === 'upcoming' ? 'upcoming' : 'live',
    time: '12:00',
    league: { id: 1, name: 'L', logo: '', country: 'X' },
    fixtureDate: '2026-01-01',
    minute: `${snap.fixture.fixture.status.elapsed ?? 0}'`,
    elapsed: snap.fixture.fixture.status.elapsed,
    extra: snap.fixture.fixture.status.extra,
    statusShort: snap.fixture.fixture.status.short,
  }),
}));

import { overlaySnapshotsOnCalendar } from '../overlaySnapshotsOnCalendar';
import type { Match } from '../../components/Matches/matchCardUtils';
import type { LiveFixtureSnapshot } from '../../src/store/liveFixtureStore.types';

function makeMatch(overrides: Partial<Match> & { id: string }): Match {
  return {
    homeTeam: { id: 1, name: 'Home', logo: '' },
    awayTeam: { id: 2, name: 'Away', logo: '' },
    score: { home: 0, away: 0 },
    status: 'live',
    time: '12:00',
    league: { id: 1, name: 'L', logo: '', country: 'X' },
    fixtureDate: '2026-01-01',
    minute: "45'",
    elapsed: 45,
    extra: null,
    statusShort: '1H',
    ...overrides,
  };
}

function makeSnap(
  id: number,
  goals: { home: number; away: number },
  short = '1H',
  elapsed = 45,
): LiveFixtureSnapshot {
  return {
    fixtureId: id,
    phase: 'live',
    updatedAt: Date.now(),
    revision: 1,
    lastHttpFetchAt: null,
    lastWsAppliedAt: null,
    lastSource: 'http-fast',
    lastFetchError: null,
    events: [],
    statistics: null,
    statsFromEvents: false,
    lineups: null,
    venue: null,
    fixture: {
      fixture: {
        id,
        referee: null,
        timezone: 'UTC',
        date: '2026-01-01T12:00:00+00:00',
        timestamp: 0,
        periods: { first: null, second: null },
        venue: { id: null, name: null, city: null },
        status: { long: 'First Half', short, elapsed, extra: null },
      },
      league: {
        id: 1,
        name: 'L',
        country: 'X',
        logo: '',
        flag: null,
        season: 2026,
        round: '1',
      },
      teams: {
        home: { id: 1, name: 'Home', logo: '' },
        away: { id: 2, name: 'Away', logo: '' },
      },
      goals,
      score: {
        halftime: { home: null, away: null },
        fulltime: { home: null, away: null },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    },
  } as LiveFixtureSnapshot;
}

describe('overlaySnapshotsOnCalendar', () => {
  it('keeps the same array and row refs when fingerprints are unchanged', () => {
    const calendar = [
      makeMatch({ id: '100', score: { home: 1, away: 0 }, elapsed: 45, statusShort: '1H' }),
      makeMatch({ id: '200', status: 'upcoming' }),
    ];
    const snaps = { 100: makeSnap(100, { home: 1, away: 0 }) };
    const first = overlaySnapshotsOnCalendar(calendar, snaps);
    const second = overlaySnapshotsOnCalendar(first, snaps);
    expect(second).toBe(first);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('replaces only the changed row object when score updates', () => {
    const live = makeMatch({ id: '100', score: { home: 0, away: 0 }, elapsed: 10, statusShort: '1H' });
    const other = makeMatch({ id: '200', status: 'upcoming' });
    const calendar = [live, other];
    const next = overlaySnapshotsOnCalendar(calendar, {
      100: makeSnap(100, { home: 2, away: 1 }, '1H', 55),
    });
    expect(next).not.toBe(calendar);
    expect(next[0]).not.toBe(live);
    expect(next[0].score.home).toBe(2);
    expect(next[1]).toBe(other);
  });
});
