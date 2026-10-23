/**
 * Domestic competition sort priority for the Matches list.
 * Lower number = higher on the list within a country.
 *
 * Keys accept API-Football league ids and Scores365 competition ids
 * (after stripping SCORES365_LEAGUE_ID_OFFSET via resolveCanonicalLeagueId).
 */

import { resolveCanonicalLeagueId } from './internationalCompetition';

/** Default for unknown comps — still above pure alphabetical chaos via name heuristics. */
export const DOMESTIC_PRIORITY_UNKNOWN = 8_000;

/**
 * Curated ranks. Keep Big-5 top flights at the top of their country,
 * then domestic cups, then 2nd tiers, then lower divisions.
 */
const PRIORITY_BY_ID: Record<number, number> = {
  // ── England (API-Football) ─────────────────────────────────────────────
  39: 10, // Premier League
  45: 25, // FA Cup
  48: 30, // EFL Cup / Carabao
  46: 35, // Community Shield
  40: 50, // Championship
  41: 60, // League One
  42: 70, // League Two
  43: 80, // National League

  // England (Scores365 competition ids)
  7: 10, // Premier League
  1: 50, // Championship
  2: 60, // League One
  3: 70, // League Two

  // ── Spain ──────────────────────────────────────────────────────────────
  140: 10, // La Liga
  143: 25, // Copa del Rey
  556: 35, // Super Cup
  141: 50, // Segunda / LaLiga 2
  11: 10, // Scores365 LaLiga
  12: 50, // Scores365 LaLiga 2

  // ── Italy ──────────────────────────────────────────────────────────────
  135: 10, // Serie A
  137: 25, // Coppa Italia
  547: 35, // Super Cup
  136: 50, // Serie B
  17: 10, // Scores365 Serie A
  18: 50, // Scores365 Serie B

  // ── Germany ────────────────────────────────────────────────────────────
  78: 10, // Bundesliga
  81: 25, // DFB Pokal
  79: 50, // 2. Bundesliga
  80: 60, // 3. Liga
  25: 10, // Scores365 Bundesliga

  // ── France ─────────────────────────────────────────────────────────────
  61: 10, // Ligue 1
  66: 25, // Coupe de France
  62: 50, // Ligue 2
  35: 10, // Scores365 Ligue 1
  36: 50, // Scores365 Ligue 2

  // ── Other strong domestics ─────────────────────────────────────────────
  88: 15, // Eredivisie
  94: 15, // Primeira Liga
  203: 15, // Super Lig
  119: 20, // Superliga (DK) — keep mid
  144: 20, // Jupiler
  113: 20, // Allsvenskan
  103: 20, // Eliteserien
  179: 20, // Scottish Premiership
  253: 20, // MLS
  71: 20, // Serie A Brazil
  128: 20, // Liga Profesional Argentina
  262: 20, // Liga MX

  // Arab / MENA top flights
  233: 10, // Egyptian Premier (API-Football)
  307: 10, // Saudi Pro League
  301: 15, // UAE Pro League
  202: 15, // Qatar Stars
  186: 18, // Algeria Ligue 1
  200: 18, // Botola
  552: 10, // Scores365 Egyptian Premier
  649: 10, // Scores365 Saudi
};

type LeagueRef = {
  id?: number | null;
  name?: string | null;
  country?: string | null;
};

function normalize(s?: string | null): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * Name/country fallback when id is missing or unmapped.
 * Country-scoped so "Premier League" (Egypt) does not beat England PL via name alone
 * when ids are present — this only runs after id lookup fails.
 */
function priorityFromName(ref: LeagueRef): number | null {
  const name = normalize(ref.name);
  const country = normalize(ref.country);
  if (!name) return null;

  // Top-flight patterns (country-qualified where ambiguous)
  if (/^premier league$/.test(name) && /england/.test(country)) return 10;
  if (/^la\s*liga$|^laliga$/.test(name) && /spain/.test(country)) return 10;
  if (/^serie a$/.test(name) && /italy/.test(country)) return 10;
  if (/^bundesliga$/.test(name) && /germany/.test(country)) return 10;
  if (/^ligue 1$/.test(name) && /france/.test(country)) return 10;
  if (/premier/.test(name) && /egypt/.test(country)) return 10;
  if (/(saudi|pro league)/.test(name) && /saudi/.test(country)) return 10;

  // Domestic cups before 2nd tiers
  if (/\bfa cup\b|كأس الاتحاد/.test(name)) return 25;
  if (/\befl cup\b|carabao|league cup/.test(name)) return 30;
  if (/copa del rey|كأس الملك/.test(name)) return 25;
  if (/coppa italia|كأس إيطاليا/.test(name)) return 25;
  if (/dfb[\s-]?pokal|كأس ألمانيا/.test(name)) return 25;
  if (/coupe de france|كأس فرنسا/.test(name)) return 25;

  // Second tiers — after top flight & cups
  if (/^championship$/.test(name) && /england/.test(country)) return 50;
  if (/laliga\s*2|segunda|la liga 2/.test(name)) return 50;
  if (/serie b/.test(name) && /italy/.test(country)) return 50;
  if (/2\.?\s*bundesliga|2nd bundesliga/.test(name)) return 50;
  if (/ligue 2/.test(name)) return 50;
  if (/league one/.test(name) && /england/.test(country)) return 60;
  if (/league two/.test(name) && /england/.test(country)) return 70;

  return null;
}

/**
 * Sort rank for a domestic (or unknown) competition. Lower = higher in the list.
 */
export function getDomesticLeaguePriority(ref: LeagueRef): number {
  const rawId = ref.id ?? null;
  if (rawId != null && Number.isFinite(rawId) && PRIORITY_BY_ID[rawId] != null) {
    return PRIORITY_BY_ID[rawId];
  }

  const canonical = resolveCanonicalLeagueId(rawId);
  if (canonical != null && PRIORITY_BY_ID[canonical] != null) {
    return PRIORITY_BY_ID[canonical];
  }

  const fromName = priorityFromName(ref);
  if (fromName != null) return fromName;

  return DOMESTIC_PRIORITY_UNKNOWN;
}
