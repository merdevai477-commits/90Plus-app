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

/**
 * A full Sunday is ~700 fixtures. Capping at 400 kept only the earliest
 * kickoffs, so Zamalek vs Al Ahly (kickoff 20:00 Cairo, ~426th of the day)
 * never reached the sponsor picker.
 */
const MAX_ROWS_PER_DAY = 2000;

const FIXTURE_SELECT = {
  fixtureId: true,
  matchDate: true,
  status: true,
  homeTeamName: true,
  homeTeamLogo: true,
  awayTeamName: true,
  awayTeamLogo: true,
  leagueName: true,
  leagueId: true,
} as const;

export interface PoolSourceFixture {
  fixture: { id: number; date: string; status: { short: string } };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  league: { name: string | null; id: number };
}

type FixtureRow = {
  fixtureId: number;
  matchDate: Date;
  status: string | null;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  leagueName: string | null;
  leagueId: number;
};

/** Always loaded, even when the day's row cap would have dropped a late kickoff. */
function cairoDerbyWhere(start: Date, end: Date) {
  const ahly = { contains: 'Ahly', mode: 'insensitive' as const };
  const zamalek = { contains: 'Zamalek', mode: 'insensitive' as const };
  return {
    matchDate: { gte: start, lte: end },
    OR: [
      { homeTeamName: ahly, awayTeamName: zamalek },
      { homeTeamName: zamalek, awayTeamName: ahly },
      { homeTeamName: { contains: 'الأهلي' }, awayTeamName: { contains: 'الزمالك' } },
      { homeTeamName: { contains: 'الزمالك' }, awayTeamName: { contains: 'الأهلي' } },
      { homeTeamName: { contains: 'الاهلي' }, awayTeamName: { contains: 'الزمالك' } },
      { homeTeamName: { contains: 'الزمالك' }, awayTeamName: { contains: 'الاهلي' } },
    ],
  };
}

export async function loadPoolFixturesForDate(day: string): Promise<PoolSourceFixture[]> {
  const { start, end } = calendarDayBounds(day);
  const [rows, derbyRows] = await Promise.all([
    prisma.cachedFixture.findMany({
      where: { matchDate: { gte: start, lte: end } },
      select: FIXTURE_SELECT,
      orderBy: [{ matchDate: 'asc' }, { matchTimestamp: 'asc' }],
      take: MAX_ROWS_PER_DAY,
    }),
    prisma.cachedFixture.findMany({
      where: cairoDerbyWhere(start, end),
      select: FIXTURE_SELECT,
    }),
  ]);

  const byId = new Map<number, FixtureRow>();
  for (const row of rows) byId.set(row.fixtureId, row);
  for (const row of derbyRows) byId.set(row.fixtureId, row);
  const merged = [...byId.values()];

  const mapRow = (row: FixtureRow): PoolSourceFixture => ({
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
  });

  const all = merged.map(mapRow);
  const native365 = merged.filter((row) => isNative365FixtureId(row.fixtureId)).map(mapRow);
  // Prefer Scores365 ids when present; otherwise fall back to any cached fixture
  // so sponsors are not blocked when the cache only holds API-Football ids.
  return native365.length > 0 ? native365 : all;
}
