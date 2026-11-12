export type KingVerdict = 'pending' | 'correct' | 'wrong';
export type KingButtonState = KingVerdict | 'open' | 'closed';
export type KingClosedKind = 'live' | 'played';

export function matchHasStarted(
  status: string,
  kickoffMs: number | null,
  now: number,
): boolean {
  if (status === 'live' || status === 'finished') return true;
  return kickoffMs != null && Number.isFinite(kickoffMs) && kickoffMs <= now;
}

/**
 * A saved pick keeps its result color. A match with no pick closes into the
 * gray button once it has kicked off or the day has passed.
 */
export function kingCardButton(input: {
  dayPassed: boolean;
  started: boolean;
  live: boolean;
  verdict: KingVerdict | null;
}): { state: KingButtonState; locked: boolean; closedKind: KingClosedKind | null } {
  if (input.verdict) {
    const settled = input.verdict !== 'pending';
    return {
      state: input.verdict,
      locked: settled || input.dayPassed || input.started,
      closedKind: null,
    };
  }
  const locked = input.dayPassed || input.started;
  if (!locked) return { state: 'open', locked: false, closedKind: null };
  return {
    state: 'closed',
    locked: true,
    closedKind: input.live && !input.dayPassed ? 'live' : 'played',
  };
}
