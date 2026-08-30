import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { websocketClient, type MatchUpdatePayload } from '../services/websocketClient';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import {
  LIVE_FIXTURE_FAST_POLL_MS,
  LIVE_FIXTURE_FULL_BUNDLE_EVERY_N,
  LIVE_FIXTURE_SWEEP_MS,
} from '../src/store/liveFixtureStore.types';
import { logger } from '../utils/logger';
import { isLiveStoppage } from '../components/Matches/leagueApiUtils';
import { agentDebugLog } from '../utils/agentDebugLog';

const MAX_CONCURRENT_FAST = 6;
/** Wait after connect before trusting WS and suspending HTTP polls (avoids flap). */
const WS_TRUST_DEBOUNCE_MS = 2500;

/**
 * Single global owner of live fixture HTTP polling and WebSocket patching.
 * Mount once in the tabs layout.
 *
 * Polling is the fallback: when WS has been stably connected for WS_TRUST_DEBOUNCE_MS,
 * per-fixture HTTP polls are suspended. On disconnect they resume immediately.
 */
export function useLiveFixtureSync(): void {
  const tickRef = useRef(0);
  const pollRunningRef = useRef(false);
  const inFlightRef = useRef(new Set<number>());
  const subscribedRoomsRef = useRef(new Set<number>());
  /** True when WS is trusted healthy — skip HTTP live polls. */
  const wsTrustedRef = useRef(false);
  const wasConnectedRef = useRef(websocketClient.isConnected());
  const trustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTickRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const clearTrustTimer = () => {
      if (trustTimerRef.current) {
        clearTimeout(trustTimerRef.current);
        trustTimerRef.current = null;
      }
    };

    const unsubWs = websocketClient.subscribeToAllMatchUpdates((update: MatchUpdatePayload) => {
      useLiveFixtureStore.getState().patchFromWebSocket(update, Date.now());
    });

    const pollTick = async () => {
      if (wsTrustedRef.current) {
        const state = useLiveFixtureStore.getState();
        const needsStoppagePoll = state.getPollTargetIds().some((id) => {
          const snap = state.snapshots[id];
          if (!snap) return false;
          const st = snap.fixture.fixture.status;
          return isLiveStoppage(st.short, st.elapsed, st.extra);
        });
        if (!needsStoppagePoll) {
          logger.debug('[LiveFixtureSync] HTTP poll skipped — WS trusted healthy');
          return;
        }
      }
      if (pollRunningRef.current) {
        logger.debug('[LiveFixtureSync] Poll tick skipped — previous cycle still running');
        return;
      }
      pollRunningRef.current = true;
      const pollStartedAt = Date.now();
      try {
        tickRef.current += 1;
        const state = useLiveFixtureStore.getState();
        const targets = state.getPollTargetIds();
        const focusedId = state.focusedFixtureId;

        const batch = targets.filter((id) => !inFlightRef.current.has(id)).slice(0, MAX_CONCURRENT_FAST);
        await Promise.all(
          batch.map((id) => {
            inFlightRef.current.add(id);
            // List interests: score/status only. Focused match-details keeps events.
            const includeEvents = focusedId != null && id === focusedId;
            return state.fetchAndIngestFast(id, { includeEvents }).finally(() => {
              inFlightRef.current.delete(id);
            });
          }),
        );

        if (focusedId && tickRef.current % LIVE_FIXTURE_FULL_BUNDLE_EVERY_N === 0) {
          void useLiveFixtureStore.getState().fetchAndIngestFull(focusedId);
        }
        // #region agent log
        agentDebugLog(
          'useLiveFixtureSync.ts:pollTick',
          'poll tick complete',
          {
            targetCount: targets.length,
            batchSize: batch.length,
            durationMs: Date.now() - pollStartedAt,
            skipped: false,
          },
          'H-F',
          'post-fix-v2',
        );
        // #endregion
      } finally {
        pollRunningRef.current = false;
      }
    };
    pollTickRef.current = pollTick;

    // Seed: poll until WS proves stable (or if already disconnected).
    if (!websocketClient.isConnected()) {
      void pollTick();
    }
    const pollId = setInterval(() => {
      void pollTickRef.current();
    }, LIVE_FIXTURE_FAST_POLL_MS);

    const sweepId = setInterval(() => {
      useLiveFixtureStore.getState().sweepEvictions();
    }, LIVE_FIXTURE_SWEEP_MS);

    const syncRooms = () => {
      const targets = new Set(useLiveFixtureStore.getState().getPollTargetIds());
      for (const id of targets) {
        if (!subscribedRoomsRef.current.has(id)) {
          websocketClient.subscribeToRoom(`match:${id}`);
          subscribedRoomsRef.current.add(id);
        }
      }
      for (const id of [...subscribedRoomsRef.current]) {
        if (!targets.has(id)) {
          websocketClient.unsubscribeFromRoom(`match:${id}`);
          subscribedRoomsRef.current.delete(id);
        }
      }
    };

    syncRooms();
    const roomSyncId = setInterval(syncRooms, LIVE_FIXTURE_FAST_POLL_MS);

    const unsubConnection = websocketClient.subscribeConnectionState((connected) => {
      if (connected) {
        const isReconnect = !wasConnectedRef.current;
        wasConnectedRef.current = true;
        clearTrustTimer();
        // Reconcile silently if we just came back from disconnect.
        if (isReconnect) {
          logger.debug('[LiveFixtureSync] WS reconnect — WS patches will reconcile scores');
        }
        trustTimerRef.current = setTimeout(() => {
          wsTrustedRef.current = true;
          logger.debug('[LiveFixtureSync] WS trusted — suspending HTTP live polls');
        }, WS_TRUST_DEBOUNCE_MS);
      } else {
        wasConnectedRef.current = false;
        clearTrustTimer();
        const wasTrusted = wsTrustedRef.current;
        wsTrustedRef.current = false;
        logger.debug('[LiveFixtureSync] WS down — resuming HTTP live polls');
        // Immediate fallback tick so the UI never waits a full interval.
        if (wasTrusted || AppState.currentState === 'active') {
          void pollTickRef.current();
        }
      }
    });

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && !wsTrustedRef.current) {
        void pollTickRef.current();
      }
    });

    return () => {
      unsubWs();
      unsubConnection();
      clearTrustTimer();
      clearInterval(pollId);
      clearInterval(sweepId);
      clearInterval(roomSyncId);
      appStateSub.remove();
      for (const id of subscribedRoomsRef.current) {
        websocketClient.unsubscribeFromRoom(`match:${id}`);
      }
      subscribedRoomsRef.current.clear();
    };
  }, []);
}
