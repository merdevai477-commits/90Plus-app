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
    fixtureDate: '2026-08-24T17:00:00.000Z',
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

  it('keeps a calendar FT short status when demoting a stale live row', () => {
    const calendar = [makeMatch({ id: '1', status: 'live', statusShort: 'FT' })];
    const merged = mergeTodayCalendarWithLiveFeed(calendar, []);
    expect(merged[0].status).toBe('finished');
    expect(merged[0].statusShort).toBe('FT');
  });
});
