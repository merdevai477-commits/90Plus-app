/**
 * Subscribe to liveFixtureStore snapshots for Favorites list rows only.
 * Read-only — does not mutate the store.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import type { FavoritesListFixture } from './useFavoritesFeed';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import {
  favoritesOverlaySnapshotsEqual,
  overlaySnapshotsOnFavorites,
} from '../utils/overlaySnapshotsOnFavorites';

const EMPTY: Record<number, LiveFixtureSnapshot> = Object.freeze({});

/**
 * Overlay Favorites competitor/disk/bell rows with fresher liveFixtureStore data.
 */
export function useFavoritesLiveOverlay(
  fixtures: FavoritesListFixture[],
): FavoritesListFixture[] {
  const idsKey = useMemo(
    () =>
      fixtures
        .map((f) => f.id)
        .filter(Boolean)
        .sort()
        .join(','),
    [fixtures],
  );

  const idsRef = useRef<number[]>([]);
  idsRef.current = idsKey
    ? idsKey
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const select = useCallback(
    (s: { snapshots: Record<number, LiveFixtureSnapshot> }) => {
      const ids = idsRef.current;
      if (ids.length === 0) return EMPTY;
      const out: Record<number, LiveFixtureSnapshot> = {};
      for (const id of ids) {
        const snap = s.snapshots[id];
        if (snap) out[id] = snap;
      }
      return Object.keys(out).length === 0 ? EMPTY : out;
    },
    // idsKey invalidates this selector when the Favorites id set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey tracks fixture id set
    [idsKey],
  );

  const snapshots = useStoreWithEqualityFn(
    useLiveFixtureStore,
    select,
    favoritesOverlaySnapshotsEqual,
  );

  return useMemo(
    () => overlaySnapshotsOnFavorites(fixtures, snapshots),
    [fixtures, snapshots],
  );
}
