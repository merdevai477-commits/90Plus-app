/**
 * Applies a staged OTA bundle before Clerk mounts so SecureStore session
 * tokens are read cleanly after reload (avoids mid-hydration mass logout).
 */
import React, { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BootSplashScreen } from '../splash/BootSplashScreen';
import { logger } from '../../services/logger';
import { OTA_PENDING_RELOAD_KEY } from './OtaUpdateBootstrap';

export function OtaPendingReloadGate({ children }: { children: React.ReactNode }) {
    const [gateOpen, setGateOpen] = useState(__DEV__);

    useEffect(() => {
        if (__DEV__) return;

        let cancelled = false;

        (async () => {
            try {
                if (!Updates.isEnabled) {
                    if (!cancelled) setGateOpen(true);
                    return;
                }

                const pending = await AsyncStorage.getItem(OTA_PENDING_RELOAD_KEY);
                if (pending !== '1') {
                    if (!cancelled) setGateOpen(true);
                    return;
                }

                await AsyncStorage.removeItem(OTA_PENDING_RELOAD_KEY);
                logger.info('[OTA] Applying staged update before auth hydration');
                await Updates.reloadAsync();
            } catch (err) {
                logger.warn('[OTA] Pending reload failed — continuing with current bundle:', err);
                if (!cancelled) setGateOpen(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (!gateOpen) {
        return <BootSplashScreen />;
    }

    return <>{children}</>;
}
