/**
 * Auth Rate Limiting Middleware
 * Protects authentication endpoints from brute force attacks
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import RedisStore from 'rate-limit-redis';
import { getRedisClient, isRedisConnected } from '../lib/redis';

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
 * Standard auth rate limiter
 * 5 attempts per 15 minutes
 */
export const authRateLimiter = rateLimit({
    store: getRedisRateLimitStore(),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: {
        status: 'ERROR',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    passOnStoreError: true,
    handler: (req, res) => {
        logger.warn('Auth rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        res.status(429).json({
            status: 'ERROR',
            message: 'Too many authentication attempts. Please try again in 15 minutes.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 15 * 60, // seconds
        });
    },
    skip: (req) => {
        // Skip rate limiting in development for testing
        return process.env.NODE_ENV === 'development' && req.headers['x-skip-rate-limit'] === 'true';
    },
});

/**
 * Strict auth rate limiter for sensitive operations
 * 3 attempts per 1 hour
 */
export const strictAuthRateLimiter = rateLimit({
    store: getRedisRateLimitStore(),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts
    message: {
        status: 'ERROR',
        message: 'Too many failed attempts. Account temporarily locked for 1 hour.',
        code: 'ACCOUNT_LOCKED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    handler: (req, res) => {
        logger.error('Strict auth rate limit exceeded - Account locked', {
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        res.status(429).json({
            status: 'ERROR',
            message: 'Too many failed attempts. Account temporarily locked for 1 hour.',
            code: 'ACCOUNT_LOCKED',
            retryAfter: 60 * 60, // seconds
        });
    },
    skip: (req) => {
        return process.env.NODE_ENV === 'development' && req.headers['x-skip-rate-limit'] === 'true';
    },
});

/**
 * Webhook rate limiter
 * 100 requests per minute (for Clerk webhooks)
 */
export const webhookRateLimiter = rateLimit({
    store: getRedisRateLimitStore(),
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests
    message: {
        status: 'ERROR',
        message: 'Too many webhook requests',
        code: 'WEBHOOK_RATE_LIMIT',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    skip: (req) => {
        // Skip if request has valid Svix signature
        return !!req.headers['svix-signature'];
    },
});

/**
 * Account deletion rate limiter
 * 1 attempt per 24 hours
 */
export const accountDeletionRateLimiter = rateLimit({
    store: getRedisRateLimitStore(),
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 1, // 1 attempt
    message: {
        status: 'ERROR',
        message: 'You can only request account deletion once per day.',
        code: 'DELETION_RATE_LIMIT',
    },
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    handler: (req, res) => {
        logger.warn('Account deletion rate limit exceeded', {
            userId: req.auth?.userId,
            ip: req.ip,
        });
        res.status(429).json({
            status: 'ERROR',
            message: 'You can only request account deletion once per day.',
            code: 'DELETION_RATE_LIMIT',
            retryAfter: 24 * 60 * 60,
        });
    },
});
