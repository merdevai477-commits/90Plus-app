import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  CompetitionEntryInfo,
  CompetitionFilter,
  CompetitionInfo,
  CompetitionsService,
  CompetitionSort,
  CompetitionTab,
  PrizeCategoryInfo,
} from '../services/competitions.service';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import { logger } from '../utils/logger';

/**
 * Re-apply in-flight optimistic predictions after a list refetch. Without this
 * a slower public/authed page can land after Confirm and wipe the yellow CTA
 * the user already saw.
 */
function stampPendingEntries(
  page: CompetitionInfo[],
  pending: Record<string, CompetitionEntryInfo>,
  snapshots: Record<string, CompetitionInfo>,
): CompetitionInfo[] {
  if (!Object.keys(pending).length) return page;
  return page.map((row) => {
    const entry = pending[row.id];
    if (!entry) return row;
    if (row.myEntry) {
      delete pending[row.id];
      delete snapshots[row.id];
      return row;
    }
    return {
      ...row,
      myEntry: entry,
      participantsCount: row.participantsCount + 1,
    };
  });
}

/**
 * `undefined` is a meaningful filter value ("no quick filter"), so a load
 * cannot use `opts.filter ?? filter` to fall back — that makes clearing the
 * filter impossible. The override is signalled by the key being present.
 */
interface LoadOpts {
  tab?: CompetitionTab;
  filter?: CompetitionFilter;
  sort?: CompetitionSort;
  append?: boolean;
}

export function useCompetitions() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tab, setTab] = useState<CompetitionTab>('all');
  const [filter, setFilter] = useState<CompetitionFilter | undefined>(undefined);
  // Figma's sort pill reads "الأحدث" in its default state.
  const [sort, setSort] = useState<CompetitionSort>('newest');
  const [items, setItems] = useState<CompetitionInfo[]>([]);
  const [categories, setCategories] = useState<PrizeCategoryInfo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  /**
   * Current selection, mirrored in refs. `load` reads these instead of closing
   * over state so it stays referentially stable — otherwise every tab/filter/
   * cursor change would produce a new `load`, a new `refresh`, and re-fire the
   * focus effect that depends on it.
   */
  const tabRef = useRef<CompetitionTab>(tab);
  const filterRef = useRef<CompetitionFilter | undefined>(filter);
  const sortRef = useRef<CompetitionSort>(sort);
  const cursorRef = useRef<string | null>(null);

  /**
   * Monotonic request id. Switching tabs quickly fires overlapping requests and
   * the slower (older) one can land last — this drops any response that a newer
   * selection has already superseded.
   */
  const requestSeq = useRef(0);
  const snapshots = useRef<Record<string, CompetitionInfo>>({});
  const pendingEntries = useRef<Record<string, CompetitionEntryInfo>>({});

  const resolveToken = useCallback(async () => {
    if (!isSignedInRef.current) return null;
    try {
      // Raw `getToken()` can hang on iOS SecureStore — that blocked `load()`
      // forever and left the hub on a spinner even while the API answered.
      // The list is public (`optionalAuth`); a null token is fine.
      //
      // `getClerkBearerToken`'s retries only protect against `getToken()`
      // resolving/rejecting repeatedly — if a single attempt's promise never
      // settles at all (observed on Android too, not just iOS), the retry
      // loop never reaches attempt two and this hangs forever, leaving `load`
      // permanently unresolved: no items, no error, no spinner update, ever.
      // Racing it against a timeout guarantees `load` always settles.
      return await Promise.race([
        getClerkBearerToken(getTokenRef.current, { retries: 5, baseDelayMs: 200 }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
    } catch {
      return null;
    }
  }, []);

  const resolveTokenRef = useRef(resolveToken);
  resolveTokenRef.current = resolveToken;

  const load = useCallback(async (opts: LoadOpts = {}) => {
    const activeTab = opts.tab ?? tabRef.current;
    const activeFilter = 'filter' in opts ? opts.filter : filterRef.current;
    const activeSort = opts.sort ?? sortRef.current;
    const append = !!opts.append;

    const seq = ++requestSeq.current;

    /**
     * Don't block the public list on Clerk. If a token is already in hand it
     * is used; if `getToken()` hangs, we go anonymous after 250ms so the hub
     * still paints. Session enrichment for `myEntry` runs in the background
     * so `loading` can drop as soon as the public page lands.
     */
    let quickToken: string | null = null;
    if (activeTab === 'mine') {
      quickToken = await resolveTokenRef.current();
      if (seq !== requestSeq.current) return;
      if (!quickToken) {
        if (!append) {
          setItems([]);
          setNextCursor(null);
          cursorRef.current = null;
        }
        setError('AUTH_REQUIRED');
        return;
      }
    } else if (isSignedInRef.current) {
      quickToken =
        process.env.NODE_ENV === 'test'
          ? await resolveTokenRef.current()
          : await Promise.race([
              resolveTokenRef.current(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 250)),
            ]);
      if (seq !== requestSeq.current) return;
    }

    try {
      const result = await CompetitionsService.list(quickToken, {
        tab: activeTab,
        filter: activeFilter,
        sort: activeSort,
        cursor: append ? cursorRef.current ?? undefined : undefined,
      });
      if (seq !== requestSeq.current) return;
      const page = Array.isArray(result.items) ? result.items : [];
      setItems((prev) =>
        stampPendingEntries(append ? [...prev, ...page] : page, pendingEntries.current, snapshots.current),
      );
      setNextCursor(result.nextCursor);
      cursorRef.current = result.nextCursor;
      setError(null);

      if (append || quickToken || !isSignedInRef.current || activeTab === 'mine') return;
      const capturedSeq = seq;
      void (async () => {
        const token = await resolveTokenRef.current();
        if (!token || capturedSeq !== requestSeq.current) return;
        try {
          const authed = await CompetitionsService.list(token, {
            tab: activeTab,
            filter: activeFilter,
            sort: activeSort,
          });
          if (capturedSeq !== requestSeq.current) return;
          const authedPage = Array.isArray(authed.items) ? authed.items : [];
          setItems(stampPendingEntries(authedPage, pendingEntries.current, snapshots.current));
          setNextCursor(authed.nextCursor);
          cursorRef.current = authed.nextCursor;
        } catch {
          // Public page already painted; myEntry can wait for the next focus.
        }
      })();
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      logger.error('[useCompetitions] load failed:', err);
      if (!append) {
        setItems([]);
        setNextCursor(null);
        cursorRef.current = null;
        setError(err?.message || 'LOAD_FAILED');
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !cursorRef.current) return;
    setLoadingMore(true);
    try {
      await load({ append: true });
    } finally {
      setLoadingMore(false);
    }
  }, [load, loadingMore]);

  const changeTab = useCallback(
    async (nextTab: CompetitionTab) => {
      if (nextTab === tabRef.current) return;
      tabRef.current = nextTab;
      cursorRef.current = null;
      setTab(nextTab);
      setItems([]);
      setLoading(true);
      try {
        await load({ tab: nextTab });
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  const changeFilter = useCallback(
    async (nextFilter: CompetitionFilter | undefined) => {
      if (nextFilter === filterRef.current) return;
      filterRef.current = nextFilter;
      cursorRef.current = null;
      setFilter(nextFilter);
      setItems([]);
      setLoading(true);
      try {
        // `filter` is passed explicitly (even as undefined) so `load` treats it
        // as an override rather than falling back to the previous value.
        await load({ filter: nextFilter });
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  const changeSort = useCallback(
    async (nextSort: CompetitionSort) => {
      if (nextSort === sortRef.current) return;
      sortRef.current = nextSort;
      cursorRef.current = null;
      setSort(nextSort);
      setItems([]);
      setLoading(true);
      try {
        await load({ sort: nextSort });
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  /**
   * Clerk resolves asynchronously. Re-fetch when the session lands so `myEntry`
   * is populated, but never block the public list on auth — it works with a
   * null token and must not sit behind a hung `getToken()`.
   */
  const authKey = !isLoaded ? 'pending' : isSignedIn ? 'in' : 'out';
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authKey, load]);

  useEffect(() => {
    let cancelled = false;
    CompetitionsService.getPrizeCategories()
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Coming back from a competition detail screen the user may have just
   * entered, so `myEntry` / `participantsCount` on the cards are stale. Skip
   * the first focus load — the auth effect above has already fetched — but
   * keep polling: AsS publish happens in a browser, and a one-shot fetch
   * before approval leaves the hub looking empty until the user pulls.
   */
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!firstFocus.current) void load();
      firstFocus.current = false;
    }, [load]),
  );

  /**
   * Approving a prize happens on the AsS desk in a browser. Coming back to the
   * app must refetch — otherwise the hub keeps the empty list it loaded before
   * the desk published the row.
   */
  useEffect(() => {
    const subscribe = AppState?.addEventListener;
    if (typeof subscribe !== 'function') return undefined;
    const sub = subscribe.call(AppState, 'change', (next: string) => {
      if (next === 'active') void load();
    });
    return () => sub?.remove?.();
  }, [load]);

  /**
   * Stamp a just-submitted prediction onto the visible page so the hub CTA
   * flips to "في انتظار الفائز" without waiting for the list refetch.
   */
  const applyEntry = useCallback((competitionId: string, entry: CompetitionEntryInfo) => {
    pendingEntries.current[competitionId] = entry;
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== competitionId) return row;
        if (!snapshots.current[competitionId]) snapshots.current[competitionId] = row;
        return {
          ...row,
          myEntry: entry,
          participantsCount: row.myEntry ? row.participantsCount : row.participantsCount + 1,
        };
      }),
    );
  }, []);

  const commitEntry = useCallback((competitionId: string) => {
    delete snapshots.current[competitionId];
  }, []);

  const revertEntry = useCallback((competitionId: string) => {
    const snap = snapshots.current[competitionId];
    delete pendingEntries.current[competitionId];
    delete snapshots.current[competitionId];
    if (!snap) return;
    setItems((prev) => prev.map((row) => (row.id === competitionId ? snap : row)));
  }, []);

  return {
    tab,
    filter,
    sort,
    items,
    categories,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: !!nextCursor,
    changeTab,
    changeFilter,
    changeSort,
    refresh,
    loadMore,
    applyEntry,
    commitEntry,
    revertEntry,
  };
}
