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
  const a = standingTeamName.toLowerCase().trim();
  const b = matchTeamName.toLowerCase().trim();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export interface MatchTeamRef {
  id?: number;
  name?: string;
}

export function standingRowMatchesTeam(
  row: Standing,
  team: MatchTeamRef,
): boolean {
  if (team.id != null && row.team?.id === team.id) return true;
  if (team.name && row.team?.name) {
    return teamMatchesStanding(row.team.name, team.name);
  }
  return false;
}

function groupContainsTeam(group: StandingsGroup, team: MatchTeamRef): boolean {
  return group.standings.some((row) => standingRowMatchesTeam(row, team));
}

/**
 * For group-stage tournaments (World Cup, etc.), keep only the group that
 * contains both teams. Falls back to groups that contain either team, then
 * the full table for single-group leagues.
 */
export function resolveStandingsGroupsForMatch(
  groups: StandingsGroup[],
  home: MatchTeamRef,
  away: MatchTeamRef,
): StandingsGroup[] {
  if (!groups.length) return [];

  const shared = groups.filter(
    (g) => groupContainsTeam(g, home) && groupContainsTeam(g, away),
  );
  if (shared.length) return shared;

  const partial = groups.filter(
    (g) => groupContainsTeam(g, home) || groupContainsTeam(g, away),
  );
  if (partial.length) return partial;

  if (groups.length === 1) return groups;
  return groups;
}
