/**
 * Profile Cache Service
 * Redis-backed cache for user profiles with namespace tracking
 * 
 * ✅ Updated to use ProfileCacheHelper for efficient cache management
 */

import { ProfileCacheHelper } from './cache-helpers.service';
import { logger } from '../utils/logger';

// In-memory fallback when Redis is down (kept for backward compatibility)
const memoryFallback = new Map<string, { data: any; expiresAt: number }>();
const PROFILE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanMemoryFallback(): void {
    const now = Date.now();
    for (const [key, entry] of memoryFallback.entries()) {
        if (entry.expiresAt < now) memoryFallback.delete(key);
    }
}

export async function getProfileCache<T>(clerkUserId: string): Promise<T | null> {
    try {
        // Try new cache helper first
        const cached = await ProfileCacheHelper.get<T>(clerkUserId);
        if (cached) return cached;

        // Fallback to memory
        const entry = memoryFallback.get(clerkUserId);
        if (entry && entry.expiresAt > Date.now()) {
            return entry.data as T;
        }
        memoryFallback.delete(clerkUserId);
        return null;
    } catch (err: any) {
        logger.warn('[ProfileCache] Get failed:', err.message);
        return null;
    }
}

export async function setProfileCache<T>(clerkUserId: string, data: T): Promise<void> {
    try {
        // Use new cache helper with namespace tracking
        await ProfileCacheHelper.set(clerkUserId, data);

        // Also set in memory fallback
        cleanMemoryFallback();
        memoryFallback.set(clerkUserId, {
            data,
            expiresAt: Date.now() + PROFILE_TTL_MS,
        });
    } catch (err: any) {
        logger.warn('[ProfileCache] Set failed:', err.message);
    }
}

export async function invalidateProfileCache(clerkUserId: string): Promise<void> {
    try {
        // Use new cache helper for proper namespace cleanup
        await ProfileCacheHelper.del(clerkUserId);

        // Also clear memory fallback
        memoryFallback.delete(clerkUserId);
    } catch (err: any) {
        logger.warn('[ProfileCache] Invalidate failed:', err.message);
    }
}

/**
 * Clear all profile cache (useful for testing or maintenance)
 */
export async function clearAllProfileCache(): Promise<number> {
    try {
        memoryFallback.clear();
        return await ProfileCacheHelper.clear();
    } catch (err: any) {
        logger.warn('[ProfileCache] Clear all failed:', err.message);
        return 0;
    }
}

/**
 * Get profile cache statistics
 */
export async function getProfileCacheStats(): Promise<{
    totalKeys: number;
    memoryKeys: number;
}> {
    try {
        const totalKeys = await ProfileCacheHelper.count();
        return {
            totalKeys,
            memoryKeys: memoryFallback.size,
        };
    } catch (err: any) {
        logger.warn('[ProfileCache] Get stats failed:', err.message);
        return {
            totalKeys: 0,
            memoryKeys: memoryFallback.size,
        };
    }
}
