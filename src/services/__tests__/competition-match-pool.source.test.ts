/**
 * The daily read used to stop at 400 rows ordered by kickoff. On a full
 * Sunday that cut Zamalek vs Al Ahly (about the 426th fixture) before the
 * picker ever ranked it.
 */

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { cachedFixture: { findMany: jest.fn() } },
}));

import prisma from '../../lib/prisma';
import { loadPoolFixturesForDate } from '../competition-match-pool.source';

const findMany = prisma.cachedFixture.findMany as jest.Mock;

function row(id: number, home: string, away: string) {
  return {
    fixtureId: id,
    matchDate: new Date('2026-10-11T17:00:00.000Z'),
    status: 'NS',
    homeTeamName: home,
    homeTeamLogo: null,
    awayTeamName: away,
    awayTeamLogo: null,
    leagueName: 'Premier League',
    leagueId: 233,
  };
}

describe('loadPoolFixturesForDate', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('merges the Cairo derby when the capped day query missed it', async () => {
    const early = Array.from({ length: 400 }, (_, i) => row(4_000_000 + i, `Home ${i}`, `Away ${i}`));
    const derby = row(4_804_684, 'Zamalek SC', 'Al Ahly SC');
    findMany.mockImplementation(async (args: { where?: { OR?: unknown } }) => {
      if (args?.where?.OR) return [derby];
      return early;
    });

    const fixtures = await loadPoolFixturesForDate('2026-10-11');
    expect(fixtures.some((f) => f.fixture.id === 4_804_684)).toBe(true);
    expect(fixtures.find((f) => f.fixture.id === 4_804_684)?.teams).toEqual({
      home: { name: 'Zamalek SC', logo: null },
      away: { name: 'Al Ahly SC', logo: null },
    });
  });
});
