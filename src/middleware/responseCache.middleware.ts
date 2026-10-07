/**
 * Response Caching Middleware
 * 
 * In-memory cache for GET requests to reduce database/API calls.
 * Uses ETag for conditional requests (304 Not Modified).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import type Redis from 'ioredis';
import { getRedisClient } from '../lib/redis';
import { redisCacheService } from '../services/redis-cache.service';
import { logger } from '../utils/logger';
import { shouldHonorFreshCacheBypass, shouldHonorPullCacheBypass } from '../utils/cache-bypass.util';
import { resolveAppLanguage } from '../utils/app-language.util';

interface CacheEntry {
    data: any;
    etag: string;
    timestamp: number;
    ttl: number;
    /** Serialized `data` — L1 only (Redis stores `data`); hits send it as-is. */
    body?: string;
}

function sendCacheEntry(res: Response, entry: CacheEntry): Response {
    if (typeof entry.body === 'string') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.send(entry.body);
    }
    return res.json(entry.data);
}

export function buildResponseCacheKey(req: Request, sharedCache = false): string {
    const joined = `${req.baseUrl || ''}${req.path || ''}`.split('?')[0] || '/';
    const path = joined.startsWith('/') ? joined : `/${joined}`;
    const query = JSON.stringify(req.query);
    if (sharedCache) {
        // Public football payloads are localized from headers as well as query
        // params, so language must be part of the cross-user cache identity.
        return `${path}:${query}:lang=${resolveAppLanguage(req)}:shared`;
    }
    const userId = (req as any).auth?.userId || 'anonymous';
    return `${path}:${query}:${userId}`;
}

class ResponseCache {
    private memoryCache = new Map<string, CacheEntry>(); // Fallback in-memory cache
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_MEMORY_ENTRIES = 200;
    private readonly MAX_ENTRY_BYTES = 256_000; // skip L1 for huge calendar/fixture payloads
    private pending = new Map<string, Promise<CacheEntry>>(); // stampede protection per key
    private pendingResolvers = new Map<string, (entry: CacheEntry) => void>();
    private pendingRejectors = new Map<string, (err: unknown) => void>();

    private putMemory(key: string, entry: CacheEntry): void {
        if (!this.memoryCache.has(key) && this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
            const oldest = this.memoryCache.keys().next().value;
            if (oldest !== undefined) this.memoryCache.delete(oldest);
        }
        this.memoryCache.set(key, entry);
    }

    size(): number {
        return this.memoryCache.size;
    }

    /** L1 copy holding only the serialized body; null when too large for L1. */
    private toMemoryEntry(entry: CacheEntry, body?: string): CacheEntry | null {
        let serialized = body;
        if (serialized === undefined) {
            try {
                serialized = JSON.stringify(entry.data);
            } catch {
                return null;
            }
        }
        if (Buffer.byteLength(serialized, 'utf8') > this.MAX_ENTRY_BYTES) return null;
        return { etag: entry.etag, timestamp: entry.timestamp, ttl: entry.ttl, data: undefined, body: serialized };
    }

    private isOversized(data: unknown): boolean {
        const list = (data as { response?: unknown; data?: unknown } | null)?.response
            ?? (data as { data?: unknown } | null)?.data;
        // Cheap proxy (no stringify): large fixture arrays are the oversized case.
        return Array.isArray(list) && list.length > 300;
    }

    /**
     * Generate cache key from request.
     * When `sharedCache` is true the userId is omitted so a single entry
     * serves ALL users (correct for public/shared endpoints like football
     * match listings that are identical regardless of auth).
     */
    private getCacheKey(req: Request, sharedCache = false): string {
        return buildResponseCacheKey(req, sharedCache);
    }

    /**
     * Generate ETag from data (synchronous — used on cache MISS before send).
     */
    generateETag(data: any): string {
        const str = JSON.stringify(data);
        return crypto.createHash('md5').update(str).digest('hex');
    }

    /**
     * Get cached response — memory first (µs), then Redis.
     */
    async get(req: Request, sharedCache = false): Promise<CacheEntry | null> {
        const key = this.getCacheKey(req, sharedCache);

        const memoryEntry = this.memoryCache.get(key);
        if (memoryEntry && Date.now() - memoryEntry.timestamp <= memoryEntry.ttl) {
            return memoryEntry;
        }
        if (memoryEntry) {
            this.memoryCache.delete(key);
        }

        const redisKey = `response:${key}`;
        try {
            const cached = await redisCacheService.get<CacheEntry>(redisKey);
            if (cached) {
                // Same size guard as set(): huge calendars must not fill process RAM.
                const memoryCopy = this.isOversized(cached.data) ? null : this.toMemoryEntry(cached);
                if (memoryCopy) {
                    this.putMemory(key, memoryCopy);
                    return memoryCopy;
                }
                return cached;
            }
        } catch (err) {
            logger.warn('responseCache Redis get failed; using memory only', {
                path: req.path,
                message: err instanceof Error ? err.message : String(err),
            });
        }

        const pending = this.pending.get(key);
        if (pending) {
            try {
                const filled = await Promise.race([
                    pending,
                    new Promise<CacheEntry>((_, reject) =>
                        setTimeout(() => reject(new Error('PENDING_TIMEOUT')), 2_500),
                    ),
                ]);
                return filled;
            } catch {
                return null;
            }
        }

        return null;
    }

    /**
     * Register an in-flight cache fill for stampede protection.
     * Returns false if another fill is already in progress.
     */
    beginFill(req: Request, sharedCache = false): boolean {
        const key = this.getCacheKey(req, sharedCache);
        if (this.pending.has(key)) return false;

        let resolveFn!: (entry: CacheEntry) => void;
        let rejectFn!: (err: unknown) => void;
        const p = new Promise<CacheEntry>((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });

        // Attach a no-op .catch so this promise never surfaces as an
        // UnhandledPromiseRejection. Followers attach their own .catch via
        // the `await Promise.race(...)` path; the leader path may never
        // subscribe at all (when the response finishes before anyone waits).
        p.catch(() => { /* swallowed — intentionally no-op */ });

        this.pending.set(key, p);
        this.pendingResolvers.set(key, resolveFn);
        this.pendingRejectors.set(key, rejectFn);

        // Safety cleanup: don't hold pending forever.
        setTimeout(() => {
            if (this.pending.has(key)) {
                this.pendingRejectors.get(key)?.(new Error('PENDING_STALE'));
                this.pending.delete(key);
                this.pendingResolvers.delete(key);
                this.pendingRejectors.delete(key);
            }
        }, 8_000).unref?.();

        return true;
    }

    endFill(req: Request, entry: CacheEntry, sharedCache = false): void {
        const key = this.getCacheKey(req, sharedCache);
        const resolve = this.pendingResolvers.get(key);
        if (resolve) resolve(entry);
        this.pending.delete(key);
        this.pendingResolvers.delete(key);
        this.pendingRejectors.delete(key);
    }

    failFill(req: Request, err: unknown, sharedCache = false): void {
        const key = this.getCacheKey(req, sharedCache);
        const reject = this.pendingRejectors.get(key);
        if (reject) reject(err);
        this.pending.delete(key);
        this.pendingResolvers.delete(key);
        this.pendingRejectors.delete(key);
    }

    /**
     * Set cached response
     */
    async set(
        req: Request,
        data: any,
        ttl?: number,
        sharedCache = false,
        precomputed?: { etag: string; body: string },
    ): Promise<string> {
        const key = this.getCacheKey(req, sharedCache);
        const etag = precomputed?.etag ?? this.generateETag(data);
        const entry: CacheEntry = {
            data,
            etag,
            timestamp: Date.now(),
            ttl: ttl || this.DEFAULT_TTL,
        };

        // L1 only for modest payloads — huge calendars must not fill process RAM.
        const memoryCopy = this.toMemoryEntry(entry, precomputed?.body);
        if (memoryCopy) this.putMemory(key, memoryCopy);
        // Waiters are released before the Redis round-trip.
        this.endFill(req, memoryCopy ?? entry, sharedCache);

        const redisKey = `response:${key}`;
        await redisCacheService.set(redisKey, entry, entry.ttl);

        return etag;
    }

    /**
     * Clear cache for a specific path pattern
     */
    async clear(pattern?: string): Promise<void> {
        await redisCacheService.delPattern(pattern ? `response:*${pattern}*` : 'response:*');
        this.clearMemory(pattern);
        publishInvalidation(pattern);
    }

    /** L1 only — this instance's copies. */
    clearMemory(pattern?: string): void {
        if (!pattern) {
            this.memoryCache.clear();
            return;
        }
        for (const key of this.memoryCache.keys()) {
            if (key.includes(pattern)) {
                this.memoryCache.delete(key);
            }
        }
    }

    /**
     * Clean expired entries (Redis handles TTL automatically, only clean memory cache)
     */
    clean(): void {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.memoryCache.delete(key);
            }
        }
    }
}

const responseCache = new ResponseCache();

// L1 is per process: when one instance clears, the others must drop their copies too.
const INVALIDATE_CHANNEL = 'response-cache:invalidate';
const instanceId = crypto.randomUUID();
let invalidationSubscriber: Redis | null = null;

function publishInvalidation(pattern?: string): void {
    const client = getRedisClient();
    if (!client) return;
    client
        .publish(INVALIDATE_CHANNEL, JSON.stringify({ from: instanceId, pattern: pattern ?? null }))
        .catch((err: Error) => {
            logger.warn('[responseCache] invalidation publish failed', { message: err.message });
        });
}

export function handleInvalidationMessage(raw: string): void {
    let msg: { from?: string; pattern?: string | null };
    try {
        msg = JSON.parse(raw);
    } catch {
        return;
    }
    if (!msg || msg.from === instanceId) return;
    responseCache.clearMemory(typeof msg.pattern === 'string' ? msg.pattern : undefined);
}

export async function startResponseCacheInvalidationBus(): Promise<void> {
    if (invalidationSubscriber) return;
    const client = getRedisClient();
    if (!client) return;
    const subscriber = client.duplicate();
    invalidationSubscriber = subscriber;
    subscriber.on('error', (err) => {
        logger.warn('[responseCache] invalidation subscriber error', { message: err.message });
    });
    subscriber.on('message', (channel: string, raw: string) => {
        if (channel === INVALIDATE_CHANNEL) handleInvalidationMessage(raw);
    });
    try {
        await subscriber.subscribe(INVALIDATE_CHANNEL);
        logger.info('[responseCache] cross-instance invalidation subscribed');
    } catch (err) {
        logger.warn('[responseCache] invalidation subscribe failed — L1 clears stay local', {
            message: err instanceof Error ? err.message : String(err),
        });
        subscriber.disconnect();
        invalidationSubscriber = null;
    }
}

export async function stopResponseCacheInvalidationBus(): Promise<void> {
    const subscriber = invalidationSubscriber;
    invalidationSubscriber = null;
    try {
        await subscriber?.quit();
    } catch {
        subscriber?.disconnect();
    }
}

// Clean expired entries every 5 minutes without keeping CLI/test processes alive.
const responseCacheCleanupTimer = setInterval(() => {
    responseCache.clean();
}, 5 * 60 * 1000);
responseCacheCleanupTimer.unref?.();

/**
 * Response caching middleware
 * Only caches GET requests
 *
 * Options:
 * - ttl: entry lifetime in ms (default 5 min)
 * - skip: return true to bypass caching for this request
 * - sharedCache: when true, omit userId from cache key so a single entry
 *   serves ALL users. Use for public/anonymous endpoints only (football
 *   match listings, live fixtures, team info, etc.) — never for user-scoped
 *   data like /clerk/me, /profile/completion.
 */
export function responseCacheMiddleware(options: {
    ttl?: number;
    skip?: (req: Request) => boolean;
    sharedCache?: boolean;
    /**
     * Cap on the max-age sent to clients. 0 → `no-cache` (device revalidates via
     * ETag every time) for payloads with live data merged in.
     */
    clientMaxAgeSec?: number;
} = {}) {
    const { ttl, skip, sharedCache = false, clientMaxAgeSec } = options;
    const scope = sharedCache ? 'public' : 'private';

    // Advertise only the time left on the server entry, never the full TTL.
    const cacheControl = (entryTtlMs: number, ageMs: number): string => {
        let seconds = Math.max(0, Math.floor((entryTtlMs - ageMs) / 1000));
        if (clientMaxAgeSec != null) seconds = Math.min(seconds, clientMaxAgeSec);
        return seconds === 0 ? `${scope}, no-cache` : `${scope}, max-age=${seconds}`;
    };

    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Bypass cache for explicit live-refresh requests (development only in production)
        if (shouldHonorFreshCacheBypass(req) || shouldHonorPullCacheBypass(req)) {
            return next();
        }

        // Skip if skip function returns true
        if (skip && skip(req)) {
            return next();
        }

        let cached: CacheEntry | null = null;
        try {
            cached = await responseCache.get(req, sharedCache);
        } catch (err) {
            logger.warn('responseCache.get failed; continuing without cache', {
                path: req.path,
                message: err instanceof Error ? err.message : String(err),
            });
        }
        if (cached) {
            // Check ETag
            const ifNoneMatch = req.headers['if-none-match'];
            const age = Date.now() - (cached.timestamp || 0);
            if (ifNoneMatch === cached.etag || ifNoneMatch === `"${cached.etag}"` || ifNoneMatch === `W/"${cached.etag}"`) {
                res.setHeader('Cache-Control', cacheControl(cached.ttl || 0, age));
                res.status(304).end();
                return;
            }

            // Return cached data
            res.setHeader('ETag', `"${cached.etag}"`);
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Cache-Control', cacheControl(cached.ttl || 0, age));
            return sendCacheEntry(res, cached);
        }

        // Cache miss: register a fill so concurrent requests can wait instead of stampeding downstream.
        const isLeader = responseCache.beginFill(req, sharedCache);
        if (!isLeader) {
            let filled: CacheEntry | null = null;
            try {
                filled = await responseCache.get(req, sharedCache);
            } catch (err) {
                logger.warn('responseCache.get (follower) failed; proceeding uncached', {
                    path: req.path,
                    message: err instanceof Error ? err.message : String(err),
                });
            }
            if (filled) {
                res.setHeader('ETag', `"${filled.etag}"`);
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Cache-Control', cacheControl(filled.ttl || 0, Date.now() - (filled.timestamp || 0)));
                return sendCacheEntry(res, filled);
            }
            // If still not available (timeout), proceed normally.
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json to cache response
        res.json = function (body: any) {
            // IMPORTANT: Never cache error responses.
            // Caching 4xx/5xx (or non-success payloads) can lock clients into retry loops.
            // Accept both response shapes used in this codebase:
            //   { status: 'SUCCESS', data: ... }  (primary)
            //   { success: true, data: ... }     (predictions/legacy)
            const isStatusSuccess = body?.status === 'SUCCESS';
            const isSuccessFlag = body?.success === true;
            // Degraded = fallback payload after an upstream/DB failure; sharing it
            // would serve the outage to every user for the TTL.
            const shouldCache = res.statusCode >= 200 &&
                res.statusCode < 300 &&
                (isStatusSuccess || isSuccessFlag) &&
                body?.degraded !== true;

            // Cap cache lifetime for empty payloads so a transient backend
            // outage (e.g. API quota exhausted → empty list) doesn't freeze
            // the UI showing "No matches" for the full TTL.
            const isEmptyPayload = (() => {
                const data = body?.data ?? body?.response;
                if (Array.isArray(data)) return data.length === 0;
                if (data && typeof data === 'object' && 'results' in body) {
                    return body.results === 0;
                }
                return false;
            })();
            const effectiveTtl = isEmptyPayload
                ? Math.min(ttl ?? 5 * 60 * 1000, 20 * 1000) // 20s cap for empty
                : ttl;

            if (shouldCache) {
                // P1-4: compute ETag + set headers BEFORE sending the body.
                // Redis write stays async/non-blocking.
                // Serialize once: ETag, L1 body and the wire payload share it.
                let precomputed: { etag: string; body: string } | undefined;
                try {
                    const serialized = JSON.stringify(body);
                    precomputed = {
                        etag: crypto.createHash('md5').update(serialized).digest('hex'),
                        body: serialized,
                    };
                } catch {
                    precomputed = undefined;
                }
                const etag = precomputed?.etag ?? responseCache.generateETag(body);
                const maxAge = effectiveTtl ?? 5 * 60 * 1000;
                res.setHeader('ETag', `"${etag}"`);
                res.setHeader('X-Cache', isEmptyPayload ? 'MISS-EMPTY' : 'MISS');
                res.setHeader('Cache-Control', cacheControl(maxAge, 0));
                responseCache.set(req, body, effectiveTtl, sharedCache, precomputed).catch(() => {
                    responseCache.failFill(req, new Error('CACHE_SET_FAILED'), sharedCache);
                });
                if (precomputed) {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.send(precomputed.body);
                }
            } else {
                // Release waiters for this key if leader request ended with non-cacheable response.
                responseCache.failFill(req, new Error('RESPONSE_NOT_CACHEABLE'), sharedCache);
                res.setHeader('X-Cache', 'SKIP');
            }
            return originalJson(body);
        };

        next();
    };
}

/**
 * Clear cache helper
 */
export async function clearResponseCache(pattern?: string): Promise<void> {
    await responseCache.clear(pattern);
}

export function getResponseCacheMemorySize(): number {
    return responseCache.size();
}

/** Expose for tests and sync ETag computation on MISS. */
export { responseCache };

export default responseCacheMiddleware;

