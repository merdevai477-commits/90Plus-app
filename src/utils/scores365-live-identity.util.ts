import { calendarDateFromKickoff } from './calendar-day-bounds.util';
import { SCORES365_LEAGUE_ID_OFFSET } from './scores365-league-id.util';

export type SyntheticIdentityRow = {
  fixtureId: number;
  leagueId: number;
  homeTeamName: string;
  awayTeamName: string;
  matchDate: Date;
  matchTimestamp?: number | null;
  status?: string;
};

export type Incoming365GameIdentity = {
  gameId: number;
  startTime?: string;
  homeName?: string;
  awayName?: string;
  competitionId?: number;
};

export function normalizeScores365TeamName(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function scores365TeamNamesMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeScores365TeamName(a);
  const nb = normalizeScores365TeamName(b);
  return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
}

export function isHotAllScoresPersistItem(
  item: {
    phase: 'upcoming' | 'live' | 'finished';
    startTime?: string;
    raw?: { statusGroup?: number; startTime?: string };
  },
  nowMs = Date.now(),
): boolean {
  if (isAllScoresLiveItem(item)) return true;
  if (item.phase !== 'finished') return false;
  const startRaw = item.raw?.startTime ?? item.startTime;
  const start = startRaw ? Date.parse(startRaw) : Number.NaN;
  if (!Number.isFinite(start)) return item.raw?.statusGroup === 4;
  return nowMs - start <= 8 * 60 * 60 * 1000;
}

/** 365 allscores live set — statusGroup 3 wins over our classifier. */
export function isAllScoresLiveItem(item: {
  phase?: string;
  raw?: { statusGroup?: number };
}): boolean {
  if (item.raw?.statusGroup === 3) return true;
  return item.phase === 'live';
}

const LIVE_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);

export function coerceAllScoresLiveStatus<
  T extends {
    fixture?: {
      status?: { short?: string; long?: string; elapsed?: number | null; extra?: number | null };
    };
  },
>(
  fixture: T,
  raw?: {
    statusGroup?: number;
    statusText?: string;
    shortStatusText?: string;
    gameTime?: number;
  },
): T {
  const short = fixture.fixture?.status?.short ?? '';
  if (LIVE_SHORTS.has(short)) return fixture;
  if (raw?.statusGroup !== 3) return fixture;

  const minute = raw.gameTime != null && raw.gameTime >= 0 ? Math.floor(raw.gameTime) : null;
  const text = `${raw.statusText ?? ''} ${raw.shortStatusText ?? ''}`.toLowerCase();
  let coerced = 'LIVE';
  let long = 'In Progress';
  let elapsed = minute;
  if (text.includes('halftime') || text.includes('half time') || text === 'ht' || short === 'HT') {
    coerced = 'HT';
    long = 'Halftime';
    elapsed = 45;
  } else if (text.includes('2nd') || text.includes('second') || (minute != null && minute > 45)) {
    coerced = '2H';
    long = 'Second Half';
  } else if (text.includes('1st') || text.includes('first') || (minute != null && minute > 0)) {
    coerced = '1H';
    long = 'First Half';
  }

  return {
    ...fixture,
    fixture: {
      ...fixture.fixture,
      status: {
        ...fixture.fixture?.status,
        short: coerced,
        long,
        elapsed,
      },
    },
  };
}

/**
 * 365 sometimes replaces a live gameId (ghost 4751186 → real 4822440).
 * Same teams + synthetic league + same kickoff calendar day, different id.
 */
export function findReplacedSyntheticFixture(
  incoming: Incoming365GameIdentity,
  rows: SyntheticIdentityRow[],
): SyntheticIdentityRow | null {
  if (!incoming.gameId) return null;
  const incomingDay = calendarDateFromKickoff(incoming.startTime);
  if (!incomingDay) return null;
  const incomingLeagueId =
    incoming.competitionId != null && incoming.competitionId > 0
      ? SCORES365_LEAGUE_ID_OFFSET + incoming.competitionId
      : null;

  const matches = rows.filter((row) => {
    if (row.fixtureId === incoming.gameId) return false;
    if (row.leagueId < SCORES365_LEAGUE_ID_OFFSET) return false;
    if (incomingLeagueId != null && row.leagueId !== incomingLeagueId) return false;
    const kickoffIso =
      row.matchTimestamp != null && row.matchTimestamp > 0
        ? new Date(row.matchTimestamp * 1000).toISOString()
        : row.matchDate instanceof Date
          ? row.matchDate.toISOString()
          : String(row.matchDate);
    const rowDay = calendarDateFromKickoff(kickoffIso);
    if (rowDay !== incomingDay) return false;
    return (
      scores365TeamNamesMatch(incoming.homeName, row.homeTeamName) &&
      scores365TeamNamesMatch(incoming.awayName, row.awayTeamName)
    );
  });

  if (matches.length === 1) return matches[0];
  return null;
}
