import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Middleware to require admin (isDeveloper) access
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, isDeveloper: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        if (!user.isDeveloper) {
            logger.warn(`Non-admin user ${user.id} attempted to access admin endpoint`);
            res.status(403).json({ status: 'ERROR', message: 'Forbidden: Admin access required' });
            return;
        }

        // Attach user to request for use in routes
        (req as any).adminUser = user;

        next();
    } catch (error: any) {
        logger.error('Error in requireAdmin middleware:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
}

