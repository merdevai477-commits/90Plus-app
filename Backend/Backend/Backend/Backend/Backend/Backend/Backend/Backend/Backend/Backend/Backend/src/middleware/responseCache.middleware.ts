/**
 * Response Caching Middleware
 * 
 * In-memory cache for GET requests to reduce database/API calls.
 * Uses ETag for conditional requests (304 Not Modified).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redisCacheService } from '../services/redis-cache.service';

interface CacheEntry {
    data: any;
    etag: string;
    timestamp: number;
    ttl: number;
}

class ResponseCache {
    private memoryCache = new Map<string, CacheEntry>(); // Fallback in-memory cache
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

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

        // Check cache (async)
        const cached = await responseCache.get(req);
        if (cached) {
            // Check ETag
            const ifNoneMatch = req.headers['if-none-match'];
            if (ifNoneMatch === cached.etag || ifNoneMatch === `"${cached.etag}"` || ifNoneMatch === `W/"${cached.etag}"`) {
                res.status(304).end();
                return;
            }

            // Return cached data
            res.setHeader('ETag', `"${cached.etag}"`);
            res.setHeader('X-Cache', 'HIT');
            return res.json(cached.data);
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json to cache response
        res.json = function (body: any) {
            // Cache asynchronously without blocking response
            responseCache.set(req, body, ttl).then((etag) => {
                res.setHeader('ETag', `"${etag}"`);
                res.setHeader('X-Cache', 'MISS');
            }).catch(() => {
                // Ignore cache errors, don't block response
            });
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

export default responseCacheMiddleware;

