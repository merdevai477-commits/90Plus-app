import { LEAGUES } from '../../data/leagues';
import { PredictionsService } from '../../services/predictions.service';
import { mapFixturesToMatches } from '../Matches/leagueApiUtils';
import type { Match } from '../Matches/matchCardUtils';

/** Major leagues shown on the King week card (Figma logos + overflow). */
export const KING_LEAGUE_IDS = [39, 140, 135, 78, 61, 200, 307, 496, 94, 88, 233, 2] as const;

export const KING_BG = '#030303';
export const KING_PURPLE = '#8B5CF6';
export const KING_PURPLE_DEEP = '#513690';
export const KING_CARD = '#16082E';
export const KING_LINE = 'rgba(27,15,57,0.8)';

export type KingRouteMode = 'game' | 'results';

export function toApiMode(mode: KingRouteMode): 'winner' | 'exact' {
  return mode === 'results' ? 'exact' : 'winner';
}

export function parseKingMode(value: unknown): KingRouteMode {
  return value === 'results' ? 'results' : 'game';
}

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The King day and its Sunday–Saturday week as YYYY-MM-DD keys, in Cairo time. */
export type KingCalendar = { today: string; days: string[] };

/** Today in Cairo; the device day when the engine has no time zone data. */
export function cairoTodayKey(now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return localDateKey(now);
  }
}

/** Device-side guess of the server calendar, used until `/king/matches` answers (C2, C3). */
export function fallbackKingCalendar(now = new Date()): KingCalendar {
  const today = cairoTodayKey(now);
  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d - weekday + i)).toISOString().slice(0, 10),
  );
  return { today, days };
}

export function kingLeagueLogos(): { id: number; logo: string }[] {
  return KING_LEAGUE_IDS.flatMap((id) => {
    const league = LEAGUES.find((row) => row.id === id);
    return league ? [{ id, logo: league.logo }] : [];
  });
}

type CachedKingMatches = {
  matches: Match[];
  calendar: KingCalendar | null;
  at: number;
};

const KING_MATCHES_FRESH_MS = 15_000;
const kingMatchesCache = new Map<string, CachedKingMatches>();
const kingMatchesInflight = new Map<string, Promise<{ matches: Match[]; calendar: KingCalendar | null }>>();

export function clearKingMatchesCache(): void {
  kingMatchesCache.clear();
}

/** Last list for this day, including one that is ready to refresh. */
export function peekKingMatches(
  dateKey: string,
): { matches: Match[]; calendar: KingCalendar | null } | null {
  const hit = kingMatchesCache.get(dateKey);
  if (!hit) return null;
  return { matches: hit.matches, calendar: hit.calendar };
}

export function prefetchKingMatches(dateKey: string): void {
  void fetchKingMatches(dateKey).catch(() => undefined);
}

export async function fetchKingMatches(
  dateKey: string,
  options?: { force?: boolean },
): Promise<{ matches: Match[]; calendar: KingCalendar | null }> {
  const hit = kingMatchesCache.get(dateKey);
  if (hit && !options?.force && Date.now() - hit.at < KING_MATCHES_FRESH_MS) {
    return { matches: hit.matches, calendar: hit.calendar };
  }

  if (!options?.force) {
    const pending = kingMatchesInflight.get(dateKey);
    if (pending) return pending;
  }

  const job = (async () => {
    try {
      const { fixtures, calendar } = await PredictionsService.getKingMatches(dateKey, {
        fresh: options?.force === true,
      });
      const result = {
        matches: mapFixturesToMatches(fixtures as Parameters<typeof mapFixturesToMatches>[0]),
        calendar,
      };
      kingMatchesCache.set(dateKey, { ...result, at: Date.now() });
      return result;
    } catch (error) {
      if (hit) return { matches: hit.matches, calendar: hit.calendar };
      throw error;
    }
  })();

  kingMatchesInflight.set(dateKey, job);
  try {
    return await job;
  } finally {
    if (kingMatchesInflight.get(dateKey) === job) kingMatchesInflight.delete(dateKey);
  }
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
