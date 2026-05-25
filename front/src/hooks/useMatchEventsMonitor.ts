import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { MatchEventMonitor } from '../services/matchEventMonitor';
import { MatchFavoritesStorage } from '../storage/matchFavorites.storage';
import { isRateLimitError } from '../../services/apiFootball';
import { logger } from '../services/logger';

const POLLING_INTERVAL = 45000; // 45 seconds

/**
 * Keeps live match data fresh for favorited fixtures while the app is foregrounded.
 * Push notifications for goals/cards/etc. are delivered by the backend match-watcher;
 * this hook no longer injects duplicate in-app "match notifications" into home.store.
 */
export const useMatchEventsMonitor = () => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appState = useRef(AppState.currentState);
    const queryClient = useQueryClient();

    const monitorFavoritedMatches = async () => {
        try {
            const favoritedIds = await MatchFavoritesStorage.getFavorites();

            if (favoritedIds.length === 0) {
                return;
            }

            const liveFixtureIds = await MatchEventMonitor.getLiveFavoritedFixtures(favoritedIds);

            if (liveFixtureIds.length === 0) {
                return;
            }

            // Process events so MatchEventMonitor internal dedup state stays current
            await MatchEventMonitor.monitorMatches(liveFixtureIds);

            // Refresh match UIs; server push handles user-visible alerts
            queryClient.invalidateQueries({ queryKey: ['matches', 'live'] });
            for (const fixtureId of liveFixtureIds) {
                queryClient.invalidateQueries({ queryKey: ['matches', fixtureId] });
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

        logger.debug('Starting match event monitor (cache refresh only)');

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
        };
    }, [queryClient]);

    return {
        startMonitoring,
        stopMonitoring,
    };
};
