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
  return {
    id: (p.id ?? p.athleteId) as number | undefined,
    name: String(p.name ?? ''),
    number: Number(p.number ?? 0),
    photo: (p.photo as string | undefined) || undefined,
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

export function ratingBadgeColor(rating: number): string {
  if (rating >= 8) return '#16a34a';
  if (rating >= 7) return '#22c55e';
  if (rating >= 6.5) return '#eab308';
  if (rating >= 6) return '#f97316';
  return '#ef4444';
}
