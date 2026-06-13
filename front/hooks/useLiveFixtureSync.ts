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

const MAX_CONCURRENT_FAST = 6;

/**
 * Single global owner of live fixture HTTP polling and WebSocket patching.
 * Mount once in the tabs layout.
 */
export function useLiveFixtureSync(): void {
  const tickRef = useRef(0);
  const pollRunningRef = useRef(false);
  const inFlightRef = useRef(new Set<number>());
  const subscribedRoomsRef = useRef(new Set<number>());

  useEffect(() => {
    const unsubWs = websocketClient.subscribeToAllMatchUpdates((update: MatchUpdatePayload) => {
      useLiveFixtureStore.getState().patchFromWebSocket(update, Date.now());
    });

    const pollTick = async () => {
      if (pollRunningRef.current) {
        logger.debug('[LiveFixtureSync] Poll tick skipped — previous cycle still running');
        return;
      }
      pollRunningRef.current = true;
      try {
        tickRef.current += 1;
        const state = useLiveFixtureStore.getState();
        const targets = state.getPollTargetIds();
        const focusedId = state.focusedFixtureId;

        const batch = targets.filter((id) => !inFlightRef.current.has(id)).slice(0, MAX_CONCURRENT_FAST);
        await Promise.all(
          batch.map((id) => {
            inFlightRef.current.add(id);
            return state.fetchAndIngestFast(id).finally(() => {
              inFlightRef.current.delete(id);
            });
          }),
        );

        if (focusedId && tickRef.current % LIVE_FIXTURE_FULL_BUNDLE_EVERY_N === 0) {
          void useLiveFixtureStore.getState().fetchAndIngestFull(focusedId);
        }
      } finally {
        pollRunningRef.current = false;
      }
    };

    void pollTick();
    const pollId = setInterval(() => {
      void pollTick();
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

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void useLiveFixtureStore.getState().refreshInterestedLive();
      }
    });

    return () => {
      unsubWs();
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
