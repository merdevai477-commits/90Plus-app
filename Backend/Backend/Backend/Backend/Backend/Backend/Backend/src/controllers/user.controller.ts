import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { AuditService, AuditAction } from '../services/audit.service';

export class UserController {
    /**
     * Get user settings
     */
    static async getSettings(req: Request, res: Response): Promise<void> {
        try {
            // Get Clerk user ID from auth middleware
            const clerkUserId = req.auth?.userId;

            if (!clerkUserId) {
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - No user ID',
                });
                return;
            }

            const user = await prisma.user.findUnique({
                where: { clerkUserId },
                select: { settings: true },
            });

            res.json({
                status: 'SUCCESS',
                data: user?.settings || {},
            });
        } catch (error) {
            logger.error('Get settings error:', error);
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to retrieve settings',
            });
        }
    }

    /**
     * Update user settings
     */
    static async updateSettings(req: Request, res: Response): Promise<void> {
        try {
            // Get Clerk user ID from auth middleware
            const clerkUserId = req.auth?.userId;

            if (!clerkUserId) {
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - No user ID',
                });
                return;
            }

            const newSettings = req.body.settings || req.body;

            // Merge with existing settings
            const user = await prisma.user.findUnique({
                where: { clerkUserId },
                select: { settings: true },
            });

            const currentSettings = (user?.settings as Record<string, any>) || {};
            const updatedSettings = { ...currentSettings, ...newSettings };

            await prisma.user.update({
                where: { clerkUserId },
                data: { settings: updatedSettings },
            });

            res.json({
                status: 'SUCCESS',
                data: updatedSettings,
                message: 'Settings updated successfully',
            });
        } catch (error) {
            logger.error('Update settings error:', error);
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to update settings',
            });
        }
    }

    /**
     * Delete user account (Apple Compliance)
     * Initiates soft delete with 30-day grace period
     */
    static async deleteAccount(req: Request, res: Response): Promise<void> {
        try {
            // Get Clerk user ID from auth middleware
            const clerkUserId = req.auth?.userId;

            if (!clerkUserId) {
                // Log unauthorized access attempt
                await AuditService.logSecurity({
                    action: AuditAction.UNAUTHORIZED_ACCESS,
                    req,
                    reason: 'Account deletion attempted without authentication',
                });
                
                res.status(401).json({
                    status: 'ERROR',
                    message: 'Unauthorized - No user ID',
                });
                return;
            }

            // Get user from database
            const user = await prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true, email: true, username: true },
            });

            if (!user) {
                res.status(404).json({
                    status: 'ERROR',
                    message: 'User not found',
                });
                return;
            }

            // Import AccountDeletionService
            const { AccountDeletionService } = await import('../services/account-deletion.service');

            // Log account deletion initiation
            await AuditService.logAccountManagement({
                action: AuditAction.ACCOUNT_DELETION_INITIATED,
                userId: user.id,
                req,
                reason: 'User requested account deletion',
                metadata: {
                    email: user.email,
                    username: user.username,
                },
            });

            // Initiate account deletion (soft delete + schedule permanent deletion)
            await AccountDeletionService.initiateAccountDeletion(user.id, clerkUserId);

            logger.info(`Account deletion initiated for user ${user.id} (${user.username})`);

            res.json({
                status: 'SUCCESS',
                message: 'Account deletion initiated. Your data will be permanently deleted in 30 days.',
                data: {
                    deletedAt: new Date(),
                    scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            });
        } catch (error) {
            logger.error('Delete account error:', error);
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to delete account',
            });
        }
    }
}
