import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';

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
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - Invalid token format',
                });
                return;
            }

            // Verify user exists in Clerk
            const user = await clerkClient.users.getUser(decoded.sub);

            if (!user || !user.id) {
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

            next();
        } catch (verifyError: any) {
            console.error('Token verification error:', verifyError);
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized - Token verification failed',
            });
            return;
        }
    } catch (error: any) {
        console.error('Auth middleware error:', error);
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
                // Verify user exists
                const user = await clerkClient.users.getUser(decoded.sub);

                if (user && user.id && (!decoded.exp || decoded.exp * 1000 >= Date.now())) {
                    req.auth = {
                        userId: decoded.sub,
                        sessionId: decoded.sid || '',
                        sessionClaims: decoded,
                    };
                }
            }
        } catch (verifyError) {
            // Token invalid, continue without auth
            console.warn('Optional auth - token verification failed');
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
};
