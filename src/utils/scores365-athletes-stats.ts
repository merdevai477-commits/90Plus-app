/**
 * 365 `/web/stats` historically returned `athletesStats` as a bare array of boards.
 * Current payloads wrap boards in `{ tables, filters }`. Normalize either shape.
 */

export type AthletesStatsBoard = {
  id: number;
  name?: string;
  competitionId?: number;
  statsTypes?: Array<{ typeId: number; name?: string }>;
  rows?: Array<{
    position: number;
    secondaryStatName?: string;
    entity?: {
      id: number;
      name?: string;
      shortName?: string;
      competitorId?: number;
      positionName?: string;
      isLeftClub?: boolean;
      imageVersion?: number;
    };
    stats?: Array<{ typeId: number; value: string }>;
  }>;
};

export function normalizeAthletesStatsBoards(athletesStats: unknown): AthletesStatsBoard[] {
  if (Array.isArray(athletesStats)) {
    return athletesStats as AthletesStatsBoard[];
  }
  if (
    athletesStats &&
    typeof athletesStats === 'object' &&
    Array.isArray((athletesStats as { tables?: unknown }).tables)
  ) {
    return (athletesStats as { tables: AthletesStatsBoard[] }).tables;
  }
  return [];
}
