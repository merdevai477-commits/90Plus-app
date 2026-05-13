/**
 * useChatProfile
 *
 * Fetch-once-per-mount hook for the AI chat screen. Returns just the
 * slice of the user profile the chat cares about:
 *   - displayName (or null → UI falls back to "كابتن")
 *   - avatar URL
 *   - FIFA-card fields used to personalize the AI system prompt
 *
 * Design goals:
 *   - Zero network work on fast screen re-entries (10 min AsyncStorage TTL)
 *   - Never re-fetch on every message — the hook exposes a ref-backed
 *     value that stays stable for the conversation lifetime
 *   - Silent failure: if profile fetch fails, fall back to the generic path
 *     (no error surface on the chat screen itself)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { AuthService, type UserProfile } from '../src/services/authService';

const CACHE_KEY_PREFIX = '@chat_profile_v1_';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface ChatProfileSlice {
    /** Display name, or null if the user only has an auto-generated username. */
    displayName: string | null;
    /** Avatar URL (Cloudflare R2) or null. */
    avatar: string | null;
    /** FIFA-card fields — all nullable until the user fills them. */
    position: string | null;
    age: number | null;
    height: number | null;
    weight: number | null;
    preferredFoot: string | null;
    countryFlag: string | null;
}

interface CacheEntry {
    data: ChatProfileSlice;
    cachedAt: number;
}

function toSlice(p: UserProfile): ChatProfileSlice {
    return {
        displayName: p.displayName,
        avatar: p.avatar,
        position: p.position,
        age: p.age,
        height: p.height,
        weight: p.weight,
        preferredFoot: p.preferredFoot,
        countryFlag: p.countryFlag,
    };
}

export interface UseChatProfileResult {
    profile: ChatProfileSlice | null;
    /** Stable ref — consumers can read without causing re-renders. */
    profileRef: React.RefObject<ChatProfileSlice | null>;
    /** True while the initial fetch is in flight. */
    loading: boolean;
    /**
     * `true` when every FIFA-card field is populated. Used to gate the
     * personalization system prompt + the "fill your profile" nudge.
     */
    isFifaCardComplete: boolean;
}

export function useChatProfile(): UseChatProfileResult {
    const { getToken, userId } = useAuth();
    const { user: clerkUser } = useUser();
    const [profile, setProfile] = useState<ChatProfileSlice | null>(null);
    const profileRef = useRef<ChatProfileSlice | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const cacheKey = userId ? `${CACHE_KEY_PREFIX}${userId}` : null;

    const updateProfile = useCallback((next: ChatProfileSlice | null) => {
        profileRef.current = next;
        setProfile(next);
    }, []);

    useEffect(() => {
        if (!cacheKey) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            // 1) Instant hydration from AsyncStorage if the cache is fresh.
            try {
                const raw = await AsyncStorage.getItem(cacheKey);
                if (raw) {
                    const entry = JSON.parse(raw) as CacheEntry;
                    const age = Date.now() - entry.cachedAt;
                    if (age < CACHE_TTL_MS && !cancelled) {
                        // Fall back to Clerk's imageUrl if the cached avatar is null.
                        const cached = entry.data;
                        if (!cached.avatar && clerkUser?.imageUrl) {
                            updateProfile({ ...cached, avatar: clerkUser.imageUrl });
                        } else {
                            updateProfile(cached);
                        }
                        setLoading(false);
                        return; // cache hit is fresh — no network call needed
                    }
                }
            } catch {
                // cache miss / parse error is non-fatal
            }

            // 2) Fresh fetch.
            try {
                const token = await getToken();
                if (!token || cancelled) {
                    setLoading(false);
                    return;
                }
                const fresh = await AuthService.syncUserWithBackend(token);
                if (cancelled) return;
                if (fresh) {
                    const slice = toSlice(fresh);
                    // Fall back to Clerk's imageUrl when the backend avatar is null.
                    if (!slice.avatar && clerkUser?.imageUrl) {
                        slice.avatar = clerkUser.imageUrl;
                    }
                    updateProfile(slice);
                    AsyncStorage.setItem(
                        cacheKey,
                        JSON.stringify({ data: slice, cachedAt: Date.now() } as CacheEntry),
                    ).catch(() => {});
                }
            } catch {
                // silent — chat falls back to the generic greeting / prompt
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [cacheKey, getToken, updateProfile, clerkUser?.imageUrl]);

    const isFifaCardComplete = !!(
        profile &&
        profile.position &&
        profile.age != null &&
        profile.weight != null &&
        profile.preferredFoot &&
        profile.countryFlag
    );

    return { profile, profileRef, loading, isFifaCardComplete };
}

/**
 * Build the personalized system prompt suffix to send to the AI.
 * Returns an empty string if the profile is incomplete — callers should
 * then use the generic system prompt untouched.
 */
export function buildProfileSystemPromptSuffix(
    profile: ChatProfileSlice | null,
    greetingName: string,
): string {
    if (!profile) return '';
    const {
        position,
        age,
        weight,
        preferredFoot,
        countryFlag,
    } = profile;
    if (!position || age == null || weight == null || !preferredFoot || !countryFlag) {
        return '';
    }
    return [
        '',
        `You are talking to a football player named ${greetingName}.`,
        `Profile: Position=${position}, Age=${age}, Weight=${weight}kg, Preferred Foot=${preferredFoot}, Country=${countryFlag}.`,
        'Personalize your responses based on this profile.',
    ].join('\n');
}
