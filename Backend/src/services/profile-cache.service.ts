/**
 * Profile Cache Service
 * Redis-backed cache for user profiles with in-memory fallback
 */

import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';

const PROFILE_TTL_SECONDS = 5 * 60; // 5 minutes
const KEY_PREFIX = 'profile:';

// In-memory fallback when Redis is down
const memoryFallback = new Map<string, { data: any; expiresAt: number }>();

function buildKey(clerkUserId: string): string {
    return `${KEY_PREFIX}${clerkUserId}`;
}

function cleanMemoryFallback(): void {
    const now = Date.now();
    for (const [key, entry] of memoryFallback.entries()) {
        if (entry.expiresAt < now) memoryFallback.delete(key);
    }
}

export async function getProfileCache<T>(clerkUserId: string): Promise<T | null> {
    const key = buildKey(clerkUserId);

    // Try Redis first
    if (isRedisConnected()) {
        try {
            const redis = getRedisClient()!;
            const raw = await redis.get(key);
            if (raw) {
                return JSON.parse(raw) as T;
            }
            return null;
        } catch (err: any) {
            logger.warn('[ProfileCache] Redis get failed, falling back to memory:', err.message);
        }
    }

    // Memory fallback
    const entry = memoryFallback.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        return entry.data as T;
    }
    memoryFallback.delete(key);
    return null;
}

export async function setProfileCache<T>(clerkUserId: string, data: T): Promise<void> {
    const key = buildKey(clerkUserId);
    const serialized = JSON.stringify(data);

    // Try Redis first
    if (isRedisConnected()) {
        try {
            const redis = getRedisClient()!;
            await redis.setex(key, PROFILE_TTL_SECONDS, serialized);
            return;
        } catch (err: any) {
            logger.warn('[ProfileCache] Redis set failed, falling back to memory:', err.message);
        }
    }

    // Memory fallback
    cleanMemoryFallback();
    memoryFallback.set(key, {
        data,
        expiresAt: Date.now() + PROFILE_TTL_SECONDS * 1000,
    });
}

export async function invalidateProfileCache(clerkUserId: string): Promise<void> {
    const key = buildKey(clerkUserId);

    // Always clear memory fallback
    memoryFallback.delete(key);

    if (isRedisConnected()) {
        try {
            const redis = getRedisClient()!;
            await redis.del(key);
        } catch (err: any) {
            logger.warn('[ProfileCache] Redis del failed:', err.message);
        }
    }
}
