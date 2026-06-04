import type { Fixture, FixtureEvent, Lineup } from '../services/apiFootball';

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

        const isSubstitute = games?.substitute === true || games?.substitute === 1;
        const minutes = games?.minutes ?? 0;

        if (isSubstitute) {
          substitutes.push({ player });
        } else if (minutes > 0 || games?.grid || games?.position || games?.number != null) {
          startXI.push({ player });
        } else if (entry.statistics?.length) {
          substitutes.push({ player });
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

/** Partial squads from goals/cards/subs when lineups API is empty. */
export function buildFallbackLineupsFromEvents(
  fixture: Pick<Fixture, 'teams'>,
  events: FixtureEvent[],
): Lineup[] {
  if (!events.length) return [];

  const byTeam = new Map<number, Map<number, { id: number; name: string }>>();

  const addPlayer = (teamId: number, player: { id?: number; name?: string | null }) => {
    if (!player.id || !player.name?.trim()) return;
    if (!byTeam.has(teamId)) byTeam.set(teamId, new Map());
    byTeam.get(teamId)!.set(player.id, { id: player.id, name: player.name.trim() });
  };

  for (const e of events) {
    addPlayer(e.team.id, e.player);
    if (e.type === 'subst') {
      if (e.assist?.id && e.assist.name) addPlayer(e.team.id, e.assist);
    } else if (e.assist?.id && e.assist.name) {
      addPlayer(e.team.id, e.assist);
    }
  }

  const mkLineup = (team: Fixture['teams']['home']): Lineup | null => {
    const players = [...(byTeam.get(team.id)?.values() ?? [])];
    if (players.length === 0) return null;

    const startXI = players.slice(0, 11).map((p, idx) => ({
      player: {
        id: p.id,
        name: p.name,
        number: idx + 1,
        pos: null as string | null,
        grid: null as string | null,
        photo: null as string | null,
      },
    }));
    const substitutes = players.slice(11).map((p) => ({
      player: {
        id: p.id,
        name: p.name,
        number: 0,
        pos: null as string | null,
        photo: null as string | null,
      },
    }));

    return {
      team: { id: team.id, name: team.name, logo: team.logo },
      coach: { id: null, name: null, photo: null },
      formation: null,
      startXI,
      substitutes,
    };
  };

  return [mkLineup(fixture.teams.home), mkLineup(fixture.teams.away)].filter(
    (row): row is Lineup => row != null,
  );
}
