import type { Standing } from '../services/apiFootball';

export interface StandingsGroup {
  group: string;
  standings: Standing[];
}

/** Football season year (Jul–Jun leagues use year season started). */
export function getCurrentFootballSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 6 ? year : year - 1;
}

/** Try fixture season first, then current and previous seasons. */
export function standingsSeasonCandidates(primary?: number): number[] {
  const current = getCurrentFootballSeason();
  const candidates = [primary, current, current - 1];
  if (primary != null) candidates.push(primary - 1);
  return [...new Set(candidates.filter((s): s is number => typeof s === 'number' && s > 2000))];
}

export function normalizeStandingsGroups(
  groups: StandingsGroup[] | undefined,
  flat: Standing[] | undefined,
): StandingsGroup[] {
  if (groups?.length) {
    return groups.filter((g) => g.standings?.length > 0);
  }
  if (flat?.length) {
    return [{ group: 'Table', standings: flat }];
  }
  return [];
}

export function teamMatchesStanding(
  standingTeamName: string,
  matchTeamName: string,
): boolean {
  const a = standingTeamName.toLowerCase();
  const b = matchTeamName.toLowerCase();
  return a.includes(b) || b.includes(a);
}
