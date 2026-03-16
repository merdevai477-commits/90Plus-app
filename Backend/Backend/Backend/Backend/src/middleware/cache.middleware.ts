/**
 * Cache Headers Middleware
 * 
 * Adds appropriate cache headers (Cache-Control, ETag, Last-Modified)
 * to responses based on data type and freshness requirements.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface CacheOptions {
    maxAge?: number; // in seconds
    staleWhileRevalidate?: number; // in seconds
    mustRevalidate?: boolean;
    private?: boolean;
    public?: boolean;
}

/**
 * Generate ETag from response data
 */
function generateETag(data: any): string {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Check if request has matching ETag (304 Not Modified)
 */
function checkETag(req: Request, res: Response, etag: string): boolean {
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag || ifNoneMatch === `"${etag}"` || ifNoneMatch === `W/"${etag}"`) {
        res.status(304).end();
        return true;
    }
    return false;
}

/**
 * Create cache headers middleware
 */
export function cacheHeaders(options: CacheOptions = {}) {
    const {
        maxAge = 300, // 5 minutes default
        staleWhileRevalidate = 60, // 1 minute
        mustRevalidate = false,
        private: isPrivate = false,
        public: isPublic = true,
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to add cache headers
        res.json = function (body: any) {
            // Generate ETag
            const etag = generateETag(body);
            res.setHeader('ETag', `"${etag}"`);

            // Check if client has cached version
            if (checkETag(req, res, etag)) {
                return res;
            }

            // Set cache control headers
            const cacheControl: string[] = [];
            
            if (isPublic) {
                cacheControl.push('public');
            } else if (isPrivate) {
                cacheControl.push('private');
            }

            cacheControl.push(`max-age=${maxAge}`);
            
            if (staleWhileRevalidate > 0) {
                cacheControl.push(`stale-while-revalidate=${staleWhileRevalidate}`);
            }

            if (mustRevalidate) {
                cacheControl.push('must-revalidate');
            }

            res.setHeader('Cache-Control', cacheControl.join(', '));
            res.setHeader('Last-Modified', new Date().toUTCString());

            // Call original json method
            return originalJson(body);
        };

        next();
    };
}

/**
 * Predefined cache configurations for different data types
 */
export const cacheConfigs = {
    // Static data - long cache
    static: cacheHeaders({
        maxAge: 3600, // 1 hour
        staleWhileRevalidate: 300, // 5 minutes
        public: true,
    }),

    // Matches data - medium cache
    matches: cacheHeaders({
        maxAge: 300, // 5 minutes
        staleWhileRevalidate: 60, // 1 minute
        public: true,
    }),

    // Live matches - short cache
    liveMatches: cacheHeaders({
        maxAge: 30, // 30 seconds
        staleWhileRevalidate: 10, // 10 seconds
        mustRevalidate: true,
        public: true,
    }),

    // User data - private, short cache
    userData: cacheHeaders({
        maxAge: 60, // 1 minute
        staleWhileRevalidate: 30, // 30 seconds
        private: true,
        mustRevalidate: true,
    }),

    // No cache
    noCache: cacheHeaders({
        maxAge: 0,
        mustRevalidate: true,
        private: true,
    }),
};

