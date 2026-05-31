/**
 * useHomeLikes — persisted "liked videos" set for the Home VideoList.
 *
 * Optimistic local state backed by AsyncStorage, synced with the reels API.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import { ReelsService } from '../src/services/authService';
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
    const { getToken } = useAuth();
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const activeKeyRef = useRef<string>(storageKey(userId));

    useEffect(() => {
        const key = storageKey(userId);
        activeKeyRef.current = key;

        (async () => {
            try {
                const raw = await AsyncStorage.getItem(key);
                if (activeKeyRef.current !== key) return;
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
            let wasLiked = false;
            setLikedIds((prev) => {
                wasLiked = prev.has(videoId);
                const next = new Set(prev);
                if (wasLiked) next.delete(videoId);
                else next.add(videoId);
                void persist(next);
                return next;
            });

            try {
                const token = await getToken();
                if (!token) return;
                if (wasLiked) {
                    await ReelsService.unlikeReel(token, videoId);
                } else {
                    await ReelsService.likeReel(token, videoId);
                }
            } catch (err) {
                logger.warn('useHomeLikes: server sync failed', err);
                setLikedIds((prev) => {
                    const next = new Set(prev);
                    if (wasLiked) next.add(videoId);
                    else next.delete(videoId);
                    void persist(next);
                    return next;
                });
            }
        },
        [getToken, persist],
    );

    const isLiked = useCallback(
        (videoId: string) => likedIds.has(videoId),
        [likedIds],
    );

    return { likedIds, isLiked, toggleLike };
}
