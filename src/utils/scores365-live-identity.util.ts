import { calendarDateFromKickoff } from './calendar-day-bounds.util';
import { SCORES365_LEAGUE_ID_OFFSET } from './scores365-league-id.util';
import { teamNamesLooselyMatch } from './team-name-match.util';

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
  // Prefer Unicode-aware matching so Arabic club names (الأهلي vs البنك الأهلي)
  // stay distinct. Fall back to the legacy ASCII key for Latin-only rows.
  if (teamNamesLooselyMatch(a, b)) return true;
  const na = normalizeScores365TeamName(a);
  const nb = normalizeScores365TeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const strip = (value: string) => value.replace(/(sc|fc|cf|ac|afc|cfc)$/i, '');
  const sa = strip(na);
  const sb = strip(nb);
  return sa.length >= 3 && sb.length >= 3 && sa === sb;
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

/** Longest stoppage still treated as real play (45+14 / 90+13 happen in top football). */
export const MAX_PLAUSIBLE_STOPPAGE = 20;
/**
 * Wall-clock net for a feed stuck "in play" at 90'+. Worst real case is about
 * 15 late + 45+20 + 20 HT + 45+20 = 165 min after the listed kickoff; anything
 * sooner can still be stoppage time with goals to come.
 */
export const STALE_2H_AGE_MIN = 170;
/** 45 + 15 HT is the earliest a second half can start after the listed kickoff. */
const EARLIEST_2H_AGE_MIN = 55;
const REGULAR_MAX_STOPPAGE = MAX_PLAUSIBLE_STOPPAGE;
const LIVE_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_SHORTS = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);

export function parseStoppageFromDisplay(display?: string | null, minute?: number | null): number | null {
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

/**
 * First vs second half from 365 hints. Period text and a `45+N` / `90+N`
 * display win over the raw clock: during first-half stoppage 365 can report
 * gameTime 46–50 while the match is still in the first half.
 */
export function resolve365InPlayHalf(hints: {
  text: string;
  display?: string | null;
  minute: number | null;
  startTime?: string | null;
  allowClock?: boolean;
  nowMs?: number;
}): '1H' | '2H' | null {
  const text = hints.text.toLowerCase();
  const tokens = text.split(/\s+/);
  if (
    text.includes('2nd') ||
    text.includes('second') ||
    text.includes('الثاني') ||
    tokens.includes('2') ||
    tokens.includes('2h')
  ) {
    return '2H';
  }
  if (
    text.includes('1st') ||
    text.includes('first') ||
    text.includes('الأول') ||
    tokens.includes('1') ||
    tokens.includes('1h')
  ) {
    return '1H';
  }
  const display = (hints.display ?? '').trim();
  if (/^45\s*\+/.test(display)) return '1H';
  if (/^90\s*\+/.test(display)) return '2H';

  if (hints.allowClock === false || hints.minute == null || hints.minute <= 0) return null;
  if (hints.minute <= 45) return '1H';
  const kick = hints.startTime ? Date.parse(hints.startTime) : Number.NaN;
  if (
    Number.isFinite(kick) &&
    (hints.nowMs ?? Date.now()) - kick < EARLIEST_2H_AGE_MIN * 60_000
  ) {
    return '1H';
  }
  return '2H';
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
  if (s === '1H' && elapsed != null && elapsed > 45 + REGULAR_MAX_STOPPAGE) return true;
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
  const half = resolve365InPlayHalf({
    text,
    display: raw.gameTimeDisplay,
    minute,
    startTime: raw.startTime,
  });
  if (text.includes('halftime') || text.includes('half time') || text === 'ht' || short === 'HT') {
    coerced = 'HT';
    long = 'Halftime';
    elapsed = 45;
  } else if (half === '2H') {
    coerced = '2H';
    long = 'Second Half';
  } else if (half === '1H') {
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
