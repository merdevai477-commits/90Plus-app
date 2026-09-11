/**
 * Favorites-only live overlay tests.
 * Does not import or exercise Matches List / overlaySnapshotsOnCalendar.
 */

import type { FavoritesListFixture } from '../../hooks/useFavoritesFeed';
import type { LiveFixtureSnapshot } from '../../src/store/liveFixtureStore.types';
import {
  clockFromFavoritesListFixture,
  favoritesRowFromSnapshot,
  overlaySnapshotsOnFavorites,
} from '../overlaySnapshotsOnFavorites';

function makeRow(
  overrides: Partial<FavoritesListFixture> & { id: string },
): FavoritesListFixture {
  return {
    home: 'Home',
    away: 'Away',
    homeLogo: '',
    awayLogo: '',
    homeScore: 0,
    awayScore: 0,
    status: 'LIVE',
    live: true,
    statusShort: '1H',
    elapsed: 46,
    extra: null,
    minute: "46'",
    ...overrides,
  };
}

function makeSnap(
  id: number,
  opts: {
    home: number;
    away: number;
    short?: string;
    elapsed?: number | null;
    extra?: number | null;
    phase?: LiveFixtureSnapshot['phase'];
  },
): LiveFixtureSnapshot {
  const short = opts.short ?? '2H';
  const elapsed = opts.elapsed ?? 81;
  const extra = opts.extra ?? null;
  const phase = opts.phase ?? 'live';
  return {
    fixtureId: id,
    phase,
    updatedAt: Date.now(),
    revision: 1,
    lastHttpFetchAt: null,
    lastWsAppliedAt: null,
    lastSource: 'websocket',
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
        date: '2026-09-11T17:00:00+03:00',
        timestamp: 1789135200,
        periods: { first: null, second: null },
        venue: { id: null, name: null, city: null },
        status: {
          long: short,
          short,
          elapsed,
          extra,
        },
      },
      league: {
        id: 1,
        name: 'L',
        country: 'X',
        logo: '',
        flag: null,
        season: 2026,
        round: 'R',
      },
      teams: {
        home: { id: 1, name: 'Home', logo: '', winner: null },
        away: { id: 2, name: 'Away', logo: '', winner: null },
      },
      goals: { home: opts.home, away: opts.away },
      score: {
        halftime: { home: null, away: null },
        fulltime: { home: null, away: null },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    },
  };
}

describe('overlaySnapshotsOnFavorites', () => {
  it('1. live store score/elapsed wins over stale competitor 0-0 / 46', () => {
    const row = makeRow({ id: '4805186', homeScore: 0, awayScore: 0, elapsed: 46, minute: "46'" });
    const snap = makeSnap(4805186, { home: 1, away: 1, short: '2H', elapsed: 81 });
    const out = overlaySnapshotsOnFavorites([row], { 4805186: snap });
    expect(out[0].homeScore).toBe(1);
    expect(out[0].awayScore).toBe(1);
    expect(out[0].elapsed).toBe(81);
    expect(out[0].statusShort).toBe('2H');
    expect(out[0].minute).toBe("81'");
    expect(row.homeScore).toBe(0);
    expect(row.elapsed).toBe(46);
  });

  it('2. live store FT wins over competitor LIVE', () => {
    const row = makeRow({ id: '10', status: 'LIVE', statusShort: '2H', elapsed: 90 });
    const snap = makeSnap(10, {
      home: 2,
      away: 1,
      short: 'FT',
      elapsed: 90,
      phase: 'finished',
    });
    const out = overlaySnapshotsOnFavorites([row], { 10: snap });
    expect(out[0].status).toBe('FT');
    expect(out[0].live).toBe(false);
    expect(out[0].statusShort).toBe('FT');
    expect(out[0].homeScore).toBe(2);
    expect(out[0].awayScore).toBe(1);
    expect(out[0].minute).toBeUndefined();
  });

  it('3. missing live snapshot keeps competitor/cache data', () => {
    const row = makeRow({ id: '11', homeScore: 3, awayScore: 0, elapsed: 12, minute: "12'" });
    const rows = [row];
    const out = overlaySnapshotsOnFavorites(rows, {});
    expect(out).toBe(rows);
    expect(out[0]).toBe(row);
  });

  it('4. non-live upcoming without live snap stays unchanged', () => {
    const row = makeRow({
      id: '12',
      status: 'UPCOMING',
      live: false,
      statusShort: 'NS',
      elapsed: null,
      minute: undefined,
      homeScore: 0,
      awayScore: 0,
    });
    const out = overlaySnapshotsOnFavorites([row], {});
    expect(out[0]).toBe(row);
  });

  it('5. HT snapshot shows HT statusShort', () => {
    const row = makeRow({ id: '13', elapsed: 45, minute: "45'", statusShort: '1H' });
    const snap = makeSnap(13, {
      home: 0,
      away: 1,
      short: 'HT',
      elapsed: 45,
      phase: 'live',
    });
    const out = overlaySnapshotsOnFavorites([row], { 13: snap });
    expect(out[0].statusShort).toBe('HT');
    expect(out[0].minute).toBe('HT');
    expect(out[0].status).toBe('LIVE');
  });

  it('6. score update 0-0 → 1-0 from live store', () => {
    const row = makeRow({ id: '14', homeScore: 0, awayScore: 0 });
    const snap = makeSnap(14, { home: 1, away: 0, short: '1H', elapsed: 31 });
    const out = overlaySnapshotsOnFavorites([row], { 14: snap });
    expect(out[0].homeScore).toBe(1);
    expect(out[0].awayScore).toBe(0);
    expect(out[0].elapsed).toBe(31);
  });

  it('7. stoppage extra from live store is preserved', () => {
    const row = makeRow({
      id: '15',
      statusShort: '2H',
      elapsed: 90,
      extra: null,
      minute: "90'",
    });
    const snap = makeSnap(15, {
      home: 1,
      away: 1,
      short: '2H',
      elapsed: 90,
      extra: 4,
    });
    const out = overlaySnapshotsOnFavorites([row], { 15: snap });
    expect(out[0].extra).toBe(4);
    expect(out[0].minute).toBe("90+4'");
  });

  it('8. does not mutate original competitor row', () => {
    const row = makeRow({ id: '16', homeScore: 0, awayScore: 0, elapsed: 46 });
    const frozen = { ...row };
    const snap = makeSnap(16, { home: 2, away: 2, short: '2H', elapsed: 70 });
    overlaySnapshotsOnFavorites([row], { 16: snap });
    expect(row).toEqual(frozen);
  });

  it('9. does not mutate liveFixtureStore snapshot object', () => {
    const row = makeRow({ id: '17' });
    const snap = makeSnap(17, { home: 1, away: 0, short: '1H', elapsed: 20 });
    const goalsBefore = { ...snap.fixture.goals };
    const statusBefore = { ...snap.fixture.fixture.status };
    overlaySnapshotsOnFavorites([row], { 17: snap });
    expect(snap.fixture.goals).toEqual(goalsBefore);
    expect(snap.fixture.fixture.status).toEqual(statusBefore);
  });

  it('10. only fixtures with snapshots are overlaid', () => {
    const a = makeRow({ id: '18', homeScore: 0, awayScore: 0, elapsed: 10 });
    const b = makeRow({ id: '19', homeScore: 5, awayScore: 5, elapsed: 88 });
    const snap = makeSnap(18, { home: 1, away: 0, short: '1H', elapsed: 22 });
    const out = overlaySnapshotsOnFavorites([a, b], { 18: snap });
    expect(out[0].homeScore).toBe(1);
    expect(out[0].elapsed).toBe(22);
    expect(out[1]).toBe(b);
    expect(out[1].homeScore).toBe(5);
  });

  it('11. fresher competitor wins over stale live snapshot (decideLiveMerge)', () => {
    const row = makeRow({
      id: '20',
      homeScore: 2,
      awayScore: 1,
      statusShort: '2H',
      elapsed: 85,
      minute: "85'",
    });
    const snap = makeSnap(20, {
      home: 0,
      away: 0,
      short: '2H',
      elapsed: 46,
    });
    const out = overlaySnapshotsOnFavorites([row], { 20: snap });
    expect(out[0].homeScore).toBe(2);
    expect(out[0].awayScore).toBe(1);
    expect(out[0].elapsed).toBe(85);
  });

  it('12. terminal FT snapshot wins over stale LIVE competitor', () => {
    const row = makeRow({
      id: '21',
      status: 'LIVE',
      statusShort: '2H',
      elapsed: 90,
      homeScore: 1,
      awayScore: 1,
    });
    const snap = makeSnap(21, {
      home: 2,
      away: 1,
      short: 'FT',
      elapsed: 90,
      phase: 'finished',
    });
    const out = overlaySnapshotsOnFavorites([row], { 21: snap });
    expect(out[0].status).toBe('FT');
    expect(out[0].statusShort).toBe('FT');
    expect(out[0].homeScore).toBe(2);
  });

  it('finished Favorites row is not revived by leftover live snapshot', () => {
    const row = makeRow({
      id: '22',
      status: 'FT',
      live: false,
      statusShort: 'FT',
      homeScore: 2,
      awayScore: 0,
      elapsed: 90,
      minute: undefined,
    });
    const snap = makeSnap(22, {
      home: 1,
      away: 0,
      short: '2H',
      elapsed: 70,
      phase: 'live',
    });
    const out = overlaySnapshotsOnFavorites([row], { 22: snap });
    expect(out[0]).toBe(row);
  });
});

describe('favoritesRowFromSnapshot / clock helpers', () => {
  it('clockFromFavoritesListFixture mirrors score and elapsed', () => {
    const row = makeRow({ id: '1', homeScore: 2, awayScore: 3, elapsed: 55, extra: 2 });
    expect(clockFromFavoritesListFixture(row)).toEqual({
      short: '1H',
      elapsed: 55,
      extra: 2,
      home: 2,
      away: 3,
    });
  });

  it('favoritesRowFromSnapshot keeps base team names', () => {
    const row = makeRow({ id: '30', home: 'Sobemap', away: 'Enugu' });
    const snap = makeSnap(30, { home: 1, away: 1, short: '2H', elapsed: 66 });
    const out = favoritesRowFromSnapshot(row, snap);
    expect(out.home).toBe('Sobemap');
    expect(out.away).toBe('Enugu');
    expect(out.homeScore).toBe(1);
  });
});
