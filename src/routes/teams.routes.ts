import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';
import { notifyUser } from '../services/notify.service';
import { NotificationType } from '../services/notification.service';

const router = Router();

function parseTeamId(param: string | string[] | undefined): number {
    const raw = Array.isArray(param) ? param[0] : param;
    return parseInt(String(raw ?? ''), 10);
}

// ============================================
// POST /api/teams/favorite/:teamId
// Follow a club / national team
// ============================================
router.post('/favorite/:teamId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const apiTeamId = parseTeamId(req.params.teamId);
        const { teamName, teamLogo, country, isNationalTeam, language } = req.body ?? {};

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        if (Number.isNaN(apiTeamId) || apiTeamId <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid team ID');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const existed = await prisma.favoriteTeam.findUnique({
            where: { userId_apiTeamId: { userId: user.id, apiTeamId } },
            select: { id: true },
        });

        const resolvedName =
            typeof teamName === 'string' && teamName.length > 0 ? teamName : `Team ${apiTeamId}`;

        const favorite = await prisma.favoriteTeam.upsert({
            where: { userId_apiTeamId: { userId: user.id, apiTeamId } },
            create: {
                userId: user.id,
                apiTeamId,
                teamName: resolvedName,
                teamLogo: typeof teamLogo === 'string' ? teamLogo : null,
                country: typeof country === 'string' ? country : null,
            },
            update: {
                teamName: typeof teamName === 'string' && teamName.length > 0 ? teamName : undefined,
                teamLogo: typeof teamLogo === 'string' ? teamLogo : undefined,
                country: typeof country === 'string' ? country : undefined,
            },
            select: { id: true, apiTeamId: true },
        });

        if (!existed) {
            const national = isNationalTeam === true;
            notifyUser({
                userId: user.id,
                type: NotificationType.GENERAL,
                titleKey: national ? 'followedNationalTeamTitle' : 'followedClubTitle',
                bodyKey: national ? 'followedNationalTeamBody' : 'followedClubBody',
                vars: { name: resolvedName },
                language: typeof language === 'string' ? language : undefined,
                data: {
                    type: 'TEAM_FOLLOWED',
                    teamId: String(apiTeamId),
                    entityId: String(apiTeamId),
                    screen: '/team-profile',
                    teamName: resolvedName,
                    isNationalTeam: national,
                },
            }).catch((err) =>
                logger.warn('[teams/favorite] follow confirmation push failed (non-fatal):', err?.message ?? err),
            );
        }

        // Best-effort: immediately subscribe the user to this team's same-day
        // fixtures (kickoff + upcoming) so notifications don't wait for the
        // periodic watcher pass. Non-fatal on failure.
        import('../services/followed-team-watcher.service')
            .then(({ FollowedTeamWatcherService }) =>
                FollowedTeamWatcherService.syncTeamForUser(user.id, apiTeamId),
            )
            .catch((err) =>
                logger.warn('[teams/favorite] immediate sync failed (non-fatal):', err?.message ?? err),
            );

        res.json({
            status: 'SUCCESS',
            message: 'Team followed',
            data: { favorite: { id: favorite.id, apiTeamId: favorite.apiTeamId } },
        });
    } catch (error: any) {
        logger.error('Follow team error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to follow team');
    }
});

// ============================================
// DELETE /api/teams/favorite/:teamId
// Unfollow a club / national team
// ============================================
router.delete('/favorite/:teamId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const apiTeamId = parseTeamId(req.params.teamId);

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        if (Number.isNaN(apiTeamId) || apiTeamId <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid team ID');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        await prisma.favoriteTeam.deleteMany({
            where: { userId: user.id, apiTeamId },
        });

        // Cancel any auto-subscriptions this follow created for still-upcoming
        // fixtures so we stop notifying about them. Non-fatal on failure.
        import('../services/followed-team-watcher.service')
            .then(({ FollowedTeamWatcherService }) =>
                FollowedTeamWatcherService.cleanupTeamForUser(user.id, apiTeamId),
            )
            .catch((err) =>
                logger.warn('[teams/favorite] unfollow cleanup failed (non-fatal):', err?.message ?? err),
            );

        res.json({ status: 'SUCCESS', message: 'Team unfollowed' });
    } catch (error: any) {
        logger.error('Unfollow team error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to unfollow team');
    }
});

// ============================================
// GET /api/teams/favorites
// List followed teams
// ============================================
router.get('/favorites', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const favorites = await prisma.favoriteTeam.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            status: 'SUCCESS',
            data: {
                favorites: favorites.map((f) => ({
                    id: f.id,
                    apiTeamId: f.apiTeamId,
                    teamName: f.teamName,
                    teamLogo: f.teamLogo,
                    country: f.country,
                })),
            },
        });
    } catch (error: any) {
        logger.error('Get followed teams error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to get followed teams');
    }
});

// ============================================
// GET /api/teams/favorite/:teamId/check
// Check if a team is followed
// ============================================
router.get('/favorite/:teamId/check', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const apiTeamId = parseTeamId(req.params.teamId);

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.json({ status: 'SUCCESS', data: { isFavorite: false } });
            return;
        }

        const favorite = await prisma.favoriteTeam.findUnique({
            where: { userId_apiTeamId: { userId: user.id, apiTeamId } },
            select: { id: true },
        });

        res.json({
            status: 'SUCCESS',
            data: { isFavorite: !!favorite },
        });
    } catch (error: any) {
        logger.error('Check followed team error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to check followed team');
    }
});

export default router;
