import { mergeTodayCalendarWithLiveFeed } from '../mergeTodayCalendarWithLiveFeed';
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
  it('demotes calendar live rows that are missing from the live feed', () => {
    const calendar = [
      makeMatch({ id: '4751186', status: 'live', statusShort: '1H', score: { home: 0, away: 0 } }),
      makeMatch({ id: '4732168', status: 'live', statusShort: '2H', score: { home: 1, away: 0 } }),
    ];
    const liveFeed = [
      makeMatch({ id: '4732168', status: 'live', statusShort: '2H', score: { home: 1, away: 0 } }),
    ];

    const merged = mergeTodayCalendarWithLiveFeed(calendar, liveFeed);
    const ghost = merged.find((row) => row.id === '4751186');
    const live = merged.find((row) => row.id === '4732168');

    expect(ghost?.status).toBe('finished');
    expect(ghost?.statusShort).toBe('FT');
    expect(live?.status).toBe('live');
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

  it('finishes a stuck 90+15 live row even when it is the only live match', () => {
    const calendar = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '2H',
        elapsed: 90,
        extra: 15,
        score: { home: 2, away: 4 },
      }),
    ];
    const liveFeed = [
      makeMatch({
        id: '1',
        status: 'live',
        statusShort: '2H',
        elapsed: 90,
        extra: 15,
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
