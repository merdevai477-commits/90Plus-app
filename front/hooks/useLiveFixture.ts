import { useEffect } from 'react';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';

export interface UseLiveFixtureOptions {
  /** Match details screen — enables focused full-bundle cadence via global sync. */
  focused?: boolean;
}

/**
 * Ref-counted interest in a live fixture snapshot.
 * Multiple screens showing the same fixture share one store entry.
 */
export function useLiveFixture(
  fixtureId: number | null | undefined,
  options?: UseLiveFixtureOptions,
): LiveFixtureSnapshot | undefined {
  const snapshot = useLiveFixtureStore((s) =>
    fixtureId ? s.snapshots[fixtureId] : undefined,
  );

  useEffect(() => {
    if (!fixtureId || fixtureId <= 0) return;
    const store = useLiveFixtureStore.getState();
    store.registerInterest(fixtureId);
    if (options?.focused) {
      store.setFocusedFixture(fixtureId);
    }
    return () => {
      const s = useLiveFixtureStore.getState();
      s.unregisterInterest(fixtureId);
      if (options?.focused && s.focusedFixtureId === fixtureId) {
        s.setFocusedFixture(null);
      }
    };
  }, [fixtureId, options?.focused]);

  return snapshot;
}

/**
 * Register interest for a set of fixture IDs (e.g. live rows on matches list).
 * Handles add/remove diff when the ID list changes.
 */
export function useRegisterLiveFixtures(fixtureIds: number[]): void {
  const idsKey = fixtureIds.slice().sort((a, b) => a - b).join(',');

  useEffect(() => {
    const ids = idsKey
      ? idsKey.split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n) && n > 0)
      : [];
    const store = useLiveFixtureStore.getState();
    ids.forEach((id) => store.registerInterest(id));
    return () => {
      ids.forEach((id) => useLiveFixtureStore.getState().unregisterInterest(id));
    };
  }, [idsKey]);
}
