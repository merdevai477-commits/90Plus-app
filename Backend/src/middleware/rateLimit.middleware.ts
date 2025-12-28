/**
 * Rate Limiting Middleware
 * 
 * Implements rate limiting for API endpoints to prevent abuse
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 * Increased limits to handle normal app usage
 * 1000 requests per minute in development, 500 per 15 minutes in production
 */
export const generalLimiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
    max: process.env.NODE_ENV === 'production' ? 500 : 1000, // 500 prod (was 100), 1000 dev
    message: {
        status: 'ERROR',
        message: 'Too many requests, please try again later',
        retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use keyGenerator to group by user ID if authenticated, otherwise by IP
    keyGenerator: (req: Request) => {
        // If user is authenticated, use their ID to allow more requests per user
        const userId = (req as any).auth?.userId;
        return userId ? `user:${userId}` : req.ip || 'unknown';
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
});

/**
 * Strict rate limiter for sensitive operations
 * 3 requests per minute
 */
export const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3,
    message: {
        status: 'ERROR',
        message: 'Rate limit exceeded for this sensitive operation',
        retryAfter: '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
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
    skip: skipRateLimitForTrusted,
    // Use user ID for key generation
    keyGenerator: (req: Request) => {
        const userId = (req as any).auth?.userId;
        return userId ? `user:${userId}` : req.ip || 'unknown';
    },
});

/**
 * Skip rate limiting for certain conditions
 */
export const skipRateLimitForTrusted = (req: Request, _res: Response): boolean => {
    // Skip for internal requests or trusted IPs
    const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
    const clientIP = req.ip || req.socket.remoteAddress || '';

    return trustedIPs.includes(clientIP);
};

export default {
    generalLimiter,
    authLimiter,
    webhookLimiter,
    strictLimiter,
    userSyncLimiter,
    skipRateLimitForTrusted,
};
