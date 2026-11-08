import crypto from 'crypto';
import type { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { getRedisRateLimitStore } from './rateLimit.middleware';

type LimiterStore = ReturnType<typeof getRedisRateLimitStore>;

/**
 * Redis connects after routes are registered, so the Redis-backed limiter is
 * built on the first request that finds Redis connected; until then a memory
 * limiter applies.
 */
export function lazyRateLimiter(prefix: string, build: (store: LimiterStore) => RequestHandler): RequestHandler {
    let memoryLimiter: RequestHandler | null = null;
    let redisLimiter: RequestHandler | null = null;
    return (req, res, next) => {
        if (!redisLimiter) {
            const store = getRedisRateLimitStore(prefix);
            if (store) redisLimiter = build(store);
        }
        const limiter = redisLimiter ?? (memoryLimiter ??= build(undefined));
        return limiter(req, res, next);
    };
}

export function hashRateLimitKey(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function perMinuteLimiter(
    prefix: string,
    limit: () => number,
    keyGenerator: (req: Request) => string,
): RequestHandler {
    return lazyRateLimiter(prefix, (store) =>
        rateLimit({
            windowMs: 60 * 1000,
            limit: limit(),
            standardHeaders: true,
            legacyHeaders: false,
            passOnStoreError: true,
            validate: { creationStack: false },
            keyGenerator,
            message: { error: 'rate_limited' },
            ...(store ? { store } : {}),
        }),
    );
}

export const clientIpKey = (req: Request): string => `ip:${req.ip ?? 'unknown'}`;
