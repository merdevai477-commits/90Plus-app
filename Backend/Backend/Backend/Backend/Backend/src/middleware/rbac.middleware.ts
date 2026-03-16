/**
 * 🔒 ZERO TRUST: Role-Based Access Control (RBAC)
 * Enforces role verification on every privileged route
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

/**
 * Require specific role(s) to access route
 * Prevents privilege escalation attacks
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({
          status: 'ERROR',
          message: 'Unauthorized - Authentication required',
        });
        return;
      }

      // Get user with role from database
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, role: true, username: true },
      });

      if (!user) {
        res.status(401).json({
          status: 'ERROR',
          message: 'Unauthorized - User not found',
        });
        return;
      }

      // Check if user has required role
      const hasRequiredRole = allowedRoles.includes(user.role as UserRole);

      if (!hasRequiredRole) {
        logger.warn('Role authorization failed', {
          userId: user.id,
          username: user.username,
          userRole: user.role,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        res.status(403).json({
          status: 'ERROR',
          message: 'Forbidden - Insufficient permissions',
        });
        return;
      }

      // Attach user info to request
      req.userId = user.id;
      req.userRole = user.role as UserRole;

      logger.debug('Role authorization successful', {
        userId: user.id,
        role: user.role,
        path: req.path,
      });

      next();
    } catch (error: any) {
      logger.error('Role authorization error:', error);
      res.status(500).json({
        status: 'ERROR',
        message: 'Internal server error',
      });
    }
  };
}

/**
 * Check if user is admin
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Check if user is moderator or admin
 */
export const requireModerator = requireRole(UserRole.MODERATOR, UserRole.ADMIN);

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
    }
  }
}
