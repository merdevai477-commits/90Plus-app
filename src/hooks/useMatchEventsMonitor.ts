import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { MatchEventMonitor } from '../services/matchEventMonitor';
import { MatchFavoritesStorage } from '../storage/matchFavorites.storage';
import { useHomeStore } from '../store/home.store';
import { isRateLimitError } from '../../services/apiFootball';
import { logger } from '../services/logger';

const POLLING_INTERVAL = 45000; // 45 seconds

/**
 * React hook to monitor favorited matches for live events
 * Only monitors when app is in foreground
 */
export const useMatchEventsMonitor = () => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appState = useRef(AppState.currentState);
    const { addMatchNotification } = useHomeStore();

    const monitorFavoritedMatches = async () => {
        try {
            // Get favorited match IDs
            const favoritedIds = await MatchFavoritesStorage.getFavorites();

            if (favoritedIds.length === 0) {
                console.log('📭 No favorited matches to monitor');
                return;
            }

            console.log(`⭐ Found ${favoritedIds.length} favorited match(es): ${favoritedIds.join(', ')}`);

            // Get only LIVE favorited matches
            const liveFixtureIds = await MatchEventMonitor.getLiveFavoritedFixtures(favoritedIds);

            if (liveFixtureIds.length === 0) {
                console.log('💤 No live favorited matches at the moment');
                return;
            }

            console.log(`🔴 Monitoring ${liveFixtureIds.length} LIVE favorited match(es): ${liveFixtureIds.join(', ')}`);

            // Check for new events
            const newEvents = await MatchEventMonitor.monitorMatches(liveFixtureIds);

            // Create notifications for new events
            for (const event of newEvents) {
                const notification = formatEventNotification(event);
                addMatchNotification(notification);
                console.log(`🔔 New notification added: ${notification.title} - ${notification.message}`);
            }

            if (newEvents.length > 0) {
                console.log(`✅ ${newEvents.length} new event(s) detected and notified!`);
            } else {
                console.log('✓ No new events in this check');
            }
        } catch (error) {
            // Handle rate limit errors gracefully with debug-level logging
            if (isRateLimitError(error)) {
                logger.debug('⏸️ Rate limit encountered while monitoring matches, will retry later');
            } else {
                // Log actual errors (not rate limits) as errors
                console.error('❌ Error monitoring matches:', error);
            }
        }
    };

    const startMonitoring = () => {
        if (intervalRef.current) return; // Already running

        console.log('🚀 Starting match event monitoring...');

        // Run immediately
        monitorFavoritedMatches();

        // Then run every 45 seconds
        intervalRef.current = setInterval(monitorFavoritedMatches, POLLING_INTERVAL);
    };

    const stopMonitoring = () => {
        if (intervalRef.current) {
            console.log('🛑 Stopping match event monitoring...');
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    useEffect(() => {
        // Handle app state changes
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App came to foreground
                console.log('📱 App became active - starting monitoring');
                startMonitoring();
            } else if (nextAppState.match(/inactive|background/)) {
                // App went to background
                console.log('📱 App went to background - stopping monitoring');
                stopMonitoring();
            }

            appState.current = nextAppState;
        });

        // Start monitoring when component mounts
        startMonitoring();

        // Cleanup on unmount
        return () => {
            stopMonitoring();
            subscription.remove();
        };
    }, []);

    return {
        startMonitoring,
        stopMonitoring,
    };
};

/**
 * Format match event as notification
 */
function formatEventNotification(event: any) {
    let title = '';
    let message = '';
    let type: 'info' | 'success' | 'warning' | 'error' = 'info';

    const matchInfo = event.matchName ? `\n${event.matchName}` : '';

    switch (event.type) {
        case 'goal':
            title = `⚽ هدف!`;
            message = `${event.player} سجل هدف لـ ${event.team}${matchInfo}\nالدقيقة: ${event.minute}'`;
            type = 'success';
            break;
        case 'red_card':
            title = `🟥 طرد!`;
            message = `${event.player} طُرد من المباراة${matchInfo}\nالدقيقة: ${event.minute}'`;
            type = 'error';
            break;
        case 'yellow_card':
            title = `🟨 إنذار`;
            message = `${event.player} حصل على بطاقة صفراء${matchInfo}\nالدقيقة: ${event.minute}'`;
            type = 'warning';
            break;
        case 'penalty':
            title = `🎯 ركلة جزاء`;
            message = `ركلة جزاء لـ ${event.team}${matchInfo}\nالدقيقة: ${event.minute}'`;
            type = 'info';
            break;
        default:
            title = `📢 حدث في المباراة`;
            message = `${event.detail || 'حدث جديد'}${matchInfo}`;
            type = 'info';
    }

    return {
        title,
        message,
        type,
        fixtureId: event.fixtureId,
        eventType: event.type,
    };
}
