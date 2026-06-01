import type { Lineup } from '../services/apiFootball';

type FixturePlayersTeamBlock = {
  team?: { id: number; name: string; logo: string };
  players?: Array<{
    player?: { id: number; name: string; photo?: string | null };
    statistics?: Array<{
      games?: {
        number?: number | null;
        position?: string | null;
        grid?: string | null;
        substitute?: boolean;
        minutes?: number | null;
      };
    }>;
  }>;
};

export function hasLineupData(lineups: Lineup[] | null | undefined): boolean {
  if (!lineups?.length) return false;
  return lineups.some(
    (row) => (row.startXI?.length ?? 0) > 0 || (row.substitutes?.length ?? 0) > 0,
  );
}

export function convertFixturePlayersToLineups(playersPayload: unknown[]): Lineup[] {
  if (!Array.isArray(playersPayload) || playersPayload.length === 0) return [];

  return playersPayload
    .map((teamBlock) => {
      const block = teamBlock as FixturePlayersTeamBlock;
      if (!block.team) return null;

      const startXI: Lineup['startXI'] = [];
      const substitutes: Lineup['substitutes'] = [];

      for (const entry of block.players ?? []) {
        const games = entry.statistics?.[0]?.games;
        if (!entry.player?.id || !entry.player?.name) continue;

        const player = {
          id: entry.player.id,
          name: entry.player.name,
          number: games?.number ?? 0,
          pos: games?.position ?? null,
          grid: games?.grid ?? null,
          photo: entry.player.photo ?? null,
        };

        if (games?.substitute === true) {
          substitutes.push({ player });
        } else if (games?.minutes != null || games?.number != null || games?.grid) {
          startXI.push({ player });
        }
      }

      if (startXI.length === 0 && substitutes.length === 0) return null;

      return {
        team: block.team,
        coach: { id: null, name: null, photo: null },
        formation: null,
        startXI,
        substitutes,
      } satisfies Lineup;
    })
    .filter((row): row is Lineup => row != null);
}
