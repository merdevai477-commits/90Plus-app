import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { MatchEventMonitor } from '../services/matchEventMonitor';
import { MatchFavoritesStorage } from '../storage/matchFavorites.storage';
import { isRateLimitError } from '../../services/apiFootball';
import { logger } from '../services/logger';
import { useLiveFixtureStore } from '../store/liveFixtureStore';

const POLLING_INTERVAL = 45000; // 45 seconds

/**
 * Keeps favorited live fixtures registered in the SSOT store and refreshes snapshots.
 */
export const useMatchEventsMonitor = () => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appState = useRef(AppState.currentState);
    const registeredFavoritesRef = useRef<number[]>([]);

    const syncFavoriteInterest = (liveFixtureIds: number[]) => {
        const store = useLiveFixtureStore.getState();
        const prev = registeredFavoritesRef.current;
        for (const id of prev) {
            if (!liveFixtureIds.includes(id)) {
                store.unregisterInterest(id);
            }
        }
        for (const id of liveFixtureIds) {
            store.registerInterest(id);
        }
        registeredFavoritesRef.current = liveFixtureIds;
    };

    const monitorFavoritedMatches = async () => {
        try {
            const favoritedIds = await MatchFavoritesStorage.getFavorites();

            if (favoritedIds.length === 0) {
                syncFavoriteInterest([]);
                return;
            }

            const liveFixtureIds = await MatchEventMonitor.getLiveFavoritedFixtures(favoritedIds);

            await MatchEventMonitor.monitorMatches(liveFixtureIds);
            syncFavoriteInterest(liveFixtureIds);

            if (liveFixtureIds.length > 0) {
                await useLiveFixtureStore.getState().refreshInterestedLive();
            }
        } catch (error) {
            if (isRateLimitError(error)) {
                logger.debug('Rate limit while monitoring matches, will retry later');
            } else {
                logger.error('Error monitoring matches:', error);
            }
        }
    };

    const startMonitoring = () => {
        if (intervalRef.current) return;

        logger.debug('Starting match event monitor (live fixture SSOT refresh)');

        const safeMonitor = async () => {
            try {
                await monitorFavoritedMatches();
            } catch (error) {
                logger.error('Match monitoring error (recovered):', error);
            }
        };

        safeMonitor();
        intervalRef.current = setInterval(safeMonitor, POLLING_INTERVAL);
    };

    const stopMonitoring = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                startMonitoring();
            } else if (nextAppState.match(/inactive|background/)) {
                stopMonitoring();
            }
            appState.current = nextAppState;
        });

        startMonitoring();

        return () => {
            stopMonitoring();
            subscription.remove();
            syncFavoriteInterest([]);
        };
    }, []);

    return {
        startMonitoring,
        stopMonitoring,
    };
};
