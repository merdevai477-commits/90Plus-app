/**
 * useHomeLikes — persisted "liked videos" set for the Home VideoList.
 *
 * Optimistic local state backed by AsyncStorage so hearts survive app
 * restarts. Keyed per-user so switching accounts doesn't leak state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const STORAGE_PREFIX = '@home_liked_videos';

function storageKey(userId: string | null | undefined): string {
    return `${STORAGE_PREFIX}:${userId ?? 'guest'}`;
}

export interface UseHomeLikesResult {
    likedIds: Set<string>;
    isLiked: (videoId: string) => boolean;
    toggleLike: (videoId: string) => Promise<void>;
}

export function useHomeLikes(userId: string | null | undefined): UseHomeLikesResult {
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const hydratedRef = useRef(false);
    const activeKeyRef = useRef<string>(storageKey(userId));

    // Hydrate on mount / on user switch.
    useEffect(() => {
        const key = storageKey(userId);
        activeKeyRef.current = key;
        hydratedRef.current = false;

        (async () => {
            try {
                const raw = await AsyncStorage.getItem(key);
                if (activeKeyRef.current !== key) return; // user switched mid-flight
                if (raw) {
                    const ids: unknown = JSON.parse(raw);
                    if (Array.isArray(ids)) {
                        setLikedIds(new Set(ids.filter((x): x is string => typeof x === 'string')));
                    } else {
                        setLikedIds(new Set());
                    }
                } else {
                    setLikedIds(new Set());
                }
            } catch (err) {
                logger.warn('useHomeLikes: hydrate failed', err);
                setLikedIds(new Set());
            } finally {
                hydratedRef.current = true;
            }
        })();
    }, [userId]);

    const persist = useCallback(async (next: Set<string>) => {
        try {
            await AsyncStorage.setItem(
                activeKeyRef.current,
                JSON.stringify(Array.from(next)),
            );
        } catch (err) {
            logger.warn('useHomeLikes: persist failed', err);
        }
    }, []);

    const toggleLike = useCallback(
        async (videoId: string) => {
            // Optimistic update
            setLikedIds((prev) => {
                const next = new Set(prev);
                if (next.has(videoId)) next.delete(videoId);
                else next.add(videoId);
                void persist(next);
                return next;
            });
        },
        [persist],
    );

    const isLiked = useCallback(
        (videoId: string) => likedIds.has(videoId),
        [likedIds],
    );

    return { likedIds, isLiked, toggleLike };
}
