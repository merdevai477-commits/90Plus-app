/**
 * Build lineup-shaped payloads from API-Football /fixtures/players when
 * /fixtures/lineups is empty (common for Americas, Arab 2nd divisions, etc.).
 */

export function hasLineupData(lineups: unknown): boolean {
  if (!Array.isArray(lineups) || lineups.length === 0) return false;
  return lineups.some((row) => {
    const l = row as { startXI?: unknown[]; substitutes?: unknown[] };
    return (l.startXI?.length ?? 0) > 0 || (l.substitutes?.length ?? 0) > 0;
  });
}

export function convertFixturePlayersToLineups(playersPayload: unknown[]): unknown[] {
  if (!Array.isArray(playersPayload) || playersPayload.length === 0) return [];

  return playersPayload
    .map((teamBlock) => {
      const block = teamBlock as {
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

      if (!block.team) return null;

      const startXI: Array<{ player: Record<string, unknown> }> = [];
      const substitutes: Array<{ player: Record<string, unknown> }> = [];

      for (const entry of block.players ?? []) {
        const games = entry.statistics?.[0]?.games;
        if (!entry.player?.id || !entry.player?.name) continue;

        const player = {
          id: entry.player.id,
          name: entry.player.name,
          number: games?.number ?? null,
          pos: games?.position ?? null,
          grid: games?.grid ?? null,
          photo: entry.player.photo ?? null,
        };

        if (games?.substitute === true) {
          substitutes.push({ player });
        } else if (
          games?.minutes != null ||
          games?.number != null ||
          games?.grid ||
          games?.position
        ) {
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
      };
    })
    .filter(Boolean);
}
