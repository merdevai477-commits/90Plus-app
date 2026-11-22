import type { FixtureEvent } from '../services/apiFootball';

export interface LineupPitchPlayer {
  id?: number;
  name: string;
  number: number;
  photo?: string;
  pos: string;
  grid?: string | null;
  fieldLine?: number | null;
  fieldSide?: number | null;
  rating?: number | null;
  goals?: number;
  assists?: number;
  minutes?: string | null;
  subbedOff?: number | null;
  subbedIn?: number | null;
}

function toPitchPlayer(item: { player: Record<string, unknown> }): LineupPitchPlayer {
  const p = item.player;
  const rawId = p.id ?? p.athleteId;
  const idNum = rawId != null ? Number(rawId) : NaN;
  const photo =
    (typeof p.photo === 'string' && p.photo.trim()) ||
    (typeof p.imageUrl === 'string' && p.imageUrl.trim()) ||
    (typeof p.athletePhoto === 'string' && p.athletePhoto.trim()) ||
    undefined;
  return {
    id: Number.isFinite(idNum) && idNum > 0 ? idNum : undefined,
    name: String(p.name ?? ''),
    number: Number(p.number ?? 0),
    photo: photo || undefined,
    pos: String(p.pos ?? ''),
    grid: (p.grid as string | null) ?? null,
    fieldLine: (p.fieldLine as number | null) ?? null,
    fieldSide: (p.fieldSide as number | null) ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    goals: typeof p.goals === 'number' ? p.goals : 0,
    assists: typeof p.assists === 'number' ? p.assists : 0,
    minutes: (p.minutes as string | null) ?? null,
  };
}

export type LineupSubstitution = {
  minute: number;
  /** Player who left the pitch. */
  out: LineupPitchPlayer;
  /** Player who came on in their place. */
  in: LineupPitchPlayer;
};

function foldPlayerName(name?: string | null): string {
  return (name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function samePlayerId(a: unknown, b: unknown): boolean {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && na > 0 && na === nb;
}

function namesLikelySame(a?: string | null, b?: string | null): boolean {
  const left = foldPlayerName(a);
  const right = foldPlayerName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // Surname / short Arabic forms: "Foden" vs "Phil Foden", "إ. ندياي" vs "Ndiaye"
  if (left.length >= 3 && right.length >= 3) {
    if (left.endsWith(right) || right.endsWith(left)) return true;
    if (left.includes(right) || right.includes(left)) return true;
  }
  return false;
}

/** Resolve a subst event player against XI / bench so we keep real photo URLs. */
export function lookupLineupPlayer(
  id: number | null | undefined,
  name: string | null | undefined,
  pools: Array<Array<{ player: Record<string, unknown> }>>,
): LineupPitchPlayer {
  const wantedId = id != null && Number(id) > 0 ? Number(id) : null;

  if (wantedId != null) {
    for (const pool of pools) {
      const hit = pool.find((item) => {
        const p = item.player;
        return samePlayerId(p.id, wantedId) || samePlayerId(p.athleteId, wantedId);
      });
      if (hit) return toPitchPlayer(hit);
    }
  }

  // Event feeds often omit / mismatch athlete ids — fall back to roster name.
  if (name?.trim()) {
    for (const pool of pools) {
      const hit = pool.find((item) => namesLikelySame(String(item.player.name ?? ''), name));
      if (hit) return toPitchPlayer(hit);
    }
  }

  return {
    id: wantedId ?? undefined,
    name: name?.trim() || '—',
    number: 0,
    pos: '',
  };
}

function sameTeamId(eventTeamId: unknown, lineupTeamId: unknown): boolean {
  return samePlayerId(eventTeamId, lineupTeamId);
}

/** Substitutions that actually happened for one team, earliest first. Unused bench players are excluded. */
export function collectLineupSubstitutions(
  startingXI: Array<{ player: Record<string, unknown> }>,
  substitutes: Array<{ player: Record<string, unknown> }>,
  events: FixtureEvent[],
  teamId?: number | null,
): LineupSubstitution[] {
  if (!Array.isArray(events) || teamId == null) return [];
  return events
    .filter((event) => event?.type === 'subst' && sameTeamId(event.team?.id, teamId))
    .map((event) => {
      const minute = event.time.elapsed + (event.time.extra ?? 0) * 0.01;
      const outId = event.assist?.id ?? null;
      const inId = event.player?.id ?? null;
      return {
        minute,
        out: lookupLineupPlayer(outId, event.assist?.name, [startingXI, substitutes]),
        in: lookupLineupPlayer(inId, event.player?.name, [substitutes, startingXI]),
      };
    })
    .filter((row) => row.out.name !== '—' || row.in.name !== '—')
    .sort((a, b) => a.minute - b.minute);
}

export function applySubstitutionsToPitch(
  startingXI: Array<{ player: Record<string, unknown> }>,
  substitutes: Array<{ player: Record<string, unknown> }>,
  events: FixtureEvent[],
  teamId: number,
): { pitchPlayers: LineupPitchPlayer[]; benchPlayers: LineupPitchPlayer[] } {
  const pitchPlayers = startingXI.map((item) => toPitchPlayer(item));
  const subPool = new Map<number, LineupPitchPlayer>();
  for (const item of substitutes) {
    const player = toPitchPlayer(item);
    if (player.id != null) subPool.set(player.id, player);
  }

  const subbedOffBench: LineupPitchPlayer[] = [];
  const teamSubs = events
    .filter((e) => e.type === 'subst' && e.team.id === teamId)
    .sort((a, b) => {
      const ta = a.time.elapsed + (a.time.extra ?? 0) * 0.01;
      const tb = b.time.elapsed + (b.time.extra ?? 0) * 0.01;
      return ta - tb;
    });

  for (const sub of teamSubs) {
    const outId = sub.assist?.id ?? null;
    const inId = sub.player?.id ?? null;
    if (!outId || !inId) continue;

    const outIdx = pitchPlayers.findIndex((p) => p.id === outId);
    if (outIdx < 0) continue;

    const outPlayer = pitchPlayers[outIdx];
    const minute = sub.time.elapsed + (sub.time.extra ? sub.time.extra * 0.01 : 0);
    subbedOffBench.push({ ...outPlayer, subbedOff: minute });

    const inPlayer = subPool.get(inId) ?? {
      id: inId,
      name: sub.player?.name ?? '—',
      number: 0,
      pos: outPlayer.pos,
    };

    pitchPlayers[outIdx] = {
      ...inPlayer,
      grid: outPlayer.grid,
      fieldLine: outPlayer.fieldLine,
      fieldSide: outPlayer.fieldSide,
      subbedIn: minute,
      rating: inPlayer.rating ?? null,
      goals: inPlayer.goals ?? 0,
      assists: inPlayer.assists ?? 0,
    };
    subPool.delete(inId);
  }

  const unusedSubs = [...subPool.values()].filter(
    (p) => !p.minutes || p.minutes === "0'" || p.minutes === '0',
  );
  const usedSubsOnBench = [...subPool.values()].filter(
    (p) => p.minutes && p.minutes !== "0'" && p.minutes !== '0' && !pitchPlayers.some((x) => x.id === p.id),
  );

  return {
    pitchPlayers,
    benchPlayers: [...subbedOffBench, ...usedSubsOnBench, ...unusedSubs],
  };
}

/** Full name when it fits a lineup card, otherwise the surname. */
export function shortPlayerName(name: string, maxFull = 12): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxFull) return trimmed;
  return trimmed.split(/\s+/).pop() ?? trimmed;
}

export function ratingBadgeColor(rating: number): string {
  if (rating >= 8) return '#16a34a';
  if (rating >= 7) return '#22c55e';
  if (rating >= 6.5) return '#eab308';
  if (rating >= 6) return '#f97316';
  return '#ef4444';
}
