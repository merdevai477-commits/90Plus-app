/**
 * Response Caching Middleware
 * 
 * In-memory cache for GET requests to reduce database/API calls.
 * Uses ETag for conditional requests (304 Not Modified).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redisCacheService } from '../services/redis-cache.service';
import { logger } from '../utils/logger';
import { shouldHonorFreshCacheBypass } from '../utils/cache-bypass.util';
import { resolveAppLanguage } from '../utils/app-language.util';

interface CacheEntry {
    data: any;
    etag: string;
    timestamp: number;
    ttl: number;
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
     * Generate ETag from data
     */
    private generateETag(data: any): string {
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
                this.putMemory(key, cached);
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
                        setTimeout(() => reject(new Error('PENDING_TIMEOUT')), 15_000),
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
        }, 15000).unref?.();

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
    async set(req: Request, data: any, ttl?: number, sharedCache = false): Promise<string> {
        const key = this.getCacheKey(req, sharedCache);
        const etag = this.generateETag(data);
        const entry: CacheEntry = {
            data,
            etag,
            timestamp: Date.now(),
            ttl: ttl || this.DEFAULT_TTL,
        };

        // Store in Redis
        const redisKey = `response:${key}`;
        await redisCacheService.set(redisKey, entry, entry.ttl);

        // L1 only for modest payloads — huge calendars must not fill process RAM.
        let approxBytes = 0;
        try {
            approxBytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
        } catch {
            approxBytes = this.MAX_ENTRY_BYTES + 1;
        }
        if (approxBytes <= this.MAX_ENTRY_BYTES) {
            this.putMemory(key, entry);
        }

        // Resolve any waiters.
        this.endFill(req, entry, sharedCache);

        return etag;
    }

    /**
     * Clear cache for a specific path pattern
     */
    async clear(pattern?: string): Promise<void> {
        if (!pattern) {
            // Clear all response cache
            await redisCacheService.delPattern('response:*');
            this.memoryCache.clear();
            return;
        }

        // Clear Redis cache matching pattern
        await redisCacheService.delPattern(`response:*${pattern}*`);

        // Clear memory cache matching pattern
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
} = {}) {
    const { ttl, skip, sharedCache = false } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Bypass cache for explicit live-refresh requests (development only in production)
        if (shouldHonorFreshCacheBypass(req)) {
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
            if (ifNoneMatch === cached.etag || ifNoneMatch === `"${cached.etag}"` || ifNoneMatch === `W/"${cached.etag}"`) {
                res.setHeader('Cache-Control', `${sharedCache ? 'public' : 'private'}, max-age=${Math.floor((cached.ttl || 0) / 1000)}`);
                res.status(304).end();
                return;
            }

            // Return cached data
            res.setHeader('ETag', `"${cached.etag}"`);
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Cache-Control', `${sharedCache ? 'public' : 'private'}, max-age=${Math.floor((cached.ttl || 0) / 1000)}`);
            return res.json(cached.data);
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
                res.setHeader('Cache-Control', `private, max-age=${Math.floor((filled.ttl || 0) / 1000)}`);
                return res.json(filled.data);
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
            const shouldCache = res.statusCode >= 200 &&
                res.statusCode < 300 &&
                (isStatusSuccess || isSuccessFlag);

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
                // Cache asynchronously without blocking response
                responseCache.set(req, body, effectiveTtl, sharedCache).then((etag) => {
                    res.setHeader('ETag', `"${etag}"`);
                    res.setHeader('X-Cache', isEmptyPayload ? 'MISS-EMPTY' : 'MISS');
                    const maxAge = effectiveTtl ?? 5 * 60 * 1000;
                    res.setHeader('Cache-Control', `${sharedCache ? 'public' : 'private'}, max-age=${Math.floor(maxAge / 1000)}`);
                }).catch(() => {
                    // Ignore cache errors, don't block response
                    responseCache.failFill(req, new Error('CACHE_SET_FAILED'), sharedCache);
                });
            } else {
                // Release waiters for this key if leader request ended with non-cacheable response.
                responseCache.failFill(req, new Error('RESPONSE_NOT_CACHEABLE'), sharedCache);
                res.setHeader('X-Cache', 'SKIP');
            }
            return originalJson(body);
        };

        res.on('close', () => {
            // If the connection drops before we cache anything, release waiters.
            responseCache.failFill(req, new Error('RESPONSE_CLOSED'), sharedCache);
        });

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

export default responseCacheMiddleware;

