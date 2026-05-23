import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';

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
  refresh: () => Promise<void>;
  handleXpEvents: (events: XpEvent[]) => void;
}

const XpContext = createContext<XpContextType | undefined>(undefined);

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

export function drainLevelUpQueue(): LevelUpEvent | undefined {
  return levelUpQueue.shift();
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
  const { isSignedIn, getToken } = useAuth();
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

  const fetchXpData = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    try {
      const token = await getTokenRef.current();
      if (!token) return;

      const res = await fetch(`${getApiUrl()}/xp/me`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
      });

      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'SUCCESS' && json.data) {
        const newLevel: number = json.data.level;
        const newTitleVal: string = json.data.title;
        const newXp: number = json.data.xp ?? 0;

        // Detect a passive level-up: skip the very first payload (seed only).
        const previous = lastSeenLevelRef.current;
        if (previous != null && newLevel > previous) {
          if (suppressNextAutoLevelUpRef.current) {
            // Already fired by handleXpEvents — clear the flag.
            suppressNextAutoLevelUpRef.current = false;
          } else {
            emitLevelUp({
              previousLevel: previous,
              newLevel,
              newTitle: newTitleVal || levelTitle(newLevel),
            });
          }
        }
        lastSeenLevelRef.current = newLevel;

        // Compute level-relative numbers locally if the backend hasn't
        // started shipping them yet (older deploy / cached response). Once
        // the new fields are present we just pass them through.
        const fallbackCurrent = clientXpForLevel(newLevel);
        const fallbackNext = clientXpForLevel(newLevel + 1);
        const apiCurrent: number =
          typeof json.data.currentLevelXp === 'number'
            ? json.data.currentLevelXp
            : fallbackCurrent;
        const apiNext: number =
          typeof json.data.nextLevelXp === 'number'
            ? json.data.nextLevelXp
            : fallbackNext;
        const apiXpInLevel: number =
          typeof json.data.xpInLevel === 'number'
            ? json.data.xpInLevel
            : Math.max(0, newXp - apiCurrent);
        const apiXpForNext: number =
          typeof json.data.xpForNextLevel === 'number' && json.data.xpForNextLevel > 0
            ? json.data.xpForNextLevel
            : Math.max(1, apiNext - apiCurrent);

        setXp(newXp);
        setLevel(newLevel);
        setTitle(newTitleVal);
        setXpToNext(json.data.xpToNext);
        setCurrentLevelXp(apiCurrent);
        setNextLevelXp(apiNext);
        setXpInLevel(apiXpInLevel);
        setXpForNextLevel(apiXpForNext);
        setProgressPct(
          typeof json.data.progressPct === 'number'
            ? json.data.progressPct
            : Math.min(100, Math.round((apiXpInLevel / apiXpForNext) * 100)),
        );
        setStreak(json.data.streak || { current: 0, longest: 0 });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  // Fetch on mount and user change
  useEffect(() => {
    if (isSignedIn && user?.id) {
      fetchXpData();
    } else {
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
  }, [isSignedIn, user?.id, fetchXpData]);

  // SSE stream with polling fallback
  useEffect(() => {
    if (!isSignedIn) return;

    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const setupSSE = async () => {
      try {
        const token = await getTokenRef.current();
        if (!token || cancelled) return;

        const url = `${getApiUrl()}/xp/stream`;

        // Try native EventSource (available in web, polyfilled in RN)
        if (typeof EventSource !== 'undefined') {
          // EventSource doesn't support auth headers natively.
          // Fall back to polling for now (RN doesn't have a good SSE + auth story).
          // In web, we could use a query param token, but for security we poll.
          throw new Error('SSE_AUTH_NOT_SUPPORTED');
        }

        throw new Error('NO_EVENTSOURCE');
      } catch {
        // Fallback: poll every 20s while the app is foregrounded so a
        // server-awarded level-up shows the modal within ~20s instead of
        // ~60s. Foreground/background is handled by the AppState listener
        // below, which calls fetchXpData() immediately on resume.
        if (!cancelled) {
          pollInterval = setInterval(fetchXpData, 20000);
        }
      }
    };

    setupSSE();

    // Also refresh on foreground
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') fetchXpData();
    };
    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      cancelled = true;
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
      sub.remove();
    };
  }, [isSignedIn, fetchXpData]);

  const handleXpEvents = useCallback((events: XpEvent[]) => {
    if (!events || events.length === 0) return;

    for (const event of events) {
      // Emit toast
      emitXpToast({ amount: event.amount });

      // Emit level-up
      if (event.leveledUp) {
        emitLevelUp({
          previousLevel: event.newLevel - 1,
          newLevel: event.newLevel,
          newTitle: event.newTitle || levelTitle(event.newLevel),
        });
        // Tell the next fetchXpData() not to re-emit when it observes the
        // same level transition — otherwise the modal would fire twice.
        suppressNextAutoLevelUpRef.current = true;
      }
    }

    // Refresh data from server
    fetchXpData();
  }, [fetchXpData]);

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
        refresh: fetchXpData,
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
