import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { logger } from '../utils/logger';
import { AuditService, AuditAction } from '../services/audit.service';

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

// Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of userCache.entries()) {
        if (now - value.verifiedAt > CACHE_TTL_MS * 2) {
            userCache.delete(key);
        }
    }
}, 60 * 1000); // Clean every minute

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

            // Optional: Verify user exists in Clerk (with caching) for extra security
            const userExists = await getVerifiedUser(verifiedToken.sub);

            if (!userExists) {
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - User not found',
                });
                return;
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
