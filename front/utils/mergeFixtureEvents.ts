import type { FixtureEvent } from '../services/apiFootball';

/** Stable dedupe key for timeline events (matches server-side fixtureEventDedupeKey). */
export function fixtureEventDedupeKey(event: FixtureEvent): string {
  const elapsed = event?.time?.elapsed ?? 0;
  const extra = event?.time?.extra ?? 0;
  const type = event?.type ?? '';
  const detail = event?.detail ?? '';
  const playerId = event?.player?.id ?? 0;
  const teamId = event?.team?.id ?? 0;
  return `${elapsed}:${extra}:${type}:${detail}:${playerId}:${teamId}`;
}

/** Merge WS-pushed or polled events into existing timeline without duplicates. */
export function mergeFixtureEvents(
  existing: FixtureEvent[],
  incoming: FixtureEvent[],
): FixtureEvent[] {
  if (!incoming.length) return existing;
  if (!existing.length) return [...incoming];

  const seen = new Set(existing.map(fixtureEventDedupeKey));
  const merged = [...existing];
  for (const event of incoming) {
    const key = fixtureEventDedupeKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(event);
  }
  merged.sort((a, b) => {
    const aMin = (a.time?.elapsed ?? 0) * 100 + (a.time?.extra ?? 0);
    const bMin = (b.time?.elapsed ?? 0) * 100 + (b.time?.extra ?? 0);
    return aMin - bMin;
  });
  return merged;
}
