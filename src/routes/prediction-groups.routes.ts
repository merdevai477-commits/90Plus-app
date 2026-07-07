/**
 * Prediction Groups Routes — ملك التوقعات
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { clearResponseCache, responseCacheMiddleware } from '../middleware/responseCache.middleware';
import prisma from '../lib/prisma';
import { ErrorCode, sendError, type ErrorCodeValue } from '../constants/errors';
import { logger } from '../utils/logger';
import {
  createGroup,
  deleteGroup,
  getGlobalLeaderboard,
  getGroupMembers,
  getGroupStandings,
  getMyGroupState,
  getMyRoundPredictions,
  inviteUser,
  joinGroup,
  kickMember,
  leaveGroup,
  previewGroupByCode,
  saveGroupPredictions,
  updateGroup,
} from '../services/prediction-groups.service';

const router = Router();

async function invalidateGroupCaches(): Promise<void> {
  await clearResponseCache('/prediction-groups').catch(() => undefined);
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveUser(req: Request) {
  const clerkUserId = req.auth?.userId;
  if (!clerkUserId) return null;
  return prisma.user.findFirst({
    where: { clerkUserId },
    select: { id: true, username: true },
  });
}

function mapError(req: Request, res: Response, err: unknown): void {
  const code = err instanceof Error ? err.message : 'UNKNOWN';
  const map: Record<string, { status: ErrorCodeValue; message: string }> = {
    ALREADY_IN_GROUP: { status: ErrorCode.CONFLICT, message: 'أنت عضو في مجموعة بالفعل' },
    ALREADY_OWNS_GROUP: { status: ErrorCode.CONFLICT, message: 'لديك مجموعة نشطة بالفعل' },
    NOT_IN_GROUP: { status: ErrorCode.NOT_FOUND, message: 'لست عضواً في مجموعة' },
    GROUP_NOT_FOUND: { status: ErrorCode.NOT_FOUND, message: 'المجموعة غير موجودة' },
    INVALID_CODE: { status: ErrorCode.VALIDATION, message: 'كود الدعوة غير صالح' },
    INVITE_NOT_FOUND: { status: ErrorCode.NOT_FOUND, message: 'الدعوة غير موجودة' },
    INVITE_NOT_PENDING: { status: ErrorCode.CONFLICT, message: 'الدعوة غير متاحة' },
    INVITEE_IN_GROUP: { status: ErrorCode.CONFLICT, message: 'المستخدم عضو في مجموعة أخرى' },
    FORBIDDEN: { status: ErrorCode.AUTHORIZATION, message: 'غير مسموح' },
    INVALID_NAME: { status: ErrorCode.VALIDATION, message: 'اسم المجموعة غير صالح' },
    MATCH_NOT_IN_ROUND: { status: ErrorCode.VALIDATION, message: 'المباراة ليست في الجولة الحالية' },
    MATCH_LOCKED: { status: ErrorCode.CONFLICT, message: 'التوقعات مغلقة لهذه المباراة' },
    MEMBER_NOT_FOUND: { status: ErrorCode.NOT_FOUND, message: 'العضو غير موجود' },
    CANNOT_KICK_SELF: { status: ErrorCode.VALIDATION, message: 'لا يمكن طرد نفسك' },
    GROUP_BANNED: {
      status: ErrorCode.AUTHORIZATION,
      message: 'تم إيقاف نشاط المجموعات مؤقتاً — حاول لاحقاً',
    },
  };
  const mapped = map[code] ?? { status: ErrorCode.INTERNAL, message: 'Internal server error' };
  if (!map[code]) logger.error('[PredictionGroups] unhandled error:', err);
  sendError(req, res, mapped.status, mapped.message);
}

router.get('/me', requireAuth, responseCacheMiddleware({ ttl: 3_000 }), async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const state = await getMyGroupState(user.id);
    res.json({ success: true, data: state });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const { name, avatarUrl } = req.body ?? {};
    const state = await createGroup(user.id, String(name ?? ''), avatarUrl);
    await invalidateGroupCaches();
    res.status(201).json({ success: true, data: state });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.get('/preview/:code', requireAuth, async (req, res) => {
  try {
    const preview = await previewGroupByCode(param(req.params.code));
    res.json({ success: true, data: preview });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/join', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const { code, inviteId } = req.body ?? {};
    const state = await joinGroup(user.id, { code, inviteId });
    await invalidateGroupCaches();
    res.json({ success: true, data: state });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/leave', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const result = await leaveGroup(user.id);
    const state = await getMyGroupState(user.id);
    await invalidateGroupCaches();
    res.json({ success: true, data: { ...result, state } });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const result = await deleteGroup(user.id, param(req.params.id));
    const state = await getMyGroupState(user.id);
    await invalidateGroupCaches();
    res.json({ success: true, data: { ...result, state } });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.get('/leaderboard', requireAuth, responseCacheMiddleware({ ttl: 30_000 }), async (req, res) => {
  try {
    const period = (req.query.period as 'all' | 'week' | 'month') || 'all';
    const rows = await getGlobalLeaderboard(period);
    res.json({ success: true, data: rows });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const { name, avatarUrl } = req.body ?? {};
    const state = await updateGroup(user.id, param(req.params.id), { name, avatarUrl });
    await invalidateGroupCaches();
    res.json({ success: true, data: state });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.get('/:id/members', requireAuth, responseCacheMiddleware({ ttl: 20_000 }), async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const members = await getGroupMembers(param(req.params.id), user.id);
    res.json({ success: true, data: members });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.get('/:id/standings', requireAuth, responseCacheMiddleware({ ttl: 20_000 }), async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const standings = await getGroupStandings(param(req.params.id), user.id);
    res.json({ success: true, data: standings });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.delete('/:id/members/:userId', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const result = await kickMember(user.id, param(req.params.id), param(req.params.userId));
    await invalidateGroupCaches();
    res.json({ success: true, data: result });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/:id/invites', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const { userId: inviteeId } = req.body ?? {};
    if (!inviteeId) {
      sendError(req, res, ErrorCode.VALIDATION, 'userId required');
      return;
    }
    const result = await inviteUser(user.id, param(req.params.id), String(inviteeId));
    res.json({ success: true, data: result });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.get('/:id/round/current', requireAuth, responseCacheMiddleware({ ttl: 60_000 }), async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const data = await getMyRoundPredictions(user.id, param(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/:id/predictions', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const { predictions } = req.body ?? {};
    if (!Array.isArray(predictions)) {
      sendError(req, res, ErrorCode.VALIDATION, 'predictions array required');
      return;
    }
    const result = await saveGroupPredictions(user.id, param(req.params.id), predictions);
    await invalidateGroupCaches();
    res.json({ success: true, data: result });
  } catch (err) {
    mapError(req, res, err);
  }
});

export default router;
