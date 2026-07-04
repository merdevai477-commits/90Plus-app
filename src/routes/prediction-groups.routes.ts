import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/clerk.middleware';
import { ErrorCode, sendError } from '../constants/errors';
import { logger } from '../utils/logger';
import {
  buildGroupSummaryFromDb,
  generateUniqueInviteCode,
} from '../services/prediction-groups.service';
import { MAJOR_LEAGUE_SET } from '@/constants/leagues';
import {
  FINISHED_MATCH_STATUSES,
  LIVE_MATCH_STATUSES,
  PREDICTION_WINDOW_FUTURE_DAYS,
  PREDICTION_WINDOW_PAST_DAYS,
  UPCOMING_MATCH_STATUSES,
  isPredictionSubmissionOpen,
} from '../constants/predictions.constants';
const router = Router();
const db = prisma as any;


async function findCurrentUserId(req: Request): Promise<string | null> {
  const clerkUserId = req.auth?.userId;
  if (!clerkUserId) return null;

  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    select: { id: true },
  });

  return user?.id ?? null;
}

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await findCurrentUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : null;
    const visibility = req.body?.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';

    if (!rawName || rawName.length < 3) {
      sendError(req, res, ErrorCode.VALIDATION, 'Group name must be at least 3 characters', {
        field: 'name',
      });
      return;
    }

    const inviteCode = await generateUniqueInviteCode();

    const group = await db.predictionGroup.create({
      data: {
        name: rawName,
        imageUrl,
        inviteCode,
        visibility,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        imageUrl: group.imageUrl,
        inviteCode: group.inviteCode,
        visibility: group.visibility,
        membersCount: group._count.members,
      },
    });
  } catch (error) {
    logger.error('Create prediction group error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

router.get('/my', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await findCurrentUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const memberships = await db.predictionGroupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: memberships.map((membership: any) => ({
        id: membership.group.id,
        name: membership.group.name,
        imageUrl: membership.group.imageUrl,
        inviteCode: membership.group.inviteCode,
        visibility: membership.group.visibility,
        membersCount: membership.group._count.members,
        role: membership.role,
      })),
    });
  } catch (error) {
    logger.error('Get my prediction groups error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

router.post('/join', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await findCurrentUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const inviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim().toUpperCase() : '';
    const groupId = typeof req.body?.groupId === 'string' ? req.body.groupId.trim() : '';

    if (!inviteCode && !groupId) {
      sendError(req, res, ErrorCode.VALIDATION, 'groupId or inviteCode is required');
      return;
    }

    const orConditions: Array<{ id?: string; inviteCode?: string }> = [];
    if (groupId) orConditions.push({ id: groupId });
    if (inviteCode) orConditions.push({ inviteCode });

    const group = await db.predictionGroup.findFirst({
      where: { OR: orConditions },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Group not found');
      return;
    }

    if (group.visibility === 'PRIVATE' && inviteCode !== group.inviteCode) {
      sendError(req, res, ErrorCode.AUTHORIZATION, 'Invite code is required for private groups');
      return;
    }

    const existing = await db.predictionGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
      select: { id: true },
    });

    const alreadyMember = Boolean(existing);

    if (!existing) {
      await db.predictionGroupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'MEMBER',
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        imageUrl: group.imageUrl,
        inviteCode: group.inviteCode,
        visibility: group.visibility,
        alreadyMember,
      },
    });
  } catch (error) {
    logger.error('Join prediction group error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

router.get('/:groupId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await findCurrentUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const groupIdParam = req.params.groupId;
    const groupId = Array.isArray(groupIdParam) ? groupIdParam[0] : groupIdParam;
    if (!groupId || typeof groupId !== 'string') {
      sendError(req, res, ErrorCode.VALIDATION, 'groupId is required');
      return;
    }

    const membership = await db.predictionGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      sendError(req, res, ErrorCode.AUTHORIZATION, 'You are not a member of this group');
      return;
    }

    const group = await db.predictionGroup.findUnique({
      where: { id: groupId },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Group not found');
      return;
    }

    const summary = await buildGroupSummaryFromDb(groupId, userId);

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - PREDICTION_WINDOW_PAST_DAYS);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(now);
    toDate.setDate(toDate.getDate() + PREDICTION_WINDOW_FUTURE_DAYS);
    toDate.setHours(23, 59, 59, 999);

    const fixtures = await db.cachedFixture.findMany({
      where: {
        matchDate: { gte: fromDate, lte: toDate },
        status: { in: [...UPCOMING_MATCH_STATUSES, ...LIVE_MATCH_STATUSES, ...FINISHED_MATCH_STATUSES] },
      },
      select: {
        fixtureId: true,
        leagueId: true,
        homeTeamName: true,
        awayTeamName: true,
        matchDate: true,
        leagueRound: true,
        status: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: [
        { matchDate: 'asc' },
      ],
      take: 80,
    });

    const topLeagueFixtures = fixtures.filter((fixture: any) => MAJOR_LEAGUE_SET.has(fixture.leagueId));
    const fallbackFixtures = fixtures.filter((fixture: any) => !MAJOR_LEAGUE_SET.has(fixture.leagueId));
    const selectedFixturesBase = [...topLeagueFixtures, ...fallbackFixtures];
    const selectedFixtures = selectedFixturesBase.sort((a: any, b: any) => {
      const aFinished = FINISHED_MATCH_STATUSES.includes(a.status);
      const bFinished = FINISHED_MATCH_STATUSES.includes(b.status);
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      if (aFinished && bFinished) {
        return new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime();
      }
      return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
    });

    const groupMembers = await db.predictionGroupMember.findMany({
      where: { groupId },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    const predictions = await db.prediction.findMany({
      where: {
        userId: { in: groupMembers.map((member: any) => member.userId) },
        apiMatchId: { in: selectedFixtures.map((f: any) => f.fixtureId) },
      },
      select: {
        userId: true,
        apiMatchId: true,
        predictionType: true,
        isCorrect: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
      },
    });

    const fixtureById = new Map(selectedFixtures.map((fixture: any) => [fixture.fixtureId, fixture]));

    const memberLookup = new Map(
      groupMembers.map((member: any) => [member.userId, {
        userId: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
        avatar: member.user.avatar,
      }]),
    );

    const predictionBucketByFixture = new Map<number, any[]>();
    for (const prediction of predictions) {
      const list = predictionBucketByFixture.get(prediction.apiMatchId) ?? [];
      const member = memberLookup.get(prediction.userId);
      if (member) {
        const fixture = fixtureById.get(prediction.apiMatchId);
        const isFinished = fixture ? FINISHED_MATCH_STATUSES.includes(fixture.status) : false;
        let computedIsCorrect: boolean | null = null;
        if (typeof prediction.isCorrect === 'boolean') {
          computedIsCorrect = prediction.isCorrect;
        } else if (isFinished && fixture && fixture.homeScore !== null && fixture.awayScore !== null) {
          const resultType = fixture.homeScore > fixture.awayScore ? 'home' : fixture.homeScore < fixture.awayScore ? 'away' : 'draw';
          computedIsCorrect = prediction.predictionType === resultType;
        }
        list.push({
          ...member,
          prediction: prediction.predictionType,
          predictedHomeScore: prediction.predictedHomeScore,
          predictedAwayScore: prediction.predictedAwayScore,
          isCorrect: computedIsCorrect,
          isCurrentUser: prediction.userId === userId,
        });
      }
      predictionBucketByFixture.set(prediction.apiMatchId, list);
    }

    for (const member of groupMembers) {
      for (const fixture of selectedFixtures) {
        const list = predictionBucketByFixture.get(fixture.fixtureId) ?? [];
        const alreadyIncluded = list.some((item: any) => item.userId === member.userId);
        if (!alreadyIncluded) {
          list.push({
            userId: member.user.id,
            username: member.user.username,
            displayName: member.user.displayName,
            avatar: member.user.avatar,
            prediction: null,
            predictedHomeScore: null,
            predictedAwayScore: null,
            isCorrect: null,
            isCurrentUser: member.userId === userId,
          });
        }
        predictionBucketByFixture.set(fixture.fixtureId, list);
      }
    }

    const normalizedMatches = selectedFixtures.map((fixture: any) => {
      const allPredictions = predictionBucketByFixture.get(fixture.fixtureId) ?? [];
      const myPrediction = (allPredictions.find((item: any) => item.isCurrentUser)?.prediction ?? null) as 'home' | 'draw' | 'away' | null;
      const isFinished = FINISHED_MATCH_STATUSES.includes(fixture.status);
      const visiblePredictions = isFinished
        ? allPredictions.filter((item: any) => item.isCorrect === true)
        : [];
      const canSubmitPrediction = isPredictionSubmissionOpen(new Date(fixture.matchDate), now);
      return {
        fixtureId: fixture.fixtureId,
        homeTeamName: fixture.homeTeamName,
        awayTeamName: fixture.awayTeamName,
        matchDate: fixture.matchDate,
        round: fixture.leagueRound,
        status: fixture.status,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        isFinished,
        canSubmitPrediction,
        myPrediction,
        predictions: visiblePredictions,
      };
    });

    res.json({
      success: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          imageUrl: group.imageUrl,
          inviteCode: group.inviteCode,
          visibility: group.visibility,
          membersCount: group._count.members,
        },
        summary,
        upcomingRoundMatches: normalizedMatches,
      },
    });
  } catch (error: any) {
    if (error?.message === 'GROUP_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Group not found');
      return;
    }

    logger.error('Get prediction group details error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

export default router;
