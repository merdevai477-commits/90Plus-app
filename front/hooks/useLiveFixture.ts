import { useEffect, useRef } from 'react';
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
  const registeredRef = useRef<Set<number>>(new Set());

  // Diff instead of unregister-all → register-all: ids that stay must never
  // drop to zero interest, which aborts their in-flight polls and schedules eviction.
  useEffect(() => {
    const next = new Set(
      idsKey
        ? idsKey.split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n) && n > 0)
        : [],
    );
    const prev = registeredRef.current;
    const store = useLiveFixtureStore.getState();
    next.forEach((id) => {
      if (!prev.has(id)) store.registerInterest(id);
    });
    prev.forEach((id) => {
      if (!next.has(id)) store.unregisterInterest(id);
    });
    registeredRef.current = next;
  }, [idsKey]);

  useEffect(
    () => () => {
      const s = useLiveFixtureStore.getState();
      registeredRef.current.forEach((id) => s.unregisterInterest(id));
      registeredRef.current = new Set();
    },
    [],
  );
}
