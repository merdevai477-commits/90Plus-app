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
  if (item.phase === 'live') return true;
  if (item.phase !== 'finished') return false;
  const startRaw = item.raw?.startTime ?? item.startTime;
  const start = startRaw ? Date.parse(startRaw) : Number.NaN;
  if (!Number.isFinite(start)) return item.raw?.statusGroup === 4;
  return nowMs - start <= 8 * 60 * 60 * 1000;
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
