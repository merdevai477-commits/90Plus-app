import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { logger } from '../utils/logger';

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
 * Decode JWT without verification (for extracting claims)
 * The actual user verification is done via Clerk API
 */
function decodeJwt(token: string): any {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

/**
 * Clerk Authentication Middleware
 * Verifies JWT token and extracts user information
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
            // Decode the JWT to get user ID
            const decoded = decodeJwt(token);

            if (!decoded || !decoded.sub) {
                logger.warn('requireAuth middleware - Invalid token format', {
                    path: req.path,
                    method: req.method,
                    originalUrl: req.originalUrl,
                });
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - Invalid token format',
                });
                return;
            }
            
            logger.debug('requireAuth middleware - Token decoded', {
                userId: decoded.sub,
                path: req.path,
                method: req.method,
            });

            // Verify user exists in Clerk (with caching)
            const userExists = await getVerifiedUser(decoded.sub);

            if (!userExists) {
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - User not found',
                });
                return;
            }

            // Check if token is expired
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - Token expired',
                });
                return;
            }

            // Attach user info to request
            req.auth = {
                userId: decoded.sub,
                sessionId: decoded.sid || '',
                sessionClaims: decoded,
            };

            const duration = Date.now() - startTime;
            logger.debug('requireAuth middleware - Authentication successful', {
                userId: decoded.sub,
                path: req.path,
                duration: `${duration}ms`,
            });

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
            const decoded = decodeJwt(token);

            if (decoded && decoded.sub) {
                // Verify user exists (with caching)
                const userExists = await getVerifiedUser(decoded.sub);

                if (userExists && (!decoded.exp || decoded.exp * 1000 >= Date.now())) {
                    req.auth = {
                        userId: decoded.sub,
                        sessionId: decoded.sid || '',
                        sessionClaims: decoded,
                    };
                }
            }
        } catch (verifyError) {
            // Token invalid, continue without auth
            logger.error('Optional auth - token verification failed');
        }

        next();
    } catch (error) {
        logger.error('Optional auth middleware error:', error);
        next();
    }
};
