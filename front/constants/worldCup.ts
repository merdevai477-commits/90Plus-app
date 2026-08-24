/**
 * FIFA World Cup 2026 — central source of truth for the countdown.
 *
 * Opening match: Thursday, June 11, 2026 — Estadio Azteca, Mexico City.
 * Kickoff: 20:00 local (CDT, UTC-5) → 2026-06-12T01:00:00Z.
 *
 * The kickoff is anchored in UTC so every device sees the same remaining time
 * regardless of the user's timezone or DST handling.
 */
export const WC_2026_KICKOFF_UTC: Date = new Date('2026-06-12T01:00:00Z');
export const WC_2026_KICKOFF_MS: number = WC_2026_KICKOFF_UTC.getTime();

export interface WorldCupTimeLeft {
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

/**
 * Time remaining until the World Cup 2026 opening kickoff.
 * Returns a zeroed structure once the event has started.
 */
export function getWorldCupTimeLeft(
  now: number = Date.now(),
  unlockMs: number = WC_2026_KICKOFF_MS,
): WorldCupTimeLeft {
  const diff = unlockMs - now;
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1_000),
  };
}

export function isWorldCupCountdownZero(
  now: number = Date.now(),
  unlockMs: number = WC_2026_KICKOFF_MS,
): boolean {
  return unlockMs - now <= 0;
}

export const padCountdown = (n: number): string => String(n).padStart(2, '0');

/** Official FIFA World Cup 2026 emblem (trophy + FIFA wordmark). */
export const WC_2026_OFFICIAL_LOGO = require('../assets/images/fwc-2026-official-logo.png');

/** API-Football league id for FIFA World Cup. */
export const WC_LEAGUE_ID = 1;

/**
 * True when a league display name is actually the World Cup (not a mis-tagged
 * 365 row that landed on leagueId=1 with e.g. "Italy, Primavera 1").
 */
export function looksLikeWorldCupLeagueName(name?: string | null): boolean {
  return /world\s*cup|fifa|كأس\s*العالم|كاس\s*العالم|مونديال/i.test(name || '');
}

/**
 * 365 non-WC titles are usually "Country, Competition". Real WC rows are either
 * explicitly named World Cup/FIFA or stage-only labels without a country comma
 * (e.g. knockout round names).
 */
export function isMisTaggedWorldCupLeagueName(name?: string | null): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (looksLikeWorldCupLeagueName(n)) return false;
  return /,/.test(n);
}

/**
 * Offset added to a 365Scores competitionId to form a synthetic leagueId for
 * non-WC leagues (mirrors backend SCORES365_LEAGUE_ID_OFFSET). A fixture whose
 * league.id >= this value is a 365Scores-sourced league; its 365 competitionId
 * is `league.id - SCORES365_LEAGUE_ID_OFFSET`.
 */
export const SCORES365_LEAGUE_ID_OFFSET = 7_000_000;

/** Derive the 365 competitionId from a (possibly namespaced) leagueId, else null. */
export function scores365CompetitionIdFromLeagueId(leagueId: number | undefined | null): number | null {
  if (leagueId == null) return null;
  return leagueId >= SCORES365_LEAGUE_ID_OFFSET ? leagueId - SCORES365_LEAGUE_ID_OFFSET : null;
}
