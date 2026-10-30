import {
  LIVE_FEED_GAP_GRACE_MS,
  __resetLiveFeedGapTrackerForTests,
  mergeTodayCalendarWithLiveFeed,
} from '../mergeTodayCalendarWithLiveFeed';
import type { Match } from '../../components/Matches/matchCardUtils';

function makeMatch(overrides: Partial<Match> & { id: string }): Match {
  return {
    homeTeam: { name: 'Home', logo: '' },
    awayTeam: { name: 'Away', logo: '' },
    score: { home: 0, away: 0 },
    status: 'upcoming',
    time: '20:00',
    league: { id: 1, name: 'Liga', logo: '', country: 'Spain' },
    fixtureDate: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe('mergeTodayCalendarWithLiveFeed', () => {
  const T0 = Date.now();
  const sibling = makeMatch({ id: '4732168', status: 'live', statusShort: '2H', elapsed: 60 });

  beforeEach(() => {
    __resetLiveFeedGapTrackerForTests();
  });

  it('demotes a played-out live row only after it stays missing past the grace window', () => {
    const calendar = [
      makeMatch({ id: '4751186', status: 'live', statusShort: '2H', elapsed: 90, extra: 5 }),
      sibling,
    ];
    const liveFeed = [sibling];

    const first = mergeTodayCalendarWithLiveFeed(calendar, liveFeed, T0);
    expect(first.find((row) => row.id === '4751186')?.status).toBe('live');

    const later = mergeTodayCalendarWithLiveFeed(calendar, liveFeed, T0 + LIVE_FEED_GAP_GRACE_MS);
    const ghost = later.find((row) => row.id === '4751186');
    expect(ghost?.status).toBe('finished');
    expect(ghost?.statusShort).toBe('FT');
    expect(ghost?.finishedByFeedGap).toBe(true);
    expect(later.find((row) => row.id === '4732168')?.status).toBe('live');
  });

  it('never ends a mid-match row (1H / 2H before 90) just because it left the feed', () => {
    const calendar = [
      makeMatch({ id: '1', status: 'live', statusShort: '1H', elapsed: 45, extra: 3 }),
      makeMatch({ id: '2', status: 'live', statusShort: '2H', elapsed: 70 }),
      sibling,
    ];
    mergeTodayCalendarWithLiveFeed(calendar, [sibling], T0);
    const merged = mergeTodayCalendarWithLiveFeed(calendar, [sibling], T0 + 10 * 60_000);
    expect(merged.find((row) => row.id === '1')?.status).toBe('live');
    expect(merged.find((row) => row.id === '2')?.status).toBe('live');
  });

  it('ends a ghost live row whose kickoff is long past once the grace window passes', () => {
    const calendar = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '1H',
        elapsed: 30,
        fixtureDate: new Date(T0 - 4 * 60 * 60_000).toISOString(),
      }),
      sibling,
    ];
    mergeTodayCalendarWithLiveFeed(calendar, [sibling], T0);
    const merged = mergeTodayCalendarWithLiveFeed(calendar, [sibling], T0 + LIVE_FEED_GAP_GRACE_MS);
    expect(merged.find((row) => row.id === '1')?.status).toBe('finished');
  });

  it('revives a feed-gap FT when the match comes back to the live feed', () => {
    const calendar = [
      makeMatch({ id: '1', status: 'live', statusShort: '2H', elapsed: 90, extra: 3 }),
      sibling,
    ];
    mergeTodayCalendarWithLiveFeed(calendar, [sibling], T0);
    const ended = mergeTodayCalendarWithLiveFeed(calendar, [sibling], T0 + LIVE_FEED_GAP_GRACE_MS);
    expect(ended.find((row) => row.id === '1')?.status).toBe('finished');

    const back = makeMatch({
      id: '1',
      status: 'live',
      statusShort: '2H',
      elapsed: 90,
      extra: 6,
      score: { home: 1, away: 0 },
    });
    const revived = mergeTodayCalendarWithLiveFeed(ended, [sibling, back], T0 + 60_000);
    const row = revived.find((r) => r.id === '1');
    expect(row?.status).toBe('live');
    expect(row?.extra).toBe(6);
    expect(row?.score.home).toBe(1);
    expect(row?.finishedByFeedGap).toBeUndefined();
  });

  it('does not demote calendar live rows when the live feed is empty', () => {
    const calendar = [makeMatch({ id: '1', status: 'live', statusShort: '1H' })];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, []);
    expect(merged[0].status).toBe('live');
    expect(merged[0].statusShort).toBe('1H');
  });

  it('keeps a calendar FT short status when demoting a stale live row', () => {
    const calendar = [makeMatch({ id: '1', status: 'live', statusShort: 'FT' })];
    const liveFeed = [makeMatch({ id: '2', status: 'live', statusShort: '1H' })];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, liveFeed);
    expect(merged.find((row) => row.id === '1')?.status).toBe('finished');
    expect(merged.find((row) => row.id === '1')?.statusShort).toBe('FT');
  });

  it('finishes a stuck 90+20 live row even when it is the only live match', () => {
    const calendar = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '2H',
        elapsed: 90,
        extra: 20,
        score: { home: 2, away: 4 },
      }),
    ];
    const liveFeed = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '2H',
        elapsed: 90,
        extra: 20,
        score: { home: 2, away: 4 },
      }),
    ];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, liveFeed);
    expect(merged[0].status).toBe('finished');
    expect(merged[0].statusShort).toBe('FT');
  });

  it('does not revive a calendar FT row from a lagging live feed', () => {
    const calendar = [
      makeMatch({
        id: '1',
        status: 'finished',
        statusShort: 'FT',
        score: { home: 0, away: 2 },
      }),
    ];
    const liveFeed = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '2H',
        elapsed: 90,
        extra: 7,
        score: { home: 0, away: 2 },
      }),
    ];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, liveFeed);
    expect(merged[0].status).toBe('finished');
    expect(merged[0].statusShort).toBe('FT');
  });

  it('returns the same calendar array when the live tick changes nothing', () => {
    const calendar = [
      makeMatch({ id: '1', status: 'live', statusShort: '1H', elapsed: 30, minute: "30'", score: { home: 1, away: 0 } }),
      makeMatch({ id: '2', status: 'upcoming' }),
    ];
    const liveFeed = [
      makeMatch({ id: '1', status: 'live', statusShort: '1H', elapsed: 30, minute: "30'", score: { home: 1, away: 0 } }),
    ];
    expect(mergeTodayCalendarWithLiveFeed(calendar, liveFeed)).toBe(calendar);
  });

  it('replaces only the row whose score changed', () => {
    const calendar = [
      makeMatch({ id: '1', status: 'live', statusShort: '1H', elapsed: 30, score: { home: 0, away: 0 } }),
      makeMatch({ id: '2', status: 'upcoming' }),
    ];
    const liveFeed = [
      makeMatch({ id: '1', status: 'live', statusShort: '1H', elapsed: 31, score: { home: 1, away: 0 } }),
    ];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, liveFeed);
    expect(merged).not.toBe(calendar);
    expect(merged[0].score.home).toBe(1);
    expect(merged[1]).toBe(calendar[1]);
  });

  it('adds a missing in-play row but not a suspended one from another day', () => {
    const calendar = [makeMatch({ id: '1', status: 'upcoming' })];
    const liveFeed = [
      makeMatch({ id: '2', status: 'live', statusShort: '2H', elapsed: 60 }),
      makeMatch({ id: '3', status: 'live', statusShort: 'SUSP', elapsed: 10 }),
      makeMatch({ id: '4', status: 'live', statusShort: 'INT', elapsed: 1 }),
    ];
    const ids = mergeTodayCalendarWithLiveFeed(calendar, liveFeed).map((row) => row.id);
    expect(ids).toEqual(['1', '2']);
  });

  it('still updates a calendar row that becomes suspended', () => {
    const calendar = [makeMatch({ id: '1', status: 'live', statusShort: '1H', elapsed: 20 })];
    const liveFeed = [makeMatch({ id: '1', status: 'live', statusShort: 'SUSP', elapsed: 20 })];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, liveFeed);
    expect(merged[0].statusShort).toBe('SUSP');
  });

  it('keeps a 90+7 stoppage-time row live when the calendar is still live', () => {
    const calendar = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '2H',
        elapsed: 90,
        extra: 7,
        score: { home: 0, away: 2 },
      }),
    ];
    const liveFeed = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '2H',
        elapsed: 90,
        extra: 7,
        score: { home: 0, away: 2 },
      }),
    ];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, liveFeed);
    expect(merged[0].status).toBe('live');
    expect(merged[0].elapsed).toBe(90);
    expect(merged[0].extra).toBe(7);
  });
});
