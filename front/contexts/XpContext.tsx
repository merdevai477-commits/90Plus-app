import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';
import { queueLevelUpCelebration } from '../utils/levelUpCelebration.storage';
import { presentPendingLevelUpCelebration } from '../utils/presentPendingLevelUpCelebration';
import { syncNextPendingCelebration } from '../utils/levelUpCelebration.sync';
import { setXpEventsHandler } from '../utils/xpEventsBridge';
import { fetchWithClerkAuth, getClerkBearerToken } from '../utils/clerkAuthToken';
import { AuthService } from '../src/services/authService';

export interface XpEvent {
  action: string;
  amount: number;
  leveledUp: boolean;
  newLevel: number;
  newTitle?: string;
}

interface XpContextType {
  xp: number;
  level: number;
  title: string;
  /** Remaining XP needed to reach the next level. */
  xpToNext: number;
  /** XP earned within the current level (xp - currentLevelXp). */
  xpInLevel: number;
  /** XP span between currentLevel and currentLevel+1 (e.g. 290 for L1→L2). */
  xpForNextLevel: number;
  /** Absolute XP threshold for current level. */
  currentLevelXp: number;
  /** Absolute XP threshold for next level (e.g. 290 for L2). */
  nextLevelXp: number;
  progressPct: number;
  streak: { current: number; longest: number };
  loading: boolean;
  /** Force-refresh XP from the server (bypasses poll throttle). */
  refresh: () => Promise<void>;
  /** Apply server-authoritative XP/level immediately (quiz, predictions, etc.). */
  applyXpSnapshot: (snapshot: { xp: number; level: number; title?: string }) => void;
  handleXpEvents: (
    events: XpEvent[],
    snapshot?: { xp: number; level: number; title?: string },
  ) => void | Promise<void>;
}

const XpContext = createContext<XpContextType | undefined>(undefined);

/** Background poll while foregrounded — level-ups still arrive via handleXpEvents. */
const XP_POLL_INTERVAL_MS = 60_000;
/** Skip duplicate /xp/me within this window unless refresh() forces it. */
const XP_MIN_FETCH_GAP_MS = 8_000;

// Level-up queue for the modal
interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

const levelUpQueue: LevelUpEvent[] = [];
const levelUpListeners: Array<(event: LevelUpEvent) => void> = [];

export function subscribeLevelUp(listener: (event: LevelUpEvent) => void): () => void {
  levelUpListeners.push(listener);
  return () => {
    const idx = levelUpListeners.indexOf(listener);
    if (idx >= 0) levelUpListeners.splice(idx, 1);
  };
}

function emitLevelUp(event: LevelUpEvent) {
  if (levelUpListeners.length > 0) {
    levelUpListeners.forEach((l) => l(event));
  } else {
    levelUpQueue.push(event);
  }
}

/** Show modal immediately (after profile/rank focus consumed pending). */
export function emitLevelUpCelebration(event: LevelUpEvent): void {
  emitLevelUp(event);
}

export function drainLevelUpQueue(): LevelUpEvent | undefined {
  return levelUpQueue.shift();
}

export function enqueueLevelUpEvent(event: LevelUpEvent): void {
  levelUpQueue.push(event);
}

// XP toast queue
interface XpToastEvent {
  amount: number;
  reason?: string;
}

const xpToastListeners: Array<(event: XpToastEvent) => void> = [];

export function subscribeXpToast(listener: (event: XpToastEvent) => void): () => void {
  xpToastListeners.push(listener);
  return () => {
    const idx = xpToastListeners.indexOf(listener);
    if (idx >= 0) xpToastListeners.splice(idx, 1);
  };
}

function emitXpToast(event: XpToastEvent) {
  xpToastListeners.forEach((l) => l(event));
}

// Title helper (mirrors backend)
function levelTitle(level: number): string {
  if (level >= 50) return 'Hall of Fame';
  if (level >= 20) return 'Icon';
  if (level >= 10) return 'Legend';
  if (level >= 5) return 'Star';
  if (level >= 3) return 'Striker';
  if (level >= 2) return 'Captain';
  return 'Rookie';
}

// Mirrors backend xp.service.ts xpForLevel — used as a fallback when the
// /xp/me payload predates the currentLevelXp / nextLevelXp fields (older
// deploys, cached responses). Pure function, no DB access.
function clientXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 290;
  return 40 + 125 * level * (level - 1);
}

export const XpProvider = ({ children }: { children: ReactNode }) => {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [title, setTitle] = useState('Rookie');
  const [xpToNext, setXpToNext] = useState(290);
  const [xpInLevel, setXpInLevel] = useState(0);
  const [xpForNextLevel, setXpForNextLevel] = useState(290);
  const [currentLevelXp, setCurrentLevelXp] = useState(0);
  const [nextLevelXp, setNextLevelXp] = useState(290);
  const [progressPct, setProgressPct] = useState(0);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [loading, setLoading] = useState(true);
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const { user } = useUser();

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // Track the last level we observed so we can detect passive level-ups
  // (e.g. XP that was awarded server-side by a cron / queue and arrived via
  // the next polling tick rather than via `handleXpEvents`). The first
  // payload after sign-in only seeds this ref — it never fires the modal.
  const lastSeenLevelRef = useRef<number | null>(null);
  // Suppress the next auto-emit when `handleXpEvents` already emitted a
  // level-up — otherwise the user would see the modal twice.
  const suppressNextAutoLevelUpRef = useRef(false);
  const lastXpFetchAtRef = useRef(0);
  const xpFetchInFlightRef = useRef<Promise<void> | null>(null);

  const applyXpPayload = useCallback(async (data: {
    level: number;
    title: string;
    xp?: number;
    xpToNext: number;
    currentLevelXp?: number;
    nextLevelXp?: number;
    xpInLevel?: number;
    xpForNextLevel?: number;
    progressPct?: number;
    streak?: { current: number; longest: number };
  }) => {
    const newLevel = data.level;
    const newTitleVal = data.title;
    const newXp = data.xp ?? 0;

    const previous = lastSeenLevelRef.current;
    if (previous != null && newLevel > previous) {
      if (suppressNextAutoLevelUpRef.current) {
        suppressNextAutoLevelUpRef.current = false;
      } else if (userId) {
        await queueLevelUpCelebration(userId, {
          previousLevel: previous,
          newLevel,
          newTitle: newTitleVal || levelTitle(newLevel),
        });
      }
    }
    lastSeenLevelRef.current = newLevel;

    if (userId) {
      await syncNextPendingCelebration(userId, newLevel);
      await presentPendingLevelUpCelebration(userId);
    }

    const fallbackCurrent = clientXpForLevel(newLevel);
    const fallbackNext = clientXpForLevel(newLevel + 1);
    const apiCurrent =
      typeof data.currentLevelXp === 'number' ? data.currentLevelXp : fallbackCurrent;
    const apiNext =
      typeof data.nextLevelXp === 'number' ? data.nextLevelXp : fallbackNext;
    const apiXpInLevel =
      typeof data.xpInLevel === 'number' ? data.xpInLevel : Math.max(0, newXp - apiCurrent);
    const apiXpForNext =
      typeof data.xpForNextLevel === 'number' && data.xpForNextLevel > 0
        ? data.xpForNextLevel
        : Math.max(1, apiNext - apiCurrent);

    setXp(newXp);
    setLevel(newLevel);
    setTitle(newTitleVal);
    setXpToNext(data.xpToNext);
    setCurrentLevelXp(apiCurrent);
    setNextLevelXp(apiNext);
    setXpInLevel(apiXpInLevel);
    setXpForNextLevel(apiXpForNext);
    setProgressPct(
      typeof data.progressPct === 'number'
        ? data.progressPct
        : Math.min(100, Math.round((apiXpInLevel / apiXpForNext) * 100)),
    );
    const nextStreak = data.streak || { current: 0, longest: 0 };
    setStreak((prev) =>
      prev.current === nextStreak.current && prev.longest === nextStreak.longest ? prev : nextStreak,
    );
  }, [userId]);

  const fetchXpData = useCallback(async (options?: { force?: boolean }) => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (!options?.force && now - lastXpFetchAtRef.current < XP_MIN_FETCH_GAP_MS) {
      return;
    }
    if (xpFetchInFlightRef.current) {
      return xpFetchInFlightRef.current;
    }

    const run = (async () => {
    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return;

      lastXpFetchAtRef.current = Date.now();

      let res = await fetchWithClerkAuth(getTokenRef.current, `${getApiUrl()}/xp/me`);
      if (!res) return;

      if (res.status === 404) {
        await AuthService.syncUserWithBackend(token, { getToken: getTokenRef.current }).catch(
          () => null,
        );
        res = await fetchWithClerkAuth(getTokenRef.current, `${getApiUrl()}/xp/me`);
        if (!res) return;
      }

      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'SUCCESS' && json.data) {
        await applyXpPayload(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      xpFetchInFlightRef.current = null;
    }
    })();

    xpFetchInFlightRef.current = run;
    return run;
  }, [isLoaded, isSignedIn, applyXpPayload]);

  const fetchXpDataRef = useRef(fetchXpData);
  fetchXpDataRef.current = fetchXpData;

  // Fetch on mount and user change
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id) {
      void fetchXpDataRef.current({ force: true });
    } else if (isLoaded && !isSignedIn) {
      setXp(0);
      setLevel(1);
      setTitle('Rookie');
      setXpToNext(290);
      setXpInLevel(0);
      setXpForNextLevel(290);
      setCurrentLevelXp(0);
      setNextLevelXp(290);
      setProgressPct(0);
      setStreak({ current: 0, longest: 0 });
      setLoading(false);
      // Reset level-tracking so the next sign-in seeds fresh.
      lastSeenLevelRef.current = null;
      suppressNextAutoLevelUpRef.current = false;
    }
  }, [isLoaded, isSignedIn, user?.id]);

  // Poll while signed in (SSE + auth headers is not viable on RN today).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const pollInterval = setInterval(() => {
      void fetchXpDataRef.current();
    }, XP_POLL_INTERVAL_MS);

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') void fetchXpDataRef.current();
    };
    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      clearInterval(pollInterval);
      sub.remove();
    };
  }, [isLoaded, isSignedIn]);

  const applyXpSnapshot = useCallback(
    (snapshot: { xp: number; level: number; title?: string }) => {
      const newLevel = Math.max(1, snapshot.level);
      const newXp = Math.max(0, snapshot.xp);
      const newTitle = snapshot.title || levelTitle(newLevel);
      const apiCurrent = clientXpForLevel(newLevel);
      const apiNext = clientXpForLevel(newLevel + 1);
      const apiXpInLevel = Math.max(0, newXp - apiCurrent);
      const apiXpForNext = Math.max(1, apiNext - apiCurrent);

      setXp(newXp);
      setLevel(newLevel);
      setTitle(newTitle);
      setXpToNext(Math.max(0, apiNext - newXp));
      setCurrentLevelXp(apiCurrent);
      setNextLevelXp(apiNext);
      setXpInLevel(apiXpInLevel);
      setXpForNextLevel(apiXpForNext);
      setProgressPct(Math.min(100, Math.round((apiXpInLevel / apiXpForNext) * 100)));
    },
    [],
  );

  const xpForNextLevelRef = useRef(xpForNextLevel);
  xpForNextLevelRef.current = xpForNextLevel;

  const handleXpEvents = useCallback(
    async (events: XpEvent[], snapshot?: { xp: number; level: number; title?: string }) => {
      if (snapshot) {
        applyXpSnapshot(snapshot);
      } else if (events?.length) {
        const totalGain = events.reduce((sum, e) => sum + e.amount, 0);
        if (totalGain > 0 && !events.some((e) => e.leveledUp)) {
          setXp((prev) => prev + totalGain);
          setXpInLevel((inLevel) => {
            const span = xpForNextLevelRef.current || 290;
            const nextIn = inLevel + totalGain;
            setProgressPct(Math.min(100, Math.round((nextIn / span) * 100)));
            return nextIn;
          });
          setXpToNext((prevNext) => Math.max(0, prevNext - totalGain));
        }
      }

      if (!events?.length) {
        void fetchXpDataRef.current({ force: true });
        return;
      }

      for (const event of events) {
        emitXpToast({ amount: event.amount });

        if (event.leveledUp) {
          if (userId) {
            await queueLevelUpCelebration(userId, {
              previousLevel: event.newLevel - 1,
              newLevel: event.newLevel,
              newTitle: event.newTitle || levelTitle(event.newLevel),
            });
            await presentPendingLevelUpCelebration(userId);
          }
          suppressNextAutoLevelUpRef.current = true;
        }
      }

      void fetchXpDataRef.current({ force: true });
    },
    [applyXpSnapshot, userId],
  );

  useEffect(() => {
    setXpEventsHandler(handleXpEvents);
    return () => setXpEventsHandler(null);
  }, [handleXpEvents]);

  return (
    <XpContext.Provider
      value={{
        xp,
        level,
        title,
        xpToNext,
        xpInLevel,
        xpForNextLevel,
        currentLevelXp,
        nextLevelXp,
        progressPct,
        streak,
        loading,
        refresh: () => fetchXpData({ force: true }),
        applyXpSnapshot,
        handleXpEvents,
      }}
    >
      {children}
    </XpContext.Provider>
  );
};

export const useXp = (): XpContextType => {
  const context = useContext(XpContext);
  if (context === undefined) {
    throw new Error('useXp must be used within an XpProvider');
  }
  return context;
};
