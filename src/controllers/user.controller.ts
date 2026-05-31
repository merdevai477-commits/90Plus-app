import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { AuditService, AuditAction } from '../services/audit.service';
import { ErrorCode, sendError } from '../constants/errors';
import { invalidateUserLanguageCache } from '../services/push-templates.service';

export class UserController {
    /**
     * Get user settings
     */
    static async getSettings(req: Request, res: Response): Promise<void> {
        try {
            // Get Clerk user ID from auth middleware
            const clerkUserId = req.auth?.userId;

            if (!clerkUserId) {
                sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
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
            sendError(req, res, ErrorCode.INTERNAL, 'Failed to retrieve settings');
        }
    }

    static async updateSettings(req: Request, res: Response): Promise<void> {
        try {
            // Get Clerk user ID from auth middleware
            const clerkUserId = req.auth?.userId;

            if (!clerkUserId) {
                sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
                return;
            }

            const newSettings = req.body.settings || req.body;

            // Merge with existing settings
            const user = await prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true, settings: true },
            });

            if (!user) {
                sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
                return;
            }

            const currentSettings = (user.settings as Record<string, any>) || {};
            const updatedSettings = { ...currentSettings, ...newSettings };

            // ✅ Sync Global Settings to NotificationPreferences table
            const prefsUpdate: Record<string, boolean> = {};
            if (typeof updatedSettings.goalNotifications === 'boolean') {
                prefsUpdate.matchGoals = updatedSettings.goalNotifications;
            }
            if (typeof updatedSettings.matchNotifications === 'boolean') {
                prefsUpdate.matchStart = updatedSettings.matchNotifications;
                prefsUpdate.matchEnd = updatedSettings.matchNotifications;
                prefsUpdate.matchHalftime = updatedSettings.matchNotifications;
                prefsUpdate.leagueMatches = updatedSettings.matchNotifications;
            }
            if (typeof updatedSettings.predictionReminders === 'boolean') {
                prefsUpdate.predictionResults = updatedSettings.predictionReminders;
            }

            // Notification preferences sync (match toggles) — push consent is managed
            // only via POST /matches/push-token and POST /gdpr/consent, not here.

            // Detect language change so we can invalidate the in-process
            // language cache used by push notifications. Without this, push
            // copy would lag behind the user's selection by up to 5 minutes
            // (the cache TTL).
            const previousLanguage =
                typeof currentSettings.language === 'string' ? currentSettings.language : null;
            const nextLanguage =
                typeof updatedSettings.language === 'string' ? updatedSettings.language : null;
            const languageChanged =
                nextLanguage !== null && nextLanguage !== previousLanguage;

            await prisma.user.update({
                where: { clerkUserId },
                data: {
                    settings: updatedSettings as Prisma.InputJsonValue,
                },
            });

            if (Object.keys(prefsUpdate).length > 0) {
                await (prisma as any).notificationPreferences.upsert({
                    where: { userId: user.id },
                    create: { userId: user.id, ...prefsUpdate },
                    update: prefsUpdate,
                });
            }

            if (languageChanged) {
                // Drop the cached language so the very next push for this
                // user reads the fresh value from the DB.
                invalidateUserLanguageCache(user.id);
            }

            res.json({
                status: 'SUCCESS',
                data: updatedSettings,
                message: 'Settings updated successfully',
            });
        } catch (error) {
            logger.error('Update settings error:', error);
            sendError(req, res, ErrorCode.INTERNAL, 'Failed to update settings');
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

                sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
                return;
            }

            // Get user from database
            const user = await prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true, email: true, username: true },
            });

            if (!user) {
                sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
                return;
            }

            // Import AccountDeletionService
            const { AccountDeletionService } = await import('../services/account-deletion.service');

            // Log account deletion initiation
            await AuditService.logAccountManagement({
                action: AuditAction.ACCOUNT_DELETION_INITIATED,
                userId: user.id,
                req,
                // Avoid embedding email/username in audit reason — those are
                // captured separately in `metadata` and shouldn't propagate
                // into log lines that may end up in shared log aggregators.
                reason: 'User requested account deletion',
                metadata: {
                    email: user.email,
                    username: user.username,
                },
            });

            // Initiate account deletion (soft delete + schedule permanent deletion)
            await AccountDeletionService.initiateAccountDeletion(user.id, clerkUserId);

            logger.info(`Account deletion initiated for user ${user.id}`);

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
            sendError(req, res, ErrorCode.INTERNAL, 'Failed to delete account');
        }
    }
}
