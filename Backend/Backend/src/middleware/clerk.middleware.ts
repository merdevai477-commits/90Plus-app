import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
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
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('requireAuth middleware - No token provided', {
                path: req.path,
                method: req.method,
                originalUrl: req.originalUrl,
                ip: req.ip,
            });
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - No token provided',
            });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // ✅ ENTERPRISE IMMUNITY: Check if token is revoked
        if (TokenRevocationService.isTokenRevoked(token)) {
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

        try {
            // ✅ SECURE: Verify JWT signature using Clerk SDK
            // Clerk automatically verifies the token signature using JWKS
            const verifiedToken = await clerkClient.verifyToken(token);

            if (!verifiedToken || !verifiedToken.sub) {
                logger.warn('requireAuth middleware - Invalid token', {
                    path: req.path,
                    method: req.method,
                    originalUrl: req.originalUrl,
                });
                
                // ✅ ENTERPRISE IMMUNITY: Track failed auth
                AbuseDetectionService.trackFailedAuth(null, req.ip || 'unknown');
                
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - Invalid token',
                });
                return;
            }
            
            logger.debug('requireAuth middleware - Token verified', {
                userId: verifiedToken.sub,
                path: req.path,
                method: req.method,
            });

            // ✅ ENTERPRISE IMMUNITY: Check if user is blocked for abuse
            if (AbuseDetectionService.isUserBlocked(verifiedToken.sub)) {
                logger.warn('requireAuth middleware - User blocked for abuse', {
                    userId: verifiedToken.sub,
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
            const allowed = AbuseDetectionService.trackUserRequest(verifiedToken.sub);
            if (!allowed) {
                res.status(429).json({
                    status: 'ERROR',
                    message: 'Too many requests - Please slow down',
                    code: 'RATE_LIMIT_EXCEEDED',
                });
                return;
            }

            // Optional: Verify user exists in Clerk (with caching) for extra security
            const userExists = await getVerifiedUser(verifiedToken.sub);

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
                    where: { clerkUserId: verifiedToken.sub },
                    select: { isBanned: true, banReason: true },
                });

                if (user?.isBanned) {
                    logger.warn('requireAuth middleware - User is banned', {
                        userId: verifiedToken.sub,
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

            // Attach user info to request
            req.auth = {
                userId: verifiedToken.sub,
                sessionId: verifiedToken.sid || '',
                sessionClaims: verifiedToken,
            };

            const duration = Date.now() - startTime;
            logger.debug('requireAuth middleware - Authentication successful', {
                userId: verifiedToken.sub,
                path: req.path,
                duration: `${duration}ms`,
            });

            // Log successful authentication (non-blocking)
            AuditService.logAuth({
                action: AuditAction.LOGIN,
                userId: verifiedToken.sub,
                req,
                metadata: {
                    path: req.path,
                    method: req.method,
                    duration: `${duration}ms`,
                },
            }).catch(err => logger.error('Audit log error:', err));

            next();
        } catch (verifyError: any) {
            const duration = Date.now() - startTime;
            logger.error('Token verification error', {
                error: verifyError.message,
                stack: verifyError.stack,
                path: req.path,
                method: req.method,
                originalUrl: req.originalUrl,
                duration: `${duration}ms`,
            });
            
            // ✅ ENTERPRISE IMMUNITY: Track failed auth
            AbuseDetectionService.trackFailedAuth(null, req.ip || 'unknown');
            
            // Log failed authentication attempt (non-blocking)
            AuditService.logAuth({
                action: AuditAction.LOGIN_FAILED,
                req,
                metadata: {
                    error: verifyError.message,
                    path: req.path,
                    method: req.method,
                },
            }).catch(err => logger.error('Audit log error:', err));
            
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - Token verification failed',
            });
            return;
        }
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
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token, continue without auth
            next();
            return;
        }

        const token = authHeader.substring(7);

        try {
            // ✅ SECURE: Verify JWT signature using Clerk SDK
            const verifiedToken = await clerkClient.verifyToken(token);

            if (verifiedToken && verifiedToken.sub) {
                // Verify user exists (with caching)
                const userExists = await getVerifiedUser(verifiedToken.sub);

                if (userExists) {
                    req.auth = {
                        userId: verifiedToken.sub,
                        sessionId: verifiedToken.sid || '',
                        sessionClaims: verifiedToken,
                    };
                }
            }
        } catch (verifyError) {
            // Token invalid, continue without auth
            logger.debug('Optional auth - token verification failed');
        }

        next();
    } catch (error) {
        logger.error('Optional auth middleware error:', error);
        next();
    }
};
