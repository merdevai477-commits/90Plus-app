/**
 * Per-user write throttles for Community (posts, comments, media uploads).
 *
 * Each action has a hard cooldown between two writes plus one or more rolling
 * windows (fixed-window counters). Redis is the source of truth; an in-memory
 * map keeps single-instance dev/test working without Redis.
 */

import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';

export type CommunityAction = 'post' | 'comment' | 'media';

interface WindowRule {
    id: string;
    windowSec: number;
    max: number;
}

interface ActionRule {
    cooldownSec: number;
    windows: WindowRule[];
}

export const COMMUNITY_RATE_RULES: Record<CommunityAction, ActionRule> = {
    post: { cooldownSec: 60, windows: [{ id: 'day', windowSec: 24 * 60 * 60, max: 20 }] },
    comment: { cooldownSec: 5, windows: [{ id: '10m', windowSec: 10 * 60, max: 30 }] },
    media: { cooldownSec: 3, windows: [{ id: 'hour', windowSec: 60 * 60, max: 10 }] },
};

/** Max comments one user can leave on a single post (replies included). */
export const MAX_COMMENTS_PER_USER_PER_POST = 20;

export type RateVerdict = { allowed: true } | { allowed: false; retryAfterSec: number; reason: 'cooldown' | 'window' };

interface MemoryEntry {
    value: number;
    expiresAt: number;
}

const memory = new Map<string, MemoryEntry>();

function liveRedis() {
    return isRedisConnected() ? getRedisClient() : null;
}

function memGet(key: string): MemoryEntry | null {
    const e = memory.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
        memory.delete(key);
        return null;
    }
    return e;
}

function memSetNx(key: string, ttlSec: number): boolean {
    if (memGet(key)) return false;
    memory.set(key, { value: 1, expiresAt: Date.now() + ttlSec * 1000 });
    return true;
}

function memIncr(key: string, ttlSec: number): number {
    const e = memGet(key);
    if (e) {
        e.value += 1;
        return e.value;
    }
    memory.set(key, { value: 1, expiresAt: Date.now() + ttlSec * 1000 });
    if (memory.size > 20_000) {
        const now = Date.now();
        for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k);
    }
    return 1;
}

function memTtl(key: string): number {
    const e = memGet(key);
    return e ? Math.max(1, Math.ceil((e.expiresAt - Date.now()) / 1000)) : 0;
}

const cooldownKey = (action: CommunityAction, userId: string) => `community:rl:${action}:cd:${userId}`;
const windowKey = (action: CommunityAction, rule: WindowRule, userId: string) =>
    `community:rl:${action}:${rule.id}:${userId}:${Math.floor(Date.now() / 1000 / rule.windowSec)}`;

/**
 * Check without consuming. Returns how long the user must wait when blocked.
 */
export async function peekCommunityRate(action: CommunityAction, userId: string): Promise<RateVerdict> {
    const rule = COMMUNITY_RATE_RULES[action];
    const redis = liveRedis();
    try {
        if (redis) {
            const cdTtl = await redis.ttl(cooldownKey(action, userId));
            if (cdTtl > 0) return { allowed: false, retryAfterSec: cdTtl, reason: 'cooldown' };
            for (const w of rule.windows) {
                const key = windowKey(action, w, userId);
                const count = Number((await redis.get(key)) ?? 0);
                if (count >= w.max) {
                    const ttl = await redis.ttl(key);
                    return { allowed: false, retryAfterSec: Math.max(1, ttl), reason: 'window' };
                }
            }
            return { allowed: true };
        }
    } catch (err: any) {
        logger.warn('[community-rate] redis peek failed, using memory:', err?.message);
    }

    const cd = memTtl(cooldownKey(action, userId));
    if (cd > 0) return { allowed: false, retryAfterSec: cd, reason: 'cooldown' };
    for (const w of rule.windows) {
        const key = windowKey(action, w, userId);
        if ((memGet(key)?.value ?? 0) >= w.max) {
            return { allowed: false, retryAfterSec: memTtl(key), reason: 'window' };
        }
    }
    return { allowed: true };
}

/**
 * Atomically claim one write. The cooldown is claimed with SET NX so two
 * concurrent requests from the same user cannot both pass.
 */
export async function consumeCommunityRate(action: CommunityAction, userId: string): Promise<RateVerdict> {
    const rule = COMMUNITY_RATE_RULES[action];
    const redis = liveRedis();
    try {
        if (redis) {
            const cdKey = cooldownKey(action, userId);
            const claimed = await redis.set(cdKey, '1', 'EX', rule.cooldownSec, 'NX');
            if (claimed !== 'OK') {
                const ttl = await redis.ttl(cdKey);
                return { allowed: false, retryAfterSec: Math.max(1, ttl), reason: 'cooldown' };
            }
            for (const w of rule.windows) {
                const key = windowKey(action, w, userId);
                const count = await redis.incr(key);
                if (count === 1) await redis.expire(key, w.windowSec);
                if (count > w.max) {
                    await redis.decr(key);
                    await redis.del(cdKey);
                    const ttl = await redis.ttl(key);
                    return { allowed: false, retryAfterSec: Math.max(1, ttl), reason: 'window' };
                }
            }
            return { allowed: true };
        }
    } catch (err: any) {
        logger.warn('[community-rate] redis consume failed, using memory:', err?.message);
    }

    const cdKey = cooldownKey(action, userId);
    if (!memSetNx(cdKey, rule.cooldownSec)) {
        return { allowed: false, retryAfterSec: memTtl(cdKey), reason: 'cooldown' };
    }
    for (const w of rule.windows) {
        const key = windowKey(action, w, userId);
        const count = memIncr(key, w.windowSec);
        if (count > w.max) {
            const e = memGet(key);
            if (e) e.value -= 1;
            memory.delete(cdKey);
            return { allowed: false, retryAfterSec: memTtl(key), reason: 'window' };
        }
    }
    return { allowed: true };
}

/** Give the slot back when the write was rejected afterwards (e.g. profanity). */
export async function refundCommunityRate(action: CommunityAction, userId: string): Promise<void> {
    const rule = COMMUNITY_RATE_RULES[action];
    const redis = liveRedis();
    try {
        if (redis) {
            await redis.del(cooldownKey(action, userId));
            for (const w of rule.windows) {
                const key = windowKey(action, w, userId);
                const v = await redis.decr(key);
                if (v < 0) await redis.del(key);
            }
            return;
        }
    } catch {
        /* fall through to memory */
    }
    memory.delete(cooldownKey(action, userId));
    for (const w of rule.windows) {
        const e = memGet(windowKey(action, w, userId));
        if (e && e.value > 0) e.value -= 1;
    }
}

/** Test helper. */
export function __resetCommunityRateMemory(): void {
    memory.clear();
}
