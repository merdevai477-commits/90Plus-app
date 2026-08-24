import { interpretScores365GameFetch } from '../scores365-experiment.service';
import { fixtureFromMissing365Game } from '../../utils/fixture-terminal.util';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../match-cache.service', () => ({
  matchCacheService: {},
  LIVE_STATUSES: ['1H', '2H', 'HT', 'LIVE'],
  FINISHED_STATUSES: ['FT', 'AET', 'PEN'],
}));

describe('365 game fetch gone vs transient', () => {
  it('treats empty 200 and 404 as retired gameIds', () => {
    expect(interpretScores365GameFetch(200, null)).toBe('gone');
    expect(interpretScores365GameFetch(404, null)).toBe('gone');
    expect(interpretScores365GameFetch(500, null)).toBe('transient');
    expect(interpretScores365GameFetch(200, { id: 1 })).toBe('ok');
  });

  it('builds a finished snapshot when /web/game is empty so the live list can drop it', () => {
    const previous = {
      fixture: { id: 4_751_186, status: { short: '1H', long: 'First Half', elapsed: 2 } },
      league: { id: 7_000_007, name: 'LaLiga 2', country: 'Spain', logo: '', flag: null, season: 2026, round: '' },
      teams: {
        home: { id: 1, name: 'Granada', logo: '', winner: null },
        away: { id: 2, name: 'Mallorca', logo: '', winner: null },
      },
      goals: { home: 0, away: 0 },
      score: {
        halftime: { home: null, away: null },
        fulltime: { home: null, away: null },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    } as any;

    const terminal = fixtureFromMissing365Game(4_751_186, previous);
    expect(terminal.fixture.status.short).toBe('FT');
    expect(terminal.fixture.id).toBe(4_751_186);
  });
});
