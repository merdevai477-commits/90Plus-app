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
  xpToNext: number;
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

export const XpProvider = ({ children }: { children: ReactNode }) => {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [title, setTitle] = useState('Rookie');
  const [xpToNext, setXpToNext] = useState(290);
  const [progressPct, setProgressPct] = useState(0);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [loading, setLoading] = useState(true);
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchXpData = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    try {
      const token = await getTokenRef.current();
      if (!token) return;

      const res = await fetch(`${getApiUrl()}/xp/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'SUCCESS' && json.data) {
        setXp(json.data.xp);
        setLevel(json.data.level);
        setTitle(json.data.title);
        setXpToNext(json.data.xpToNext);
        setProgressPct(json.data.progressPct);
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
      setProgressPct(0);
      setStreak({ current: 0, longest: 0 });
      setLoading(false);
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
        // Fallback: poll every 60s
        if (!cancelled) {
          pollInterval = setInterval(fetchXpData, 60000);
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
      }
    }

    // Refresh data from server
    fetchXpData();
  }, [fetchXpData]);

  return (
    <XpContext.Provider value={{ xp, level, title, xpToNext, progressPct, streak, loading, refresh: fetchXpData, handleXpEvents }}>
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
