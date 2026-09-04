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

/**
 * Lineups cached before the athleteId fix carry the per-game roster row id in
 * `player.id`, which no 365 player endpoint accepts. Detect them so they are
 * refreshed instead of served — otherwise career, match report, and headshots
 * stay broken for the lifetime of the cache entry.
 */
export function is365LineupIdMappingStale(lineups: unknown): boolean {
  if (!Array.isArray(lineups) || lineups.length === 0) return false;
  return lineups.some((row) => {
    const l = row as {
      _source?: string;
      startXI?: Array<{ player?: { athleteId?: number } }>;
      substitutes?: Array<{ player?: { athleteId?: number } }>;
    };
    if (l._source !== 'scores365-experiment' && l._source !== '365scores') return false;
    const roster = [...(l.startXI ?? []), ...(l.substitutes ?? [])];
    return roster.some((entry) => (entry?.player?.athleteId ?? 0) <= 0);
  });
}

/** Full 365/API lineups — not partial squads inferred from goal/card events. */
export function isAuthoritativeLineupData(lineups: unknown): boolean {
  if (!Array.isArray(lineups) || lineups.length === 0) return false;
  return lineups.some((row) => {
    const l = row as {
      _source?: string;
      formation?: string | null;
      startXI?: unknown[];
    };
    if (l._source === 'scores365-experiment' || l._source === '365scores') return true;
    if (l.formation) return true;
    return (l.startXI?.length ?? 0) >= 9;
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

        const isSubstitute = games?.substitute === true;
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
      };
    })
    .filter(Boolean);
}

type EventTeamBlock = {
  id: number;
  name: string;
  logo?: string | null;
};

/**
 * Last-resort lineup when /lineups and /players are empty but events list players
 * (common for Copa Sul-Sudeste, USL, and other lower-tier leagues).
 */
export function buildFallbackLineupsFromEvents(
  teams: { home: EventTeamBlock; away: EventTeamBlock },
  events: unknown[],
): unknown[] {
  if (!Array.isArray(events) || events.length === 0) return [];

  const byTeam = new Map<number, Map<number, { id: number; name: string }>>();

  const addPlayer = (teamId: number, player: { id?: number | null; name?: string | null }) => {
    if (player.id == null || !player.name?.trim()) return;
    if (!byTeam.has(teamId)) byTeam.set(teamId, new Map());
    byTeam.get(teamId)!.set(player.id, { id: player.id, name: player.name.trim() });
  };

  for (const raw of events) {
    const e = raw as {
      team?: { id?: number };
      player?: { id?: number; name?: string | null };
      assist?: { id?: number | null; name?: string | null };
      type?: string;
    };
    const teamId = e.team?.id;
    if (!teamId) continue;
    addPlayer(teamId, e.player ?? {});
    if (e.type === 'subst') {
      addPlayer(teamId, e.assist ?? {});
    } else if (e.assist?.id && e.assist.name) {
      addPlayer(teamId, e.assist);
    }
  }

  const mkLineup = (team: EventTeamBlock): unknown | null => {
    const players = [...(byTeam.get(team.id)?.values() ?? [])];
    if (players.length === 0) return null;

    const startXI = players.slice(0, 11).map((p, idx) => ({
      player: {
        id: p.id,
        name: p.name,
        number: idx + 1,
        pos: null,
        grid: null,
        photo: null,
      },
    }));
    const subs = players.slice(11).map((p) => ({
      player: {
        id: p.id,
        name: p.name,
        number: null,
        pos: null,
        photo: null,
      },
    }));

    return {
      team: { id: team.id, name: team.name, logo: team.logo ?? '' },
      coach: { id: null, name: null, photo: null },
      formation: null,
      startXI,
      substitutes: subs,
    };
  };

  return [mkLineup(teams.home), mkLineup(teams.away)].filter(Boolean);
}
