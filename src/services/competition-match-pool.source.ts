/**
 * Predict & Win match pool source — Scores365 cached fixtures only.
 *
 * API-Football ids stay out of this picker: competitions are created against
 * the same 365 game ids the Matches tab already uses, so settlement, live
 * status and logos stay on one provider.
 */

import prisma from '../lib/prisma';
import { calendarDayBounds } from '../utils/calendar-day-bounds.util';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';

const MAX_ROWS_PER_DAY = 400;

export interface PoolSourceFixture {
  fixture: { id: number; date: string; status: { short: string } };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  league: { name: string | null; id: number };
}

export async function loadPoolFixturesForDate(day: string): Promise<PoolSourceFixture[]> {
  const { start, end } = calendarDayBounds(day);
  const rows = await prisma.cachedFixture.findMany({
    where: {
      fixtureId: { gte: 4_000_000 },
      matchDate: { gte: start, lte: end },
    },
    select: {
      fixtureId: true,
      matchDate: true,
      status: true,
      homeTeamName: true,
      homeTeamLogo: true,
      awayTeamName: true,
      awayTeamLogo: true,
      leagueName: true,
      leagueId: true,
    },
    orderBy: { matchTimestamp: 'asc' },
    take: MAX_ROWS_PER_DAY,
  });

  return rows.filter((row) => isNative365FixtureId(row.fixtureId)).map((row) => ({
    fixture: {
      id: row.fixtureId,
      date: row.matchDate.toISOString(),
      status: { short: row.status || 'NS' },
    },
    teams: {
      home: { name: row.homeTeamName, logo: row.homeTeamLogo },
      away: { name: row.awayTeamName, logo: row.awayTeamLogo },
    },
    league: { name: row.leagueName, id: row.leagueId },
  }));
}
