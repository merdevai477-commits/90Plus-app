import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validateZod } from '../middleware/zod-validation.middleware';
import { ErrorCode, sendError } from '../constants/errors';
import { ensureBackendUserId } from '../utils/ensureBackendUser';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { MATCH_CHAT_CONFIG } from '../config/match-chat.config';
import { MatchChatGateway } from '../services/match-chat/match-chat.gateway';
import { applyModerationStrike, clearFreeze, setFrozenUntil } from '../services/match-chat/match-chat.policy';
import {
  createMatchChatReport,
  getBlockedPairIds,
  getHistoryFromPostgres,
  getMessageById,
  softDeleteMessage,
} from '../services/match-chat/match-chat.repository';
import {
  matchChatAdminFreezeSchema,
  matchChatHistoryQuerySchema,
  matchChatReportSchema,
} from '../services/match-chat/match-chat.validation';
import { logger } from '../utils/logger';

const router = Router();

const matchIdParams = z.object({
  matchId: z.coerce.number().int().positive().max(2_147_483_647),
});

const idParams = z.object({
  id: z.string().uuid(),
});

const userIdParams = z.object({
  userId: z.string().uuid(),
});

async function reportRateLimited(userId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) return false;
  const key = `chat:user:${userId}:reports`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600);
  return count > 8;
}

router.get(
  '/:matchId/messages',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }
      const params = matchIdParams.safeParse(req.params);
      const query = matchChatHistoryQuerySchema.safeParse(req.query);
      if (!params.success || !query.success) {
        sendError(req, res, ErrorCode.VALIDATION, 'Invalid match chat query');
        return;
      }

      const userId = await ensureBackendUserId(clerkUserId);
      const blocked = await getBlockedPairIds(userId);
      const { messages, hasMore } = await getHistoryFromPostgres(params.data.matchId, {
        beforeId: query.data.before,
        limit: query.data.limit ?? MATCH_CHAT_CONFIG.historySize,
      });

      res.json({
        messages: messages.filter((m) => !blocked.has(m.user.id)),
        hasMore,
      });
    } catch (err) {
      logger.error('[match-chat] history failed', err);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to load messages');
    }
  },
);

router.post(
  '/messages/:id/report',
  requireAuth,
  validateZod({ body: matchChatReportSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }
      const params = idParams.safeParse(req.params);
      if (!params.success) {
        sendError(req, res, ErrorCode.VALIDATION, 'Invalid message id');
        return;
      }

      const userId = await ensureBackendUserId(clerkUserId);
      if (await reportRateLimited(userId)) {
        sendError(req, res, ErrorCode.RATE_LIMIT, 'Too many reports');
        return;
      }

      const message = await getMessageById(params.data.id);
      if (!message || message.deletedAt) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'Message not found');
        return;
      }
      if (message.userId === userId) {
        sendError(req, res, ErrorCode.VALIDATION, 'Cannot report your own message');
        return;
      }

      const result = await createMatchChatReport({
        reporterId: userId,
        messageId: message.id,
        reason: req.body.reason,
        details: req.body.details,
      });
      if (result === 'duplicate') {
        sendError(req, res, ErrorCode.CONFLICT, 'Already reported');
        return;
      }
      res.status(201).json({ ok: true });
    } catch (err) {
      logger.error('[match-chat] report failed', err);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to submit report');
    }
  },
);

router.delete(
  '/admin/messages/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const params = idParams.safeParse(req.params);
    if (!params.success) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid message id');
      return;
    }
    const deleted = await softDeleteMessage(params.data.id);
    if (!deleted) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Message not found');
      return;
    }
    MatchChatGateway.emitDeleted(deleted.matchId, params.data.id);
    res.json({ ok: true });
  },
);

router.post(
  '/admin/users/:userId/warn',
  requireAuth,
  requireAdmin,
  validateZod({ body: z.object({ category: z.string().max(40).optional() }) }),
  async (req: Request, res: Response): Promise<void> => {
    const params = userIdParams.safeParse(req.params);
    if (!params.success) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid user id');
      return;
    }
    const strike = await applyModerationStrike(params.data.userId, 'INSULT');
    if (strike.kind === 'warn') {
      MatchChatGateway.emitWarned(params.data.userId, {
        remainingStrikesUntilFreeze: Math.max(0, MATCH_CHAT_CONFIG.freezeStrikes - strike.strikes),
        category: 'INSULT',
      });
    } else if (strike.frozenUntil && strike.remainingMs != null) {
      MatchChatGateway.emitFrozen(
        params.data.userId,
        new Date(strike.frozenUntil).toISOString(),
        strike.remainingMs,
      );
    }
    res.json({ ok: true, strike });
  },
);

router.post(
  '/admin/users/:userId/freeze',
  requireAuth,
  requireAdmin,
  validateZod({ body: matchChatAdminFreezeSchema.pick({ durationMs: true, reason: true }) }),
  async (req: Request, res: Response): Promise<void> => {
    const params = userIdParams.safeParse(req.params);
    if (!params.success) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid user id');
      return;
    }
    const duration = req.body.durationMs ?? MATCH_CHAT_CONFIG.freezeMs;
    const until = Date.now() + duration;
    await setFrozenUntil(params.data.userId, until);
    MatchChatGateway.emitFrozen(params.data.userId, new Date(until).toISOString(), duration);
    res.json({ ok: true, frozenUntil: new Date(until).toISOString() });
  },
);

router.post(
  '/admin/users/:userId/unfreeze',
  requireAuth,
  requireAdmin,
  validateZod({ body: z.object({}).optional() }),
  async (req: Request, res: Response): Promise<void> => {
    const params = userIdParams.safeParse(req.params);
    if (!params.success) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid user id');
      return;
    }
    await clearFreeze(params.data.userId);
    MatchChatGateway.emitUnfrozen(params.data.userId);
    res.json({ ok: true });
  },
);

export default router;
