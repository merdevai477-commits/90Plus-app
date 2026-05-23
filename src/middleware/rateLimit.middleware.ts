/**
 * Rate Limiting Middleware
 * 
 * Implements rate limiting for API endpoints to prevent abuse
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import crypto from 'crypto';
import RedisStore from 'rate-limit-redis';
import { getRedisClient, isRedisConnected } from '../lib/redis';

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

function getBearerToken(req: Request): string | null {
    const auth = req.headers['authorization'];
    const raw = Array.isArray(auth) ? auth[0] : auth;
    if (!raw) return null;
    const m = raw.match(/^Bearer\s+(.+)$/i);
    return m?.[1]?.trim() || null;
}

function tokenKey(token: string): string {
    // Hash token to avoid storing/logging raw tokens.
    const hash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    return `token:${hash}`;
}

/**
 * Normalized path under /api for skip rules.
 * Express sometimes exposes `req.path` as mount-relative or full; combining baseUrl + path
 * and stripping /api avoids misses that re-apply the strict general limiter.
 */
function apiRelativePath(req: Request): string {
    const joined = `${req.baseUrl || ''}${req.path || ''}`.split('?')[0] || '/';
    const pathname = joined.startsWith('/') ? joined : `/${joined}`;
    if (pathname === '/api' || pathname.startsWith('/api/')) {
        const rest = pathname.length > 4 ? pathname.slice(4) : '/';
        return rest.startsWith('/') ? rest : `/${rest}`;
    }
    return pathname;
}

function rateLimitKey(req: Request): string {
    // Prefer authenticated userId if already present (some routes may have auth earlier).
    const userId = (req as any).auth?.userId;
    if (userId) return `user:${userId}`;

    // Otherwise, fall back to bearer token hash to avoid grouping all mobile users behind one proxy IP.
    const token = getBearerToken(req);
    if (token) return tokenKey(token);

    // Finally, fall back to IP.
    return getClientIp(req);
}

function isSkippablePath(req: Request): boolean {
    const p = apiRelativePath(req);
    // Don't rate limit preflight and obvious health/metrics endpoints.
    if (req.method === 'OPTIONS') return true;
    if (p === '/health' || p === '/metrics' || p === '/csrf-token') return true;
    // Socket.IO lives outside /api in this app, but keep it safe if proxied under /api.
    if (p.startsWith('/socket.io')) return true;
    return false;
}

function getRedisRateLimitStore(): RedisStore | undefined {
    try {
        if (!isRedisConnected()) return undefined;
        const redis = getRedisClient();
        if (!redis) return undefined;

        return new RedisStore({
            sendCommand: (...args: string[]) => (redis as any).call(...args),
        });
    } catch {
        return undefined;
    }
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
    store: getRedisRateLimitStore(),
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 10000 : 3000, // 10000 prod (raised from 5000), 3000 dev
    message: {
        status: 'ERROR',
        message: 'Too many requests, please try again later',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        // These endpoints are intentionally high-frequency and have their own limiter.
        const p = apiRelativePath(req);
        if (p.startsWith('/football/fixtures/live')) return true;
        if (p.startsWith('/notifications')) return true;
        if (p.startsWith('/reels/rankings')) return true;
        if (p.startsWith('/daily-spin')) return true;
        // All prediction GETs are polled from multiple screens — use lenientShellLimiter only.
        if (req.method === 'GET' && p.startsWith('/predictions')) return true;
        // User-sync endpoints have their own per-route limiters.
        if (p.startsWith('/clerk/me')) return true;
        if (p.startsWith('/clerk/stats')) return true;
        if (p.startsWith('/clerk/user/')) return true;
        if (p.startsWith('/coins/balance')) return true;
        if (p.startsWith('/profile/completion')) return true;
        if (p.startsWith('/profile/me')) return true;
        if (p.startsWith('/profile/analytics')) return true;
        if (p.startsWith('/profile/cooldowns')) return true;
        return false;
    },
    // Use keyGenerator to group by user ID if authenticated, otherwise by IP
    keyGenerator: (req: Request) => {
        return rateLimitKey(req);
    },
});

const lenientWindowMs =
    process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000;
const lenientMax =
    process.env.NODE_ENV === 'production' ? 10000 : 5000;

/**
 * Lenient buckets for high-frequency reads. Separate identifiers so predictions/spin/quiz
 * traffic cannot starve feed/notifications/rankings (and vice versa).
 */
function createLenientLimiter(policyId: string) {
    return rateLimit({
        store: getRedisRateLimitStore(),
        windowMs: lenientWindowMs,
        max: lenientMax,
        identifier: policyId,
        message: {
            status: 'ERROR',
            message: 'Too many requests, please try again later',
            retryAfter:
                process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
        },
        standardHeaders: true,
        legacyHeaders: false,
        passOnStoreError: true,
        skip: (req: Request, res: Response) => {
            if (skipRateLimitForTrusted(req, res)) return true;
            if (isSkippablePath(req)) return true;
            return false;
        },
        keyGenerator: (req: Request) => rateLimitKey(req),
    });
}

/** Feed-style endpoints (live fixtures, notifications list, rankings) */
export const lenientLimiter = createLenientLimiter('lenient-feed-and-rankings');

/** Home shell reads: predictions (all GET routes), daily spin, quiz status */
export const lenientShellLimiter = createLenientLimiter('lenient-home-shell-reads');

/** Dedicated bucket for prediction reads so spin/quiz cannot starve match polling */
export const lenientPredictionsReadLimiter = createLenientLimiter('lenient-predictions-reads');

/**
 * Write rate limiter for write operations (like, comment, follow)
 * 500 requests per 15 minutes
 */
export const writeLimiter = rateLimit({
    store: getRedisRateLimitStore(),
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 500 : 200, // 500 prod, 200 dev
    message: {
        status: 'ERROR',
        message: 'Too many write requests, please try again later',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        return false;
    },
    keyGenerator: (req: Request) => {
        return rateLimitKey(req);
    },
});

/**
 * Auth endpoints rate limiter
 * 5 requests per minute (stricter for auth)
 */
export const authLimiter = rateLimit({
    store: getRedisRateLimitStore(),
    windowMs: 60 * 1000, // 1 minute
    max: 5, // limit each IP to 5 requests per minute
    message: {
        status: 'ERROR',
        message: 'Too many authentication attempts, please try again later',
        retryAfter: '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
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
    store: getRedisRateLimitStore(),
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    message: {
        status: 'ERROR',
        message: 'Too many webhook requests',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
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
    store: getRedisRateLimitStore(),
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 50 : 20, // 50 prod (was 3/min), 20 dev
    message: {
        status: 'ERROR',
        message: 'Rate limit exceeded for this sensitive operation',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    skip: (req: Request, res: Response) => {
        if (skipRateLimitForTrusted(req, res)) return true;
        if (isSkippablePath(req)) return true;
        return false;
    },
});

const userSyncWindowMs =
    process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000;
const userSyncMaxPerRoute =
    process.env.NODE_ENV === 'production' ? 2000 : 5000;

/**
 * Per-route user sync limiters. Never reuse one `rateLimit()` instance on multiple URL prefixes:
 * Express would share a single hit counter across all of them and trigger 429s across the app.
 * Each call here is a separate quota bucket (same user can hit /clerk/me and /coins/balance
 * independently).
 */
function createUserSyncLimiter(policyId: string) {
    return rateLimit({
        store: getRedisRateLimitStore(),
        windowMs: userSyncWindowMs,
        max: userSyncMaxPerRoute,
        identifier: policyId,
        message: {
            status: 'ERROR',
            message: 'Too many requests, please try again later',
            retryAfter:
                process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
        },
        standardHeaders: true,
        legacyHeaders: false,
        passOnStoreError: true,
        skip: (req: Request, res: Response) => {
            if (skipRateLimitForTrusted(req, res)) return true;
            if (isSkippablePath(req)) return true;
            return false;
        },
        keyGenerator: (req: Request) => rateLimitKey(req),
    });
}

export const userSyncLimiterClerkMe = createUserSyncLimiter('user-sync-clerk-me');
export const userSyncLimiterClerkStats = createUserSyncLimiter('user-sync-clerk-stats');
export const userSyncLimiterCoinsBalance = createUserSyncLimiter('user-sync-coins-balance');
export const userSyncLimiterProfileCompletion = createUserSyncLimiter(
    'user-sync-profile-completion'
);

/** @deprecated Prefer userSyncLimiterClerkMe; kept for clerk-user.routes imports */
export const userSyncLimiter = userSyncLimiterClerkMe;

export default {
    generalLimiter,
    lenientLimiter,
    lenientShellLimiter,
    lenientPredictionsReadLimiter,
    writeLimiter,
    authLimiter,
    webhookLimiter,
    strictLimiter,
    userSyncLimiter,
    userSyncLimiterClerkMe,
    userSyncLimiterClerkStats,
    userSyncLimiterCoinsBalance,
    userSyncLimiterProfileCompletion,
    skipRateLimitForTrusted,
};
