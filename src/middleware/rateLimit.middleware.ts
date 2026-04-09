/**
 * Rate Limiting Middleware
 * 
 * Implements rate limiting for API endpoints to prevent abuse
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

function getClientIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    const raw =
        (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim() ||
        req.headers['x-real-ip']?.toString()?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        '';
    return raw || 'unknown';
}

function isSkippablePath(req: Request): boolean {
    const path = req.path || '';
    // Don't rate limit preflight and obvious health/metrics endpoints.
    if (req.method === 'OPTIONS') return true;
    if (path === '/health' || path === '/metrics' || path === '/csrf-token') return true;
    // Socket.IO lives outside /api in this app, but keep it safe if proxied under /api.
    if (path.startsWith('/socket.io')) return true;
    return false;
}

/**
 * Skip rate limiting for certain conditions
 * Must be defined before use in rate limiters
 */
export const skipRateLimitForTrusted = (req: Request, _res: Response): boolean => {
    // Skip for internal requests or trusted IPs
    const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
    const clientIP = getClientIp(req);

    return trustedIPs.includes(clientIP);
};

/**
 * General API rate limiter
 * Increased limits to handle normal app usage
 * 5000 requests per 15 minutes in production, 2000 per minute in development
 */
export const generalLimiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 5000 : 2000, // 5000 prod (was 2000), 2000 dev
    message: {
        status: 'ERROR',
        message: 'Too many requests, please try again later',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        // These endpoints are intentionally high-frequency and have their own limiter.
        const p = req.path || '';
        if (p.startsWith('/football/fixtures/live')) return true;
        if (p.startsWith('/notifications')) return true;
        if (p.startsWith('/reels/rankings')) return true;
        return false;
    },
    // Use keyGenerator to group by user ID if authenticated, otherwise by IP
    keyGenerator: (req: Request) => {
        // If user is authenticated, use their ID to allow more requests per user
        const userId = (req as any).auth?.userId;
        return userId ? `user:${userId}` : getClientIp(req);
    },
});

/**
 * Lenient rate limiter for high-frequency endpoints
 * 10000 requests per 15 minutes in production for endpoints like feed, rankings, live matches
 */
export const lenientLimiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 10000 : 5000, // 10000 prod (was 5000), 5000 dev
    message: {
        status: 'ERROR',
        message: 'Too many requests, please try again later',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        return false;
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).auth?.userId;
        return userId ? `user:${userId}` : getClientIp(req);
    },
});

/**
 * Write rate limiter for write operations (like, comment, follow)
 * 500 requests per 15 minutes
 */
export const writeLimiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 500 : 200, // 500 prod, 200 dev
    message: {
        status: 'ERROR',
        message: 'Too many write requests, please try again later',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        return false;
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).auth?.userId;
        return userId ? `user:${userId}` : getClientIp(req);
    },
});

/**
 * Auth endpoints rate limiter
 * 5 requests per minute (stricter for auth)
 */
export const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // limit each IP to 5 requests per minute
    message: {
        status: 'ERROR',
        message: 'Too many authentication attempts, please try again later',
        retryAfter: '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        return false;
    },
});

/**
 * Webhook rate limiter
 * 50 requests per minute (Clerk may send bursts)
 */
export const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    message: {
        status: 'ERROR',
        message: 'Too many webhook requests',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        // Never skip based on path here; webhooks route already scoped.
        return false;
    },
});

/**
 * Strict rate limiter for sensitive operations (delete, report)
 * 50 requests per 15 minutes (more reasonable than 3/min)
 */
export const strictLimiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 50 : 20, // 50 prod (was 3/min), 20 dev
    message: {
        status: 'ERROR',
        message: 'Rate limit exceeded for this sensitive operation',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        return false;
    },
});

/**
 * User sync rate limiter (for /clerk/me endpoint)
 * More lenient than general limiter since this is called frequently during app usage
 * 500 requests per 15 minutes in production, 2000 per minute in development
 */
export const userSyncLimiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 500 : 2000, // 500 prod (was 200), 2000 dev
    message: {
        status: 'ERROR',
        message: 'Too many requests, please try again later',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        return false;
    },
    // Use user ID for key generation
    keyGenerator: (req: Request) => {
        const userId = (req as any).auth?.userId;
        return userId ? `user:${userId}` : getClientIp(req);
    },
});

export default {
    generalLimiter,
    lenientLimiter,
    writeLimiter,
    authLimiter,
    webhookLimiter,
    strictLimiter,
    userSyncLimiter,
    skipRateLimitForTrusted,
};
