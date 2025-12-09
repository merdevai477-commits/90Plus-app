/**
 * Rate Limiting Middleware
 * 
 * Implements rate limiting for API endpoints to prevent abuse
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        status: 'ERROR',
        message: 'Too many requests, please try again later',
        retryAfter: '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
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
    skipRateLimitForTrusted,
};
