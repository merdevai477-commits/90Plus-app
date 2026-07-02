/**
 * Fetch EAS updates on launch. app.json uses checkAutomatically: ON_LOAD.
 *
 * IMPORTANT: Never call reloadAsync() in the same session after fetch — that
 * was causing mass logouts (Clerk SecureStore read interrupted mid-hydration).
 * Download now, apply on the *next* cold start via OtaPendingReloadGate.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';

export const OTA_PENDING_RELOAD_KEY = '@90plus_pending_ota_reload';

export function OtaUpdateBootstrap() {
    const { isLoaded } = useAuth();
    const ran = useRef(false);

    useEffect(() => {
        if (__DEV__ || ran.current || !isLoaded) return;
        ran.current = true;

        (async () => {
            try {
                if (!Updates.isEnabled) return;

                const check = await Updates.checkForUpdateAsync();
                if (!check.isAvailable) return;

                logger.info('[OTA] Update available — fetching (reload deferred to next launch)');
                await Updates.fetchUpdateAsync();
                await AsyncStorage.setItem(OTA_PENDING_RELOAD_KEY, '1');
            } catch (err) {
                logger.warn('[OTA] Update check failed:', err);
            }
        })();
    }, [isLoaded]);

    return null;
}
