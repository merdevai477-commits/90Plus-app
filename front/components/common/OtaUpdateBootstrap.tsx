/**
 * Fetch EAS updates on launch. Required because app.json uses
 * checkAutomatically: ON_ERROR_RECOVERY — store builds otherwise never pull OTA.
 */
import { useEffect, useRef } from 'react';
import * as Updates from 'expo-updates';
import { logger } from '../../services/logger';

export function OtaUpdateBootstrap() {
    const ran = useRef(false);

    useEffect(() => {
        if (__DEV__ || ran.current) return;
        ran.current = true;

        (async () => {
            try {
                if (!Updates.isEnabled) return;

                const check = await Updates.checkForUpdateAsync();
                if (!check.isAvailable) return;

                logger.info('[OTA] Update available — fetching');
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
            } catch (err) {
                logger.warn('[OTA] Update check failed:', err);
            }
        })();
    }, []);

    return null;
}
