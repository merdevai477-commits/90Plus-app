/**
 * useNetworkStatus
 *
 * Tiny subscribe-once wrapper around @react-native-community/netinfo.
 * Returns `{ isOnline }` and auto-unsubscribes on unmount.
 *
 * Why a hook (not a global store):
 *   - The chat screen is the only consumer that needs live online/offline
 *     state, so we keep the footprint small.
 *   - NetInfo.addEventListener already caches the last state internally,
 *     so mounting is effectively free (one callback fires immediately).
 */

import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
    isOnline: boolean;
}

export function useNetworkStatus(): NetworkStatus {
    const [isOnline, setIsOnline] = useState<boolean>(true);

    useEffect(() => {
        const handle = (state: NetInfoState) => {
            // Treat "unknown" as online so we never show a misleading red dot
            // while NetInfo is booting on Android.
            const online = state.isConnected !== false && state.isInternetReachable !== false;
            setIsOnline(online);
        };

        // Seed with current snapshot (fast path — no waiting for an event).
        NetInfo.fetch().then(handle).catch(() => {});

        const unsubscribe = NetInfo.addEventListener(handle);
        return () => {
            unsubscribe();
        };
    }, []);

    return { isOnline };
}
