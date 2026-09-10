/**
 * Full Matches-list live render pipeline:
 * overlay REPLACE/KEEP → changedIds → incremental grouping → row transform → displayed minute.
 *
 * This is the production failure: Redis/calendar/Zustand at 64' while FlashList
 * kept a previousGroups Match at 50' because REPLACE did not mark changedIds
 * and empty changedIds returned previous groups.
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
    league: { id: 39, name: 'EPL', logo: 'lg.png', country: 'England' },
    fixtureDate: '2026-09-09',
    minute: `${snap.fixture.fixture.status.elapsed ?? 0}'`,
    elapsed: snap.fixture.fixture.status.elapsed,
    extra: snap.fixture.fixture.status.extra,
    statusShort: snap.fixture.fixture.status.short,
  }),
}));

import type { Match } from '../../components/Matches/matchCardUtils';
import type { LiveFixtureSnapshot } from '../../src/store/liveFixtureStore.types';
import { createObjectRefMemo } from '../createObjectRefMemo';
import { displayedListLiveMinute, formatLiveMinuteDisplay } from '../formatLiveMinuteDisplay';
import { overlaySnapshotsOnCalendarDetailed } from '../overlaySnapshotsOnCalendar';
import {
  groupMatchesByCountry,
  groupMatchesByCountryIncremental,
} from '../matchesGrouping';
import { decideLiveMerge, clockFromMatch } from '../liveFixtureFreshness';

const FIXTURE_ID = '4812183';

function makeLiveMatch(overrides: Partial<Match> & { id: string }): Match {
  return {
    homeTeam: { name: 'Home FC', logo: 'https://cdn.example/home.png' },
    awayTeam: { name: 'Away FC', logo: 'https://cdn.example/away.png' },
    score: { home: 1, away: 2 },
    status: 'live',
    time: '21:00',
    league: { id: 39, name: 'EPL', logo: 'https://cdn.example/epl.png', country: 'England' },
    fixtureDate: '2026-09-09T21:00:00.000Z',
    minute: "50'",
    elapsed: 50,
    extra: null,
    statusShort: '2H',
    ...overrides,
  };
}

function makeUpcoming(id: string, country: string, leagueId: number, leagueName: string): Match {
  return {
    id,
    homeTeam: { name: `H${id}`, logo: 'https://cdn.example/h.png' },
    awayTeam: { name: `A${id}`, logo: 'https://cdn.example/a.png' },
    score: { home: 0, away: 0 },
    status: 'upcoming',
    statusShort: 'NS',
    elapsed: null,
    extra: null,
    minute: '',
    time: '18:00',
    fixtureDate: '2026-09-09T18:00:00.000Z',
    league: { id: leagueId, name: leagueName, logo: 'lg.png', country },
  };
}

function makeSnap(
  id: number,
  goals: { home: number; away: number },
  short: string,
  elapsed: number,
  extra: number | null = null,
  phase: LiveFixtureSnapshot['phase'] = 'live',
): LiveFixtureSnapshot {
  return {
    fixtureId: id,
    phase,
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
        date: '2026-09-09T21:00:00+00:00',
        timestamp: 0,
        periods: { first: null, second: null },
        venue: { id: null, name: null, city: null },
        status: { long: short, short, elapsed, extra },
      },
      league: {
        id: 39,
        name: 'EPL',
        country: 'England',
        logo: 'https://cdn.example/epl.png',
        flag: null,
        season: 2026,
        round: '1',
      },
      teams: {
        home: { id: 1, name: 'Home FC', logo: 'https://cdn.example/home.png' },
        away: { id: 2, name: 'Away FC', logo: 'https://cdn.example/away.png' },
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

function findGrouped(groups: ReturnType<typeof groupMatchesByCountry>, id: string): Match | undefined {
  for (const cg of groups) {
    for (const lg of cg.leagues) {
      const hit = lg.matches.find((m) => m.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Mirrors matches.tsx matchToFixture live fields used by MatchRow. */
function matchToListRowFixture(m: Match) {
  return {
    id: m.id,
    minute: m.minute,
    elapsed: m.elapsed ?? null,
    extra: m.extra ?? null,
    statusShort: m.statusShort,
    homeScore: m.score?.home ?? 0,
    awayScore: m.score?.away ?? 0,
    live: m.status === 'live',
    homeLogo: m.homeTeam?.logo || '',
    leagueName: m.league?.name,
    leagueId: m.league?.id,
  };
}

function renderedMinute(m: Match): string | undefined {
  return displayedListLiveMinute({
    minute: m.minute,
    statusShort: m.statusShort,
    elapsed: m.elapsed,
    extra: m.extra,
  });
}

describe('Matches list live render pipeline', () => {
  it('TEST A: REPLACE 50 → 64 marks changedIds', () => {
    const calendar = [makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" })];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
      4812183: makeSnap(4812183, { home: 1, away: 2 }, '2H', 50),
    });
    expect(
      decideLiveMerge(
        clockFromMatch({ ...calendar[0], elapsed: 50, minute: "50'" }),
        clockFromMatch(calendar[0]),
      ).action,
    ).toBe('REPLACE');
    expect(overlay.changedIds.has(FIXTURE_ID)).toBe(true);
    expect(overlay.rows[0].elapsed).toBe(64);
  });

  it('TEST B: REPLACE rebuilds grouped row from 50 to 64', () => {
    const stale = makeLiveMatch({ id: FIXTURE_ID, elapsed: 50, minute: "50'" });
    const fresh = makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" });
    const previous = groupMatchesByCountry([stale]);
    expect(findGrouped(previous, FIXTURE_ID)?.elapsed).toBe(50);

    const overlay = overlaySnapshotsOnCalendarDetailed([fresh], {
      4812183: makeSnap(4812183, { home: 1, away: 2 }, '2H', 50),
    });
    const grouped = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
    const row = findGrouped(grouped, FIXTURE_ID);
    expect(row?.elapsed).toBe(64);
    expect(row?.minute).toBe("64'");
    expect(renderedMinute(row!)).toBe("64'");
  });

  it('TEST C: PTR simulation — previous 50, incoming calendar 64, snapshots already 64 (KEEP EQUAL)', () => {
    const stale = makeLiveMatch({ id: FIXTURE_ID, elapsed: 50, minute: "50'" });
    const previous = groupMatchesByCountry([stale]);
    const calendar = [makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" })];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
      4812183: makeSnap(4812183, { home: 1, away: 2 }, '2H', 64),
    });
    expect(overlay.changedIds.size).toBe(0);
    expect(overlay.rows[0].elapsed).toBe(64);

    const grouped = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
    const row = findGrouped(grouped, FIXTURE_ID);
    expect(row?.elapsed).toBe(64);
    expect(renderedMinute(row!)).toBe("64'");
  });

  it('TEST D: score 0-0 → 1-0 at 25 reaches grouped row', () => {
    const stale = makeLiveMatch({
      id: FIXTURE_ID,
      elapsed: 25,
      minute: "25'",
      statusShort: '1H',
      score: { home: 0, away: 0 },
    });
    const previous = groupMatchesByCountry([stale]);
    const calendar = [{ ...stale, score: { home: 0, away: 0 } }];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
      4812183: makeSnap(4812183, { home: 1, away: 0 }, '1H', 25),
    });
    const grouped = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
    const row = findGrouped(grouped, FIXTURE_ID);
    expect(row?.score).toEqual({ home: 1, away: 0 });
    expect(matchToListRowFixture(row!).homeScore).toBe(1);
  });

  it('TEST E: 1H 45 → HT 45 reaches grouped status', () => {
    const stale = makeLiveMatch({
      id: FIXTURE_ID,
      elapsed: 45,
      minute: "45'",
      statusShort: '1H',
      score: { home: 0, away: 0 },
    });
    const previous = groupMatchesByCountry([stale]);
    const calendar = [{ ...stale, statusShort: 'HT', minute: 'HT' }];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
      4812183: makeSnap(4812183, { home: 0, away: 0 }, '1H', 45),
    });
    expect(overlay.changedIds.has(FIXTURE_ID)).toBe(true);
    const grouped = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
    const row = findGrouped(grouped, FIXTURE_ID);
    expect(row?.statusShort).toBe('HT');
    expect(renderedMinute(row!)).toBe('HT');
  });

  it('TEST F: older incoming 50 cannot regress grouped 64', () => {
    const current = makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" });
    const previous = groupMatchesByCountry([current]);
    const calendar = [makeLiveMatch({ id: FIXTURE_ID, elapsed: 50, minute: "50'" })];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
      4812183: makeSnap(4812183, { home: 1, away: 2 }, '2H', 64),
    });
    const grouped = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
    const row = findGrouped(grouped, FIXTURE_ID);
    expect(row?.elapsed).toBe(64);
    expect(renderedMinute(row!)).toBe("64'");
  });

  it('TEST G: thin live overlay preserves logos, league, ids', () => {
    const calendar = [
      makeLiveMatch({
        id: FIXTURE_ID,
        elapsed: 12,
        minute: "12'",
        statusShort: '1H',
        score: { home: 0, away: 0 },
      }),
    ];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
      4812183: makeSnap(4812183, { home: 1, away: 0 }, '1H', 27),
    });
    const row = overlay.rows[0];
    expect(row.id).toBe(FIXTURE_ID);
    expect(row.elapsed).toBe(27);
    expect(row.score.home).toBe(1);
    expect(row.homeTeam.logo).toBe('https://cdn.example/home.png');
    expect(row.awayTeam.logo).toBe('https://cdn.example/away.png');
    expect(row.league.logo).toBe('https://cdn.example/epl.png');
    expect(row.league.id).toBe(39);
  });

  it('TEST H: WeakMap/object-ref memo recomputes when Match identity changes', () => {
    const memo = createObjectRefMemo(matchToListRowFixture);
    const stale = makeLiveMatch({ id: FIXTURE_ID, elapsed: 50, minute: "50'" });
    const first = memo(stale);
    expect(first.elapsed).toBe(50);
    expect(first.minute).toBe("50'");

    const fresh = makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'", score: { home: 1, away: 2 } });
    const second = memo(fresh);
    expect(second).not.toBe(first);
    expect(second.elapsed).toBe(64);
    expect(second.minute).toBe("64'");
    expect(second.homeScore).toBe(1);
    expect(memo(stale)).toBe(first);
  });

  it('production E2E: snap 50, calendar 64, overlay REPLACE, grouping rebuilds, transform sees 64', () => {
    const stale = makeLiveMatch({ id: FIXTURE_ID, elapsed: 50, minute: "50'" });
    const spain = makeUpcoming('9', 'Spain', 140, 'La Liga');
    const italy = makeUpcoming('10', 'Italy', 135, 'Serie A');
    const france = makeUpcoming('11', 'France', 61, 'Ligue 1');
    const previous = groupMatchesByCountry([stale, spain, italy, france]);
    expect(findGrouped(previous, FIXTURE_ID)?.elapsed).toBe(50);

    const calendar = [
      makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" }),
      spain,
      italy,
      france,
    ];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
      4812183: makeSnap(4812183, { home: 1, away: 2 }, '2H', 50),
    });
    expect(overlay.changedIds.has(FIXTURE_ID)).toBe(true);
    expect(overlay.rows[0].elapsed).toBe(64);

    const grouped = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
    const groupedRow = findGrouped(grouped, FIXTURE_ID)!;
    expect(groupedRow).not.toBe(stale);
    expect(groupedRow.elapsed).toBe(64);
    expect(findGrouped(grouped, '9')).toBe(findGrouped(previous, '9'));
    expect(grouped.find((c) => c.country === 'Spain')).toBe(previous.find((c) => c.country === 'Spain'));

    const memo = createObjectRefMemo(matchToListRowFixture);
    const rendered = memo(groupedRow);
    expect(rendered.elapsed).toBe(64);
    expect(rendered.minute).toBe("64'");
    expect(rendered.statusShort).toBe('2H');
    expect(rendered.homeScore).toBe(1);
    expect(rendered.awayScore).toBe(2);
    expect(renderedMinute(groupedRow)).toBe("64'");

    // Stale baked minute must not win if elapsed is already current.
    const bakedStaleMinute = { ...groupedRow, minute: "50'" };
    expect(renderedMinute(bakedStaleMinute)).toBe("64'");
  });

  it('continues accepting 64 → 65 → 66 on the same grouped fixture', () => {
    let previous = groupMatchesByCountry([
      makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" }),
    ]);
    for (const minute of [65, 66, 67]) {
      const calendar = [makeLiveMatch({ id: FIXTURE_ID, elapsed: minute, minute: `${minute}'` })];
      const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {
        4812183: makeSnap(4812183, { home: 1, away: 2 }, '2H', minute - 1),
      });
      previous = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
      const row = findGrouped(previous, FIXTURE_ID);
      expect(row?.elapsed).toBe(minute);
      expect(renderedMinute(row!)).toBe(`${minute}'`);
    }
  });

  it('PTR with empty snapshots still rebuilds from previous 50 to calendar 64', () => {
    const stale = makeLiveMatch({ id: FIXTURE_ID, elapsed: 50, minute: "50'" });
    const previous = groupMatchesByCountry([stale]);
    const calendar = [makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" })];
    const overlay = overlaySnapshotsOnCalendarDetailed(calendar, {});
    expect(overlay.changedIds.size).toBe(0);
    const grouped = groupMatchesByCountryIncremental(overlay.rows, overlay.changedIds, previous);
    expect(findGrouped(grouped, FIXTURE_ID)?.elapsed).toBe(64);
  });

  it('does not rebuild sibling countries when only one live fingerprint changes', () => {
    const live = makeLiveMatch({ id: FIXTURE_ID, elapsed: 50, minute: "50'" });
    const spain = makeUpcoming('9', 'Spain', 140, 'La Liga');
    const italy = makeUpcoming('10', 'Italy', 135, 'Serie A');
    const france = makeUpcoming('11', 'France', 61, 'Ligue 1');
    const previous = groupMatchesByCountry([live, spain, italy, france]);
    const patched = [
      makeLiveMatch({ id: FIXTURE_ID, elapsed: 64, minute: "64'" }),
      spain,
      italy,
      france,
    ];
    const next = groupMatchesByCountryIncremental(patched, new Set([FIXTURE_ID]), previous);
    expect(next.find((c) => c.country === 'Spain')).toBe(previous.find((c) => c.country === 'Spain'));
    expect(next.find((c) => c.country === 'Italy')).toBe(previous.find((c) => c.country === 'Italy'));
    expect(next.find((c) => c.country === 'England')).not.toBe(
      previous.find((c) => c.country === 'England'),
    );
  });
});

describe('list live minute authority', () => {
  it('covers 1H / HT / 2H / ET / P / FT display', () => {
    expect(formatLiveMinuteDisplay('1H', 36)).toBe("36'");
    expect(formatLiveMinuteDisplay('HT', 45)).toBe('HT');
    expect(formatLiveMinuteDisplay('2H', 64)).toBe("64'");
    expect(formatLiveMinuteDisplay('2H', 90, 4)).toBe("90+4'");
    expect(formatLiveMinuteDisplay('ET', 105)).toMatch(/ET/);
    expect(formatLiveMinuteDisplay('P', 120)).toBeUndefined();
    expect(formatLiveMinuteDisplay('FT', 90)).toBeUndefined();
  });

  it('elapsed wins over a stale baked minute string', () => {
    expect(
      displayedListLiveMinute({
        minute: "50'",
        statusShort: '2H',
        elapsed: 64,
        extra: null,
      }),
    ).toBe("64'");
  });
});
