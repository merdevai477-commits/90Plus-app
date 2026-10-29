/**
 * King of Coaches ("ملك المدربين") — mounted at /api/coach-king.
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { ErrorCode, sendError, type ErrorCodeValue } from '../constants/errors';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { CoachKingError, type CkErrorCode, type CkLanguage } from '../services/coach-king.service';
import {
  coachKingLeaderboard,
  getCoachKingHome,
  getCoachKingUserSquad,
  listCoachKingCoaches,
  listCoachKingFixtures,
  listCoachKingPlayers,
  pickCoachKingCoach,
  pickCoachKingSlot,
  resetCoachKingCompetition,
} from '../services/coach-king.service';
import { syncCoachKingPool } from '../services/coach-king-pool.service';
import { processCoachKing } from '../services/coach-king-processing.service';

const router = Router();

const ERROR_MAP: Record<CkErrorCode, ErrorCodeValue> = {
  USER_NOT_FOUND: ErrorCode.NOT_FOUND,
  PLAYER_NOT_FOUND: ErrorCode.NOT_FOUND,
  COACH_NOT_FOUND: ErrorCode.NOT_FOUND,
  SQUAD_LOCKED: ErrorCode.CONFLICT,
  SLOT_LOCKED: ErrorCode.CONFLICT,
  INCOMPLETE: ErrorCode.VALIDATION,
  DUPLICATE_PLAYER: ErrorCode.VALIDATION,
  BAD_SLOT: ErrorCode.VALIDATION,
  WRONG_LINE: ErrorCode.VALIDATION,
  BUDGET: ErrorCode.VALIDATION,
  CLUB_LIMIT: ErrorCode.VALIDATION,
  MISSING_COACH: ErrorCode.VALIDATION,
  MATCH_STARTED: ErrorCode.CONFLICT,
};

function language(req: Request): CkLanguage {
  const raw = String(req.query.lang ?? req.headers['accept-language'] ?? 'ar').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'ar';
}

function handle(label: string, fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof CoachKingError) {
        sendError(req, res, ERROR_MAP[error.code], error.message, { reason: error.code });
        return;
      }
      const detail = error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 180) : 'Internal server error';
      logger.error(`[CoachKing] ${label} failed:`, error);
      sendError(req, res, ErrorCode.INTERNAL, 'Internal server error', { reason: detail });
    }
  };
}

function clerkId(req: Request, res: Response): string | null {
  const id = req.auth?.userId;
  if (!id) {
    sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
    return null;
  }
  return id;
}

router.get('/players', requireAuth, handle('players', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  const line = String(req.query.line ?? 'FWD');
  const q = String(req.query.q ?? '');
  res.json({ success: true, data: await listCoachKingPlayers(line, language(req), q) });
}));

router.get('/coaches', requireAuth, handle('coaches', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  res.json({ success: true, data: await listCoachKingCoaches(language(req), String(req.query.q ?? '')) });
}));

router.get('/me', requireAuth, handle('home', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  res.json({ success: true, data: await getCoachKingHome(id, language(req)) });
}));

router.post('/me/slot', requireAuth, handle('pick slot', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  const slotKey = req.body?.slotKey;
  const playerId = req.body?.playerId;
  if (typeof slotKey !== 'string' || typeof playerId !== 'string') {
    sendError(req, res, ErrorCode.VALIDATION, 'slotKey and playerId are required');
    return;
  }
  res.json({ success: true, data: await pickCoachKingSlot(id, { slotKey, playerId }, language(req)) });
}));

router.post('/me/coach', requireAuth, handle('pick coach', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  const coachId = req.body?.coachId;
  if (typeof coachId !== 'string') {
    sendError(req, res, ErrorCode.VALIDATION, 'coachId is required');
    return;
  }
  res.json({ success: true, data: await pickCoachKingCoach(id, coachId, language(req)) });
}));

router.get('/users/:userId/squad', requireAuth, handle('user squad', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  res.json({ success: true, data: await getCoachKingUserSquad(String(req.params.userId), language(req)) });
}));

router.get('/me/fixtures', requireAuth, handle('fixtures', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  res.json({ success: true, data: await listCoachKingFixtures(id, language(req)) });
}));

router.get('/leaderboard', requireAuth, handle('leaderboard', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  const period = req.query.period === 'all' ? 'all' : 'week';
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const user = await prisma.user.findFirst({ where: { clerkUserId: id }, select: { id: true } });
  const rows = await coachKingLeaderboard(period, limit);
  res.json({
    success: true,
    data: rows.map((row) => ({
      rank: row.rank,
      userId: row.userId,
      username: row.username,
      name: row.name,
      avatar: row.avatar,
      level: row.level,
      points: period === 'week' ? row.weekPoints : row.points,
      weekPoints: row.weekPoints,
      totalPoints: row.points,
      isMe: row.userId === user?.id,
    })),
  });
}));

router.post('/admin/sync', requireAuth, requireAdmin, handle('sync', async (_req, res) => {
  res.json({ success: true, data: await syncCoachKingPool() });
}));

router.post('/admin/reset', requireAuth, requireAdmin, handle('reset', async (_req, res) => {
  res.json({ success: true, data: await resetCoachKingCompetition() });
}));

router.post('/admin/process', requireAuth, requireAdmin, handle('process', async (_req, res) => {
  await processCoachKing();
  res.json({ success: true, data: { ok: true } });
}));

export default router;
