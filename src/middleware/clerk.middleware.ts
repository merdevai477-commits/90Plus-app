import { Request, Response, NextFunction } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { logger } from '../utils/logger';
import { AuditService, AuditAction } from '../services/audit.service';
import { TokenRevocationService } from '../services/token-revocation.service';
import { AbuseDetectionService } from '../services/abuse-detection.service';

// Extend Express Request to include auth.
//
// In @clerk/express v2, `clerkMiddleware()` (registered globally in main.ts)
// installs a `req.auth()` function that you read via `getAuth(req)`. Our own
// `requireAuth` middleware reads that, validates the user, and then attaches
// an enriched object to the same `req.auth` slot for the rest of the route
// to use. The downstream code reads `req.auth?.userId` — that keeps working
// because objects ignore the call signature.
declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId: string;
                sessionId: string;
                sessionClaims?: any;
            } & any;
            /** Same shape as `req.auth` — kept as an alias for code that
             *  prefers the unambiguous name. */
            authContext?: {
                userId: string;
                sessionId: string;
                sessionClaims?: any;
            };
        }
    }
}

// Simple in-memory cache for verified users to prevent Clerk API rate limiting
interface CachedUser {
    userId: string;
    verifiedAt: number;
}

const userCache = new Map<string, CachedUser>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
// Fix NEW-MEM-1: cap the in-memory user cache to prevent unbounded growth
const MAX_USER_CACHE = 500;

/**
 * Get cached user or verify with Clerk API
 */
async function getVerifiedUser(userId: string): Promise<boolean> {
    const cached = userCache.get(userId);
    const now = Date.now();

    // Return cached result if still valid
    if (cached && (now - cached.verifiedAt) < CACHE_TTL_MS) {
        return true;
    }

    // Verify with Clerk API
    try {
        const user = await clerkClient.users.getUser(userId);
        if (user && user.id) {
            // Evict oldest entry if cache is at capacity
            if (userCache.size >= MAX_USER_CACHE) {
                const oldestKey = userCache.keys().next().value;
                if (oldestKey !== undefined) userCache.delete(oldestKey);
            }
            userCache.set(userId, { userId: user.id, verifiedAt: now });
            return true;
        }
        return false;
    } catch (error: any) {
        // If rate limited but user was previously verified, extend cache
        if (error.status === 429 && cached) {
            cached.verifiedAt = now; // Extend cache on rate limit
            return true;
        }        // Session JWT was already validated by @clerk/express above. A failing
        // users.getUser (rate limits, outages, network) must not turn every
        // protected route into HTTP 500 — that breaks /clerk/me, profile, reels, etc.
        logger.warn('[requireAuth] Clerk users.getUser failed; trusting validated session', {
            userId,
            status: error?.status,
            message: error?.message,
        });
        return true;
    }
}

// ✅ DRAGON FIX: Clean up old cache entries with error protection
const cacheCleanupInterval = setInterval(() => {
    try {
        const now = Date.now();
        let deletedCount = 0;
        for (const [key, value] of userCache.entries()) {
            if (now - value.verifiedAt > CACHE_TTL_MS * 2) {
                userCache.delete(key);
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            logger.debug(`🧹 Cleaned ${deletedCount} expired cache entries`);
        }
    } catch (error) {
        logger.error('Cache cleanup error (recovered):', error);
    }
}, 60 * 1000); // Clean every minute

// ✅ DRAGON FIX: Cleanup on process termination
process.on('SIGTERM', () => {
    clearInterval(cacheCleanupInterval);
    userCache.clear();
});

/**
 * Clerk Authentication Middleware
 *
 * In @clerk/express v2 the framework's own `requireAuth()` middleware reads
 * `req.auth` as a function (set by `clerkMiddleware()`). The previous version
 * of this file overwrote `req.auth` with a plain object (`{ userId, ... }`)
 * AFTER calling Clerk's `requireAuth`, which broke any subsequent middleware
 * in the chain that read `req.auth()` again — producing the
 * `TypeError: request.auth is not a function` we saw on Railway.
 *
 * Fix: do the validation inline using `getAuth(req)` (which is safe to call
 * many times) and stash our enriched user info on `req.auth` after the
 * Clerk-level chain has finished. Downstream code keeps reading
 * `req.auth?.userId` exactly like before — the type augmentation below makes
 * the property a hybrid (function-callable from Clerk + object-indexable
 * from us) so both worlds work.
 */
export const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const startTime = Date.now();
    try {
        // `clerkMiddleware()` is registered globally in main.ts, so
        // `getAuth(req)` is always callable here.
        let auth: ReturnType<typeof getAuth>;
        try {
            auth = getAuth(req);
        } catch (err: any) {
            logger.warn('requireAuth - getAuth threw, treating as unauthorized', {
                err: err?.message,
                path: req.path,
            });
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - Invalid token',
            });
            return;
        }

        const userId = auth.userId;
        const sessionId = auth.sessionId || '';
        const sessionClaims = (auth as any).sessionClaims;

        if (!userId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - Invalid token',
            });
            return;
        }

        // ✅ ENTERPRISE IMMUNITY: Check if token is revoked
        const token = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.substring(7)
            : null;
        if (token && TokenRevocationService.isTokenRevoked(token)) {
            const revokedInfo = TokenRevocationService.getRevokedTokenInfo(token);
            logger.warn('requireAuth middleware - Token revoked', {
                path: req.path,
                reason: revokedInfo?.reason,
            });
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - Token has been revoked',
                code: 'TOKEN_REVOKED',
            });
            return;
        }

        logger.debug('requireAuth middleware - Token verified', {
            userId,
            path: req.path,
            method: req.method,
        });

        // ✅ ENTERPRISE IMMUNITY: Check if user is blocked for abuse
        if (AbuseDetectionService.isUserBlocked(userId)) {
            logger.warn('requireAuth middleware - User blocked for abuse', {
                userId,
                path: req.path,
            });
            res.status(429).json({
                status: 'ERROR',
                message: 'Too many requests - Please try again later',
                code: 'USER_BLOCKED',
            });
            return;
        }

        // ✅ ENTERPRISE IMMUNITY: Check if IP is blocked
        const clientIP = req.ip || 'unknown';
        if (AbuseDetectionService.isIPBlocked(clientIP)) {
            logger.warn('requireAuth middleware - IP blocked for abuse', {
                ip: clientIP,
                path: req.path,
            });
            res.status(429).json({
                status: 'ERROR',
                message: 'Too many requests - Please try again later',
                code: 'IP_BLOCKED',
            });
            return;
        }

        // ✅ ENTERPRISE IMMUNITY: Track request (reads vs writes — startup is read-heavy)
        const isRead = req.method === 'GET' || req.method === 'HEAD';
        const allowed = AbuseDetectionService.trackUserRequest(userId, undefined, isRead);
        if (!allowed) {
            res.status(429).json({
                status: 'ERROR',
                message: 'Too many requests - Please slow down',
                code: 'RATE_LIMIT_EXCEEDED',
            });
            return;
        }

        if (!isRead) {
            const ipAllowed = AbuseDetectionService.trackIPRequest(clientIP, undefined, false);
            if (!ipAllowed) {
                res.status(429).json({
                    status: 'ERROR',
                    message: 'Too many requests - Please slow down',
                    code: 'RATE_LIMIT_EXCEEDED',
                });
                return;
            }
        }

        // Optional: Verify user exists in Clerk (with caching) for extra security
        const userExists = await getVerifiedUser(userId);
        if (!userExists) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - User not found',
            });
            return;
        }

        // ✅ APPLE COMPLIANCE: Check if user is banned (Guideline 1.2)
        try {
            const prisma = (await import('../lib/prisma')).default;
            const user = await prisma.user.findUnique({
                where: { clerkUserId: userId },
                select: { isBanned: true, banReason: true },
            });

            if (user?.isBanned) {
                logger.warn('requireAuth middleware - User is banned', {
                    userId,
                    path: req.path,
                });
                res.status(403).json({
                    status: 'ERROR',
                    message: 'Your account has been suspended for violating community guidelines.',
                    code: 'ACCOUNT_BANNED',
                    reason: user.banReason || 'Violation of community guidelines',
                });
                return;
            }
        } catch (dbError: any) {
            logger.error('Error checking banned status:', dbError);
            // Continue if DB check fails - don't block legitimate users
        }

        // Stash our enriched info on req.authContext (for new code) AND on
        // req.auth (for existing routes that read req.auth?.userId). After
        // this point, the rest of the request pipeline doesn't need Clerk's
        // function form — `getAuth(req)` is still available if a downstream
        // middleware calls it.
        const authInfo = {
            userId,
            sessionId,
            sessionClaims,
        };
        req.authContext = authInfo;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).auth = authInfo;

        const duration = Date.now() - startTime;
        logger.debug('requireAuth middleware - Authentication successful', {
            userId,
            path: req.path,
            duration: `${duration}ms`,
        });

        // Log successful authentication (non-blocking)
        AuditService.logAuth({
            action: AuditAction.LOGIN,
            userId,
            req,
            metadata: {
                path: req.path,
                method: req.method,
                duration: `${duration}ms`,
            },
        }).catch(err => logger.error('Audit log error:', err));

        next();
    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('Auth middleware error', {
            error: error.message,
            stack: error.stack,
            path: req.path,
            method: req.method,
            originalUrl: req.originalUrl,
            duration: `${duration}ms`,
        });
        res.status(500).json({
            status: 'ERROR',
            message: 'Internal server error',
        });
    }
};

/**
 * Optional Auth Middleware
 *
 * Tries to authenticate but doesn't fail if no token is present. Same
 * approach as `requireAuth`: read `getAuth(req)` (populated by the global
 * `clerkMiddleware()`), and if a userId is present, attach our enriched
 * shape to `req.auth` / `req.authContext`.
 */
export const optionalAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        let auth: ReturnType<typeof getAuth> | null = null;
        try {
            auth = getAuth(req);
        } catch {
            // No clerk context on this request — treat as anonymous.
            next();
            return;
        }

        if (!auth?.userId) {
            next();
            return;
        }

        const userExists = await getVerifiedUser(auth.userId);
        if (userExists) {
            const authInfo = {
                userId: auth.userId,
                sessionId: auth.sessionId || '',
                sessionClaims: (auth as any).sessionClaims,
            };
            req.authContext = authInfo;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (req as any).auth = authInfo;
        }
        next();
    } catch (error) {
        logger.error('Optional auth middleware error:', error);
        next();
    }
};
