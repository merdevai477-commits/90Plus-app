import { LEAGUES } from '../../data/leagues';

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

/** Sunday-start week in the device timezone, matching the Figma day strip. */
export function currentWeekDays(now = new Date()): Date[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function kingLeagueLogos(): { id: number; logo: string }[] {
  return KING_LEAGUE_IDS.flatMap((id) => {
    const league = LEAGUES.find((row) => row.id === id);
    return league ? [{ id, logo: league.logo }] : [];
  });
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
