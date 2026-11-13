/**
 * Match-card presentation for the senior Israel national team.
 * 365Scores competitor 5034 — Kosovo vs Israel (fixture 4672294) and later fixtures.
 * Club sides and youth teams are left unchanged. League country labels are not touched.
 */

export const MASKED_TEAM_NAME = 'غير معروف';
export const MASKED_TEAM_LOGO_URL = 'https://90plus.pro/unknown-team.png';

const ISRAEL_NT_COMPETITOR_ID = 5034;

const NAMES = new Set([
  'israel',
  'state of israel',
  'israel national team',
  'israel nt',
  'إسرائيل',
  'اسرائيل',
  'ישראל',
  'منتخب إسرائيل',
  'منتخب اسرائيل',
]);

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isIsraelSeniorNationalTeam(
  name?: string | null,
  id?: number | null,
  logo?: string | null,
): boolean {
  if (id === ISRAEL_NT_COMPETITOR_ID) return true;
  if (logo && /\/Competitors\/5034(?:[/?#]|$)/.test(logo)) return true;
  const n = norm(name ?? '');
  if (!n || !NAMES.has(n)) return false;
  return true;
}

type TeamSide = {
  name?: string | null;
  logo?: string | null;
  id?: number | null;
};

export function maskTeamSide<T extends TeamSide>(
  team: T | null | undefined,
): T | null | undefined {
  if (!team || typeof team !== 'object') return team;
  const id = typeof team.id === 'number' ? team.id : null;
  if (!isIsraelSeniorNationalTeam(team.name, id, team.logo)) return team;
  return {
    ...team,
    name: MASKED_TEAM_NAME,
    logo: MASKED_TEAM_LOGO_URL,
  };
}

export function maskFixtureForClient<T>(fixture: T): T {
  if (!fixture || typeof fixture !== 'object') return fixture;
  const row = fixture as { teams?: { home?: TeamSide; away?: TeamSide } };
  const teams = row.teams;
  if (!teams || typeof teams !== 'object') return fixture;
  const home = maskTeamSide(teams.home);
  const away = maskTeamSide(teams.away);
  if (home === teams.home && away === teams.away) return fixture;
  return { ...row, teams: { ...teams, home, away } } as T;
}

export function maskFixturesForClient<T>(fixtures: T[]): T[] {
  if (!Array.isArray(fixtures) || fixtures.length === 0) return fixtures;
  let changed = false;
  const next = fixtures.map((row) => {
    const masked = maskFixtureForClient(row);
    if (masked !== row) changed = true;
    return masked;
  });
  return changed ? next : fixtures;
}

export function maskFixtureDetailsForClient<T>(bundle: T): T {
  if (!bundle || typeof bundle !== 'object') return bundle;
  const row = bundle as Record<string, unknown>;
  let next: Record<string, unknown> | null = null;
  const touch = (): Record<string, unknown> => {
    if (!next) next = { ...row };
    return next;
  };

  if (row.fixture) {
    const fixture = maskFixtureForClient(row.fixture);
    if (fixture !== row.fixture) touch().fixture = fixture;
  }

  for (const key of ['lineups', 'events', 'statistics'] as const) {
    const list = row[key];
    if (!Array.isArray(list)) continue;
    let changed = false;
    const mapped = list.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const record = item as { team?: TeamSide };
      if (!record.team) return item;
      const team = maskTeamSide(record.team);
      if (team === record.team) return item;
      changed = true;
      return { ...record, team };
    });
    if (changed) touch()[key] = mapped;
  }

  return (next ?? bundle) as T;
}
