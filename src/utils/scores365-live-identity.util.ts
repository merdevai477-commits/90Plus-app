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

const REGULAR_MAX_STOPPAGE = 15;
const STALE_2H_AGE_MIN = 125;
const LIVE_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_SHORTS = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);

function parseStoppageFromDisplay(display?: string | null, minute?: number | null): number | null {
  const raw = (display ?? '').trim();
  if (!raw) return null;
  const plusMatch = raw.match(/(\d+)\s*\+\s*(\d+)/);
  if (plusMatch) {
    const n = Number(plusMatch[2]);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), REGULAR_MAX_STOPPAGE) : null;
  }
  const barePlus = raw.match(/^\+?\s*(\d+)\s*'?$/);
  if (barePlus && minute != null && (minute === 45 || minute === 90 || minute === 105 || minute === 120)) {
    const n = Number(barePlus[1]);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), REGULAR_MAX_STOPPAGE) : null;
  }
  return null;
}

export type Stale365ClockRaw = {
  statusGroup?: number;
  gameTime?: number;
  gameTimeDisplay?: string;
  startTime?: string;
  statusText?: string;
  shortStatusText?: string;
};

/**
 * 365 can stay statusGroup=3 with a stuck `90+15` / gameTime 105 after FT.
 * Do not treat those as live, and do not coerce classifier FT back to 2H.
 */
export function isStale365InPlayClock(raw?: Stale365ClockRaw | null, nowMs = Date.now()): boolean {
  if (!raw) return false;
  const hay = `${raw.statusText ?? ''} ${raw.shortStatusText ?? ''} ${raw.gameTimeDisplay ?? ''}`.toLowerCase();
  if (
    hay.includes('extra time') ||
    hay.includes('extra-time') ||
    hay.includes('penalt') ||
    hay.includes('shootout')
  ) {
    return false;
  }
  const minute = raw.gameTime != null && raw.gameTime >= 0 ? Math.floor(raw.gameTime) : null;
  const extra = parseStoppageFromDisplay(raw.gameTimeDisplay, minute);
  if (minute != null && minute >= 90 + REGULAR_MAX_STOPPAGE) return true;
  if (minute != null && minute >= 90 && extra != null && extra >= REGULAR_MAX_STOPPAGE) return true;
  const kick = raw.startTime ? Date.parse(raw.startTime) : Number.NaN;
  return (
    Number.isFinite(kick) &&
    nowMs - kick >= STALE_2H_AGE_MIN * 60_000 &&
    minute != null &&
    minute >= 90
  );
}

/** Client-mapped fixture clocks (elapsed/extra) — same cap as the matches list. */
export function isStaleMappedInPlayClock(opts: {
  statusShort?: string | null;
  elapsed?: number | null;
  extra?: number | null;
  kickoffIso?: string | null;
  nowMs?: number;
}): boolean {
  const s = (opts.statusShort ?? '').trim().toUpperCase();
  if (s !== '1H' && s !== '2H' && s !== 'LIVE' && s !== 'FT') return false;
  const elapsed = opts.elapsed;
  const extra = opts.extra;
  if (s === '1H' && elapsed != null && elapsed > 60) return true;
  if (s === '2H' || s === 'LIVE' || s === 'FT') {
    if (elapsed != null && elapsed >= 90 + REGULAR_MAX_STOPPAGE) return true;
    if (elapsed != null && elapsed >= 90 && extra != null && extra >= REGULAR_MAX_STOPPAGE) {
      return true;
    }
  }
  if (!opts.kickoffIso) return false;
  const kick = Date.parse(opts.kickoffIso);
  if (!Number.isFinite(kick)) return false;
  const ageMin = ((opts.nowMs ?? Date.now()) - kick) / 60_000;
  return (
    (s === '2H' || s === 'LIVE' || s === 'FT') &&
    ageMin >= STALE_2H_AGE_MIN &&
    elapsed != null &&
    elapsed >= 90
  );
}

/** 365 allscores live set — statusGroup 3 wins unless the clock is stuck past FT. */
export function isAllScoresLiveItem(item: {
  phase?: string;
  raw?: Stale365ClockRaw;
}): boolean {
  if (isStale365InPlayClock(item.raw)) return false;
  if (item.raw?.statusGroup === 3) return true;
  return item.phase === 'live';
}

export function coerceAllScoresLiveStatus<
  T extends {
    fixture?: {
      status?: { short?: string; long?: string; elapsed?: number | null; extra?: number | null };
    };
  },
>(
  fixture: T,
  raw?: Stale365ClockRaw & {
    statusText?: string;
    shortStatusText?: string;
    gameTime?: number;
  },
): T {
  const short = fixture.fixture?.status?.short ?? '';
  const finishStale = (): T => ({
    ...fixture,
    fixture: {
      ...fixture.fixture,
      status: {
        ...fixture.fixture?.status,
        short: 'FT',
        long: 'Match Finished',
        elapsed: 90,
        extra: null,
      },
    },
  });

  if (isStale365InPlayClock(raw)) return finishStale();
  if (LIVE_SHORTS.has(short)) return fixture;
  if (FINISHED_SHORTS.has(short) && raw?.statusGroup !== 3) return fixture;
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
