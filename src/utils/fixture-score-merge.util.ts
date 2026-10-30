type Pair = { home?: number | null; away?: number | null } | null | undefined;

type ScoreCarrier = {
  fixture?: { status?: unknown } | null;
  goals?: Pair;
  score?: Record<string, Pair> | null;
};

const SCORE_KEYS = ['halftime', 'fulltime', 'extratime', 'penalty'] as const;

function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function mergePair(current: Pair, incoming: Pair): { home: number | null; away: number | null } {
  return {
    home: incoming?.home ?? current?.home ?? null,
    away: incoming?.away ?? current?.away ?? null,
  };
}

/**
 * Carry the incoming status / goals / score lines into a preserved fullData
 * snapshot (events, lineups, etc. stay). Without this the shootout tally
 * never reaches cached_fixtures because list upserts keep the old fullData.
 * Returns null when nothing in those subtrees changes.
 */
export function mergeScoreIntoFullData(
  existing: unknown,
  incoming: ScoreCarrier,
): Record<string, unknown> | null {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return null;
  const prev = existing as ScoreCarrier & Record<string, unknown>;

  const score: Record<string, unknown> = { ...(prev.score ?? {}) };
  for (const key of SCORE_KEYS) {
    if (incoming.score?.[key] !== undefined || prev.score?.[key] !== undefined) {
      score[key] = mergePair(prev.score?.[key], incoming.score?.[key]);
    }
  }
  const goals = mergePair(prev.goals, incoming.goals);
  const fixture =
    incoming.fixture?.status !== undefined
      ? { ...(prev.fixture ?? {}), status: incoming.fixture.status }
      : prev.fixture;

  // jsonb returns keys in its own order — compare key-order-insensitively so
  // an unchanged row does not rewrite on every tick.
  const before = stableStringify([prev.score ?? {}, prev.goals ?? null, prev.fixture?.status ?? null]);
  const after = stableStringify([score, goals, (fixture as ScoreCarrier['fixture'])?.status ?? null]);
  if (before === after) return null;

  return { ...prev, fixture, goals, score };
}
