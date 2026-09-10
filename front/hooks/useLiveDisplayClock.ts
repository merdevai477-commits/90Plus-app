import { useEffect, useRef, useState } from 'react';
import {
  isLiveClockSecondsEnabled,
  liveDisplayClockIdentity,
  liveDisplayClockShouldTick,
  logLiveClock,
  nextLiveDisplayAnchorMs,
  resolveLiveDisplayClock,
  type LiveDisplayClockInput,
} from '../utils/liveDisplayClock';
import { subscribeSharedSecondTicker } from '../components/Matches/sharedSecondTicker';

/**
 * Presentation hook: canonical live fields in, display label out.
 * Does not write Match / Zustand / network.
 */
export function useLiveDisplayClock(input: LiveDisplayClockInput): string {
  const enabled = isLiveClockSecondsEnabled();
  const identity = liveDisplayClockIdentity(input);
  const identityRef = useRef<string | null>(null);
  const anchorRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  const ticking = enabled && liveDisplayClockShouldTick(input);

  useEffect(() => {
    if (!ticking) return;
    logLiveClock({
      fixtureId: input.fixtureId,
      serverElapsed: input.elapsed ?? null,
      status: input.statusShort ?? null,
      reanchorReason: 'subscribe',
    });
    const unsubscribe = subscribeSharedSecondTicker(() => {
      setTick((n) => (n + 1) % 1_000_000);
    });
    return () => {
      unsubscribe();
      logLiveClock({
        fixtureId: input.fixtureId,
        reanchorReason: 'cleanup',
      });
    };
  }, [ticking, identity, input.fixtureId, input.elapsed, input.statusShort]);

  if (!enabled) {
    return input.fallbackLabel;
  }

  const nowMs = Date.now();
  const next = nextLiveDisplayAnchorMs({
    identity,
    prevIdentity: identityRef.current,
    prevAnchorMs: anchorRef.current,
    nowMs,
  });
  if (next.reanchored) {
    identityRef.current = identity;
    anchorRef.current = next.anchorMs;
    if (next.reason && next.reason !== 'init') {
      logLiveClock({
        fixtureId: input.fixtureId,
        serverElapsed: input.elapsed ?? null,
        status: input.statusShort ?? null,
        anchorTimestamp: next.anchorMs,
        reanchorReason: next.reason,
      });
    }
  }

  const result = resolveLiveDisplayClock({
    ...input,
    nowMs,
    anchorMs: anchorRef.current ?? nowMs,
  });
  return result.label;
}
