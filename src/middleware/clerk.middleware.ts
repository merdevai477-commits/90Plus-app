import { Request, Response, NextFunction } from 'express';
import { clerkClient, clerkMiddleware, getAuth, requireAuth as clerkRequireAuth } from '@clerk/express';
import { logger } from '../utils/logger';
import { AuditService, AuditAction } from '../services/audit.service';
import { TokenRevocationService } from '../services/token-revocation.service';
import { AbuseDetectionService } from '../services/abuse-detection.service';

// Extend Express Request to include auth
declare global {
    namespace Express {
        interface Request {
            auth?: {
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

const clerkMiddlewareMw = clerkMiddleware();
const clerkRequireAuthMw = clerkRequireAuth();

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
            userCache.set(userId, { userId: user.id, verifiedAt: now });
            return true;
        }
        return false;
    } catch (error: any) {
        // If rate limited but user was previously verified, extend cache
        if (error.status === 429 && cached) {
            cached.verifiedAt = now; // Extend cache on rate limit
            return true;
        }
        throw error;
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
 * Verifies JWT token signature and extracts user information
 */
export const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const startTime = Date.now();
    try {
        // Let @clerk/express validate the request token & populate auth
        clerkRequireAuthMw(req, res, async () => {
          const auth = getAuth(req);
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

          // ✅ ENTERPRISE IMMUNITY: Track request
          const allowed = AbuseDetectionService.trackUserRequest(userId);
          if (!allowed) {
            res.status(429).json({
              status: 'ERROR',
              message: 'Too many requests - Please slow down',
              code: 'RATE_LIMIT_EXCEEDED',
            });
            return;
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

          // Attach user info to request (keep existing shape used across backend)
          req.auth = {
            userId,
            sessionId,
            sessionClaims,
          };

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
        });
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
 * Tries to authenticate but doesn't fail if no token
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        clerkMiddlewareMw(req, res, async () => {
          const auth = getAuth(req);
          if (!auth.userId) {
            next();
            return;
          }

          const userExists = await getVerifiedUser(auth.userId);
          if (userExists) {
            req.auth = {
              userId: auth.userId,
              sessionId: auth.sessionId || '',
              sessionClaims: (auth as any).sessionClaims,
            };
          }
          next();
        });
    } catch (error) {
        logger.error('Optional auth middleware error:', error);
        next();
    }
};
