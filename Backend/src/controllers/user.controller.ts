import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
            console.error('Get settings error:', error);
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
            console.error('Update settings error:', error);
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to update settings',
            });
        }
    }

    /**
     * Delete user account
     */
    static async deleteAccount(req: Request, res: Response): Promise<void> {
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

            // Delete user (cascade will handle related data)
            await prisma.user.delete({
                where: { clerkUserId },
            });

            res.json({
                status: 'SUCCESS',
                message: 'Account deleted successfully',
            });
        } catch (error) {
            console.error('Delete account error:', error);
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to delete account',
            });
        }
    }
}
