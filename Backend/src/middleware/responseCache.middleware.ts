/**
 * Response Caching Middleware
 * 
 * In-memory cache for GET requests to reduce database/API calls.
 * Uses ETag for conditional requests (304 Not Modified).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface CacheEntry {
    data: any;
    etag: string;
    timestamp: number;
    ttl: number;
}

class ResponseCache {
    private cache = new Map<string, CacheEntry>();
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
    get(req: Request): CacheEntry | null {
        const key = this.getCacheKey(req);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry;
    }

    /**
     * Set cached response
     */
    set(req: Request, data: any, ttl?: number): string {
        const key = this.getCacheKey(req);
        const etag = this.generateETag(data);

        this.cache.set(key, {
            data,
            etag,
            timestamp: Date.now(),
            ttl: ttl || this.DEFAULT_TTL,
        });

        return etag;
    }

    /**
     * Clear cache for a specific path pattern
     */
    clear(pattern?: string): void {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clean expired entries
     */
    clean(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
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

    return (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip if skip function returns true
        if (skip && skip(req)) {
            return next();
        }

        // Check cache
        const cached = responseCache.get(req);
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
            const etag = responseCache.set(req, body, ttl);
            res.setHeader('ETag', `"${etag}"`);
            res.setHeader('X-Cache', 'MISS');
            return originalJson(body);
        };

        next();
    };
}

/**
 * Clear cache helper
 */
export function clearResponseCache(pattern?: string): void {
    responseCache.clear(pattern);
}

export default responseCacheMiddleware;

