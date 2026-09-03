/**
 * Canonical owner for GET /football/fixtures/live.
 * One in-flight fetch, short TTL cache, optional single poll while subscribers exist
 * and WebSocket is not trusted.
 */

import { AppState, type AppStateStatus } from 'react-native';
import { fetchLiveMatches } from '../components/Matches/leagueApiUtils';
import type { Match } from '../components/Matches/matchCardUtils';
import { websocketClient } from './websocketClient';
import { logger } from '../utils/logger';

/** Align under Matches calendar live-feed poll (15s). */
export const LIVE_FEED_OWNER_POLL_MS = 15_000;
/** @deprecated Alias kept for Fast Refresh / older call sites — prefer LIVE_FEED_OWNER_POLL_MS. */
export const LIVE_FEED_REFRESH_MS = LIVE_FEED_OWNER_POLL_MS;
/** Serve cached live feed within this window to collapse WC/monitor/calendar hits. */
export const LIVE_FEED_CACHE_TTL_MS = 12_000;
const WS_TRUST_DEBOUNCE_MS = 2_500;

type Listener = (matches: Match[]) => void;

let lastPayload: Match[] = [];
let lastFetchedAt = 0;
let inFlight: Promise<Match[]> | null = null;

const listeners = new Set<Listener>();
let pollId: ReturnType<typeof setInterval> | null = null;
let trustTimer: ReturnType<typeof setTimeout> | null = null;
let wsTrusted = false;
let wasConnected = websocketClient.isConnected();
let connectionUnsub: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;
let appState: AppStateStatus = AppState.currentState;

function clearTrustTimer(): void {
  if (trustTimer) {
    clearTimeout(trustTimer);
    trustTimer = null;
  }
}

function clearPoll(): void {
  if (pollId) {
    clearInterval(pollId);
    pollId = null;
  }
}

function notify(matches: Match[]): void {
  for (const listener of listeners) {
    try {
      listener(matches);
    } catch {
      /* subscriber errors must not break the owner */
    }
  }
}

async function fetchAndStore(force: boolean): Promise<Match[]> {
  const age = Date.now() - lastFetchedAt;
  if (!force && lastFetchedAt > 0 && age < LIVE_FEED_CACHE_TTL_MS) {
    return lastPayload;
  }
  if (inFlight) return inFlight;

  inFlight = fetchLiveMatches()
    .then((matches) => {
      lastPayload = matches;
      lastFetchedAt = Date.now();
      notify(matches);
      return matches;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function startPollIfNeeded(): void {
  if (listeners.size === 0) return;
  if (wsTrusted) return;
  if (AppState.currentState !== 'active') return;
  if (pollId) return;
  pollId = setInterval(() => {
    if (!wsTrusted && AppState.currentState === 'active') {
      void fetchAndStore(true).catch(() => {});
    }
  }, LIVE_FEED_OWNER_POLL_MS);
}

function ensureConnectionWatch(): void {
  if (connectionUnsub) return;

  wasConnected = websocketClient.isConnected();
  if (wasConnected) {
    clearTrustTimer();
    trustTimer = setTimeout(() => {
      wsTrusted = true;
      clearPoll();
      logger.debug('[LiveFeedOwner] WS trusted — suspending live-feed HTTP poll');
    }, WS_TRUST_DEBOUNCE_MS);
  }

  connectionUnsub = websocketClient.subscribeConnectionState((connected) => {
    if (connected) {
      const isReconnect = !wasConnected;
      wasConnected = true;
      clearTrustTimer();
      if (isReconnect) {
        void fetchAndStore(true).catch(() => {});
      }
      trustTimer = setTimeout(() => {
        wsTrusted = true;
        clearPoll();
        logger.debug('[LiveFeedOwner] WS trusted — suspending live-feed HTTP poll');
      }, WS_TRUST_DEBOUNCE_MS);
    } else {
      wasConnected = false;
      clearTrustTimer();
      wsTrusted = false;
      logger.debug('[LiveFeedOwner] WS down — resuming live-feed HTTP poll');
      if (AppState.currentState === 'active' && listeners.size > 0) {
        void fetchAndStore(true).catch(() => {});
        startPollIfNeeded();
      }
    }
  });

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBg = /inactive|background/.test(appState);
      appState = next;
      if (next === 'active' && wasBg && listeners.size > 0) {
        void fetchAndStore(true).catch(() => {});
        startPollIfNeeded();
      } else if (next !== 'active') {
        clearPoll();
      }
    });
  }
}

function teardownWatchIfIdle(): void {
  if (listeners.size > 0) return;
  clearPoll();
  clearTrustTimer();
  connectionUnsub?.();
  connectionUnsub = null;
  appStateSub?.remove();
  appStateSub = null;
  wsTrusted = false;
}

/**
 * Return live matches, using TTL cache unless force=true.
 */
export async function ensureLiveFeed(options?: { force?: boolean }): Promise<Match[]> {
  return fetchAndStore(options?.force === true);
}

export function getLiveFeedSnapshot(): Match[] {
  return lastPayload;
}

/**
 * Subscribe to live-feed refreshes. Starts the single owner poll while any
 * subscriber is active and WS is not trusted.
 */
export function subscribeLiveFeed(listener: Listener): () => void {
  listeners.add(listener);
  ensureConnectionWatch();
  startPollIfNeeded();
  if (lastFetchedAt > 0) {
    try {
      listener(lastPayload);
    } catch {
      /* ignore */
    }
  } else {
    void fetchAndStore(false).catch(() => {});
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      teardownWatchIfIdle();
    }
  };
}
