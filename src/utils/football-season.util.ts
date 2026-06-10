/**
 * API-Football season year (European campaign start year).
 * Override with FOOTBALL_SEASON env when needed (e.g. FOOTBALL_SEASON=2026).
 */

export function resolveFootballSeason(date = new Date()): number {
  const override = process.env.FOOTBALL_SEASON?.trim();
  if (override) {
    const parsed = parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  // July+ → new campaign. From June, use calendar year (2026 → 2026/27 label).
  return month >= 5 ? year : year - 1;
}

/** Try primary season first, then step back until data exists. */
export function footballSeasonFallbackChain(primary?: number): number[] {
  const base = primary ?? resolveFootballSeason();
  const chain: number[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const season = base - offset;
    if (!chain.includes(season)) chain.push(season);
  }
  return chain;
}
