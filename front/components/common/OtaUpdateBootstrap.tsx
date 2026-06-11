/**
 * Fetch EAS updates on launch. Required because app.json uses
 * checkAutomatically: ON_LOAD — store builds otherwise never pull OTA.
 *
 * Defers reloadAsync while Captain AI has an active conversation so the
 * chat screen is not wiped mid-reply.
 */
import { useEffect, useRef } from 'react';
import * as Updates from 'expo-updates';
import { logger } from '../../services/logger';
import { isChatSessionActive, waitForChatSessionIdle } from '../../utils/chatSessionState';

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

                if (isChatSessionActive()) {
                    logger.info('[OTA] Chat active — waiting before reload');
                    const idle = await waitForChatSessionIdle();
                    if (!idle) {
                        logger.info('[OTA] Reload deferred — chat still active');
                        return;
                    }
                }

                await Updates.reloadAsync();
            } catch (err) {
                logger.warn('[OTA] Update check failed:', err);
            }
        })();
    }, []);

    return null;
}
