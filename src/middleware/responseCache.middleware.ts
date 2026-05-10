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

interface CacheEntry {
    data: any;
    etag: string;
    timestamp: number;
    ttl: number;
}

class ResponseCache {
    private memoryCache = new Map<string, CacheEntry>(); // Fallback in-memory cache
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
    private pending = new Map<string, Promise<CacheEntry>>(); // stampede protection per key
    private pendingResolvers = new Map<string, (entry: CacheEntry) => void>();
    private pendingRejectors = new Map<string, (err: unknown) => void>();

    /**
     * Generate cache key from request
     */
    private getCacheKey(req: Request): string {
        const path = req.path;
        const query = JSON.stringify(req.query);
        const userId = (req as any).auth?.userId || 'anonymous';
        return `${path}:${query}:${userId}`;
    }

    /**
     * Generate ETag from data
     */
    private generateETag(data: any): string {
        const str = JSON.stringify(data);
        return crypto.createHash('md5').update(str).digest('hex');
    }

    /**
     * Get cached response
     */
    async get(req: Request): Promise<CacheEntry | null> {
        const key = this.getCacheKey(req);
        
        // Try Redis first
        const redisKey = `response:${key}`;
        const cached = await redisCacheService.get<CacheEntry>(redisKey);
        if (cached) {
            return cached;
        }

        // Fallback to memory cache
        const entry = this.memoryCache.get(key);
        if (!entry) {
            // If another request is already populating this key, wait briefly.
            const pending = this.pending.get(key);
            if (pending) {
                try {
                    const filled = await Promise.race([
                        pending,
                        new Promise<CacheEntry>((_, reject) => setTimeout(() => reject(new Error('PENDING_TIMEOUT')), 2000)),
                    ]);
                    return filled;
                } catch {
                    return null;
                }
            }
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.memoryCache.delete(key);
            return null;
        }

        return entry;
    }

    /**
     * Register an in-flight cache fill for stampede protection.
     * Returns false if another fill is already in progress.
     */
    beginFill(req: Request): boolean {
        const key = this.getCacheKey(req);
        if (this.pending.has(key)) return false;

        let resolveFn!: (entry: CacheEntry) => void;
        let rejectFn!: (err: unknown) => void;
        const p = new Promise<CacheEntry>((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });

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

    endFill(req: Request, entry: CacheEntry): void {
        const key = this.getCacheKey(req);
        const resolve = this.pendingResolvers.get(key);
        if (resolve) resolve(entry);
        this.pending.delete(key);
        this.pendingResolvers.delete(key);
        this.pendingRejectors.delete(key);
    }

    failFill(req: Request, err: unknown): void {
        const key = this.getCacheKey(req);
        const reject = this.pendingRejectors.get(key);
        if (reject) reject(err);
        this.pending.delete(key);
        this.pendingResolvers.delete(key);
        this.pendingRejectors.delete(key);
    }

    /**
     * Set cached response
     */
    async set(req: Request, data: any, ttl?: number): Promise<string> {
        const key = this.getCacheKey(req);
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

        // Also store in memory cache as fallback
        this.memoryCache.set(key, entry);

        // Resolve any waiters.
        this.endFill(req, entry);

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

// Clean expired entries every 5 minutes
setInterval(() => {
    responseCache.clean();
}, 5 * 60 * 1000);

/**
 * Response caching middleware
 * Only caches GET requests
 */
export function responseCacheMiddleware(options: { ttl?: number; skip?: (req: Request) => boolean } = {}) {
    const { ttl, skip } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip if skip function returns true
        if (skip && skip(req)) {
            return next();
        }

        let cached: CacheEntry | null = null;
        try {
            cached = await responseCache.get(req);
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
                res.setHeader('Cache-Control', `private, max-age=${Math.floor((cached.ttl || 0) / 1000)}`);
                res.status(304).end();
                return;
            }

            // Return cached data
            res.setHeader('ETag', `"${cached.etag}"`);
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Cache-Control', `private, max-age=${Math.floor((cached.ttl || 0) / 1000)}`);
            return res.json(cached.data);
        }

        // Cache miss: register a fill so concurrent requests can wait instead of stampeding downstream.
        const isLeader = responseCache.beginFill(req);
        if (!isLeader) {
            let filled: CacheEntry | null = null;
            try {
                filled = await responseCache.get(req);
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
                responseCache.set(req, body, effectiveTtl).then((etag) => {
                    res.setHeader('ETag', `"${etag}"`);
                    res.setHeader('X-Cache', isEmptyPayload ? 'MISS-EMPTY' : 'MISS');
                    const maxAge = effectiveTtl ?? 5 * 60 * 1000;
                    res.setHeader('Cache-Control', `private, max-age=${Math.floor(maxAge / 1000)}`);
                }).catch(() => {
                    // Ignore cache errors, don't block response
                    responseCache.failFill(req, new Error('CACHE_SET_FAILED'));
                });
            } else {
                // Release waiters for this key if leader request ended with non-cacheable response.
                responseCache.failFill(req, new Error('RESPONSE_NOT_CACHEABLE'));
                res.setHeader('X-Cache', 'SKIP');
            }
            return originalJson(body);
        };

        res.on('close', () => {
            // If the connection drops before we cache anything, release waiters.
            responseCache.failFill(req, new Error('RESPONSE_CLOSED'));
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

export default responseCacheMiddleware;

