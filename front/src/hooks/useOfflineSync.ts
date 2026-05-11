/**
 * useOfflineSync
 *
 * Registers a single NetInfo listener for the app. Whenever connectivity is
 * restored (or the hook mounts while already online) it drains the offline
 * queue by replaying each pending mutation against the API.
 *
 * Usage:
 *   Mount once in the root layout:
 *     <useOfflineSync />  // inside a component below <ClerkProvider>
 *
 * Behavior:
 *  - Drain runs serially (one request at a time) to avoid flooding the API
 *    after a long offline period.
 *  - Per-item outcomes:
 *      • Success (2xx)                → dequeue, emit success toast
 *      • E005 (ALREADY_PREDICTED)     → dequeue silently (UI is correct)
 *      • E006 (RATE_LIMIT) or E002    → dequeue + warning toast (can't retry)
 *      • Any other error              → keep in queue, increment attempts.
 *        After 5 attempts we drop the item so it doesn't retry forever.
 *  - We never show spammy per-item toasts. A single summary toast is shown
 *    after a non-empty drain.
 */

import { useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from '@clerk/clerk-expo';
import { offlineQueue, QueuedItem, QueuedPredictionPayload } from '../services/offlineQueue';
import { PredictionsService, PredictionApiError } from '../../services/predictions.service';
import { toastManager } from '../../services/toastManager';
import { useTranslation } from '../i18n';
import { predictionsMapKey, predictionsTicketsKey } from '../../services/predictionsCacheKeys';
import { cacheService } from '../../services/cacheService';
import { logger } from '../../utils/logger';

const MAX_ATTEMPTS = 5;

export function useOfflineSync(): void {
    const { getToken, userId } = useAuth();
    const { translate: t } = useTranslation();

    // Stable refs so the NetInfo listener always sees the latest callbacks
    // without re-subscribing on every render.
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const userIdRef = useRef(userId ?? null);
    userIdRef.current = userId ?? null;
    const tRef = useRef(t);
    tRef.current = t;

    // Prevent two overlapping drains (e.g. flaky connectivity flipping).
    const isDrainingRef = useRef(false);
    const lastConnectedRef = useRef<boolean | null>(null);

    useEffect(() => {
        const drainQueue = async () => {
            if (isDrainingRef.current) return;
            isDrainingRef.current = true;
            try {
                const items = await offlineQueue.getAll();
                // Early exit: don't even try to acquire a token or touch
                // NetInfo again if there's nothing to send. Keeps repeated
                // mounts cheap.
                if (items.length === 0) return;

                const uid = userIdRef.current;
                // Without a signed-in user we can't get a token — postpone.
                if (!uid) return;

                let token: string | null = null;
                try {
                    token = (await getTokenRef.current()) ?? null;
                } catch {
                    token = null;
                }
                if (!token) return;

                let succeeded = 0;
                let failed = 0;

                for (const item of items) {
                    if (item.type !== 'PREDICTION') continue;
                    const payload = item.payload as QueuedPredictionPayload;

                    // Belt-and-suspenders: never replay a queued item that
                    // belongs to a different (previous) signed-in user.
                    if (payload.userId && payload.userId !== uid) {
                        await offlineQueue.dequeue(item.id);
                        continue;
                    }

                    try {
                        await PredictionsService.submitPrediction(token, {
                            apiMatchId: payload.apiMatchId,
                            predictionType: payload.predictionType,
                            homeTeam: payload.homeTeam,
                            awayTeam: payload.awayTeam,
                            homeTeamLogo: payload.homeTeamLogo,
                            awayTeamLogo: payload.awayTeamLogo,
                            matchDate: payload.matchDate,
                            leagueName: payload.leagueName,
                        });
                        await offlineQueue.dequeue(item.id);
                        succeeded += 1;
                    } catch (err) {
                        const code = err instanceof PredictionApiError ? err.code : 'E010';

                        if (code === 'E005') {
                            // Already predicted server-side — drop silently.
                            await offlineQueue.dequeue(item.id);
                            succeeded += 1;
                            continue;
                        }

                        if (code === 'E006' || code === 'E002') {
                            // Rate-limit or auth problem — retrying won't help
                            // within the current session. Drop with a toast.
                            await offlineQueue.dequeue(item.id);
                            failed += 1;
                            await rollbackPrediction(uid, payload.apiMatchId);
                            continue;
                        }

                        // Transient error — keep it queued for another retry.
                        const attempts = await offlineQueue.incrementAttempts(item.id);
                        if (attempts >= MAX_ATTEMPTS) {
                            await offlineQueue.dequeue(item.id);
                            failed += 1;
                            await rollbackPrediction(uid, payload.apiMatchId);
                        }
                    }
                }

                if (succeeded > 0) {
                    toastManager.showSuccess(
                        tRef.current('offlineQueue.syncedTitle'),
                        tRef.current('offlineQueue.syncedMessage').replace('{{count}}', String(succeeded)),
                        { position: 'top', duration: 2500 },
                    );
                }
                if (failed > 0) {
                    toastManager.showWarning(
                        tRef.current('offlineQueue.failedTitle'),
                        tRef.current('offlineQueue.failedMessage').replace('{{count}}', String(failed)),
                        { position: 'top', duration: 3000 },
                    );
                }
            } catch (err) {
                logger.warn('[useOfflineSync] drain failed', err);
            } finally {
                isDrainingRef.current = false;
            }
        };

        // Kick off an initial drain in case we mount while already online
        // and the queue has leftover items from a previous session. We
        // cheaply check the queue first so repeated mounts don't hit the
        // network or NetInfo for nothing.
        (async () => {
            try {
                const items = await offlineQueue.getAll();
                if (items.length === 0) return;
                const state = await NetInfo.fetch();
                lastConnectedRef.current = state.isConnected ?? null;
                if (state.isConnected) drainQueue();
            } catch {
                // non-fatal
            }
        })();

        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const now = state.isConnected ?? false;
            const prev = lastConnectedRef.current;
            lastConnectedRef.current = now;
            // Only drain on the offline → online transition. Without this
            // check we'd drain every time NetInfo emits (which it does
            // frequently on some platforms).
            if (prev === false && now === true) {
                drainQueue();
            }
        });
        return () => {
            unsubscribe();
        };
    }, []);
}

/**
 * Roll back the optimistic cache entry for a prediction that failed to sync.
 * Best-effort — cache state is non-critical and the next server reconciliation
 * will correct any drift anyway.
 */
async function rollbackPrediction(userId: string, apiMatchId: string): Promise<void> {
    try {
        const mapKey = predictionsMapKey(userId);
        const ticketsKey = predictionsTicketsKey(userId);
        const map = (await cacheService.get<Record<string, 'home' | 'draw' | 'away'>>(mapKey)) ?? {};
        if (map[apiMatchId]) {
            const next = { ...map };
            delete next[apiMatchId];
            await cacheService.set(mapKey, next, 24 * 60 * 60 * 1000);
        }
        const tickets = (await cacheService.get<number>(ticketsKey)) ?? null;
        if (typeof tickets === 'number') {
            await cacheService.set(ticketsKey, tickets + 1, 24 * 60 * 60 * 1000);
        }
    } catch {
        // non-fatal
    }
}

export default useOfflineSync;
