/**
 * Map 365Scores /web/standings/ rows → API-Football standings groups shape.
 */

export interface Scores365StandingRow {
  groupNum: number;
  groupName: string | null;
  position: number;
  teamId: number;
  teamName: string;
  teamLogo?: string;
  gamePlayed: number;
  gamesWon: number;
  gamesEven: number;
  gamesLost: number;
  goalsFor: number;
  goalsAgainst: number;
  ratio: number;
  points: number;
}

function toApiStandingRow(row: Scores365StandingRow, groupLabel: string): Record<string, unknown> {
  return {
    rank: row.position,
    team: { id: row.teamId, name: row.teamName, logo: row.teamLogo ?? '' },
    points: row.points,
    goalsDiff: row.goalsFor - row.goalsAgainst,
    group: groupLabel,
    form: '',
    status: '',
    description: null,
    all: {
      played: row.gamePlayed,
      win: row.gamesWon,
      draw: row.gamesEven,
      lose: row.gamesLost,
      goals: { for: row.goalsFor, against: row.goalsAgainst },
    },
    home: {
      played: 0,
      win: 0,
      draw: 0,
      lose: 0,
      goals: { for: 0, against: 0 },
    },
    away: {
      played: 0,
      win: 0,
      draw: 0,
      lose: 0,
      goals: { for: 0, against: 0 },
    },
    update: '',
  };
}

export function map365StandingRowsToApiGroups(rows: Scores365StandingRow[]): {
  flat: Record<string, unknown>[];
  groups: Array<{ group: string; standings: Record<string, unknown>[] }>;
} {
  const byGroup = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const groupLabel = row.groupName ?? `Group ${row.groupNum}`;
    const standing = toApiStandingRow(row, groupLabel);
    const list = byGroup.get(groupLabel) ?? [];
    list.push(standing);
    byGroup.set(groupLabel, list);
  }

  const groups = [...byGroup.entries()]
    .map(([group, standings]) => ({
      group,
      standings: standings.sort(
        (a, b) => ((a.rank as number) ?? 0) - ((b.rank as number) ?? 0),
      ),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));

  const flat = groups.flatMap((g) => g.standings);
  return { flat, groups };
}
