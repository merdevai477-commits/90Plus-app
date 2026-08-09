/**
 * Share & Win Routes — شارك واربح
 *
 * Every endpoint resolves the acting user from the auth middleware. A caller
 * can only ever read or affect their OWN referral identity and statistics;
 * share counts, participants, score and rank are computed server-side and are
 * not writable from the client.
 */

import { Router, Request, Response } from 'express';

import { requireAuth } from '../middleware/clerk.middleware';
import { responseCacheMiddleware } from '../middleware/responseCache.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';
import { ensureBackendUserId } from '../utils/ensureBackendUser';
import {
  claimReferral,
  ensureCurrentCycle,
  getCycleByWeekKey,
  getCycleHistory,
  getLeaderboard,
  getMyStanding,
  getShareWinOverview,
  recordShare,
} from '../services/share-win.service';

const router = Router();

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Resolve the DB user id for the authenticated Clerk session. */
async function resolveUserId(req: Request): Promise<string | null> {
  const clerkUserId = req.auth?.userId;
  if (!clerkUserId) return null;
  try {
    return await ensureBackendUserId(clerkUserId);
  } catch (err) {
    logger.error('[ShareWin] Failed to resolve backend user:', err);
    return null;
  }
}

function toPositiveInt(raw: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * GET /api/share-win/me
 * Everything the Share & Win screen needs in one round trip.
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const data = await getShareWinOverview(userId);
    res.json({ success: true, data });
  } catch (err) {
    logger.error('GET /api/share-win/me error:', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * POST /api/share-win/share
 * Record a share by the authenticated user. The body may only hint at the
 * channel — the count itself is derived from server-side rows.
 */
router.post('/share', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const channel = typeof req.body?.channel === 'string' ? req.body.channel : 'system';
    const result = await recordShare(userId, channel);

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('POST /api/share-win/share error:', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * POST /api/share-win/referral/claim
 * Attach a referral code to the authenticated account. Called once, right
 * after registration completes. Rejections are reported as a reason rather
 * than an error — a declined claim is a normal outcome, not a failure.
 */
router.post('/referral/claim', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!code) {
      sendError(req, res, ErrorCode.VALIDATION, 'Referral code is required');
      return;
    }

    const result = await claimReferral(userId, code);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('POST /api/share-win/referral/claim error:', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * GET /api/share-win/leaderboard?weekKey=&limit=&offset=
 * Current cycle by default; pass a weekKey to read an archived week.
 */
router.get(
  '/leaderboard',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const weekKey = param(req.query.weekKey as string | string[] | undefined).trim();
      const cycle = weekKey ? await getCycleByWeekKey(weekKey) : await ensureCurrentCycle();

      if (!cycle) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'Cycle not found');
        return;
      }

      const limit = toPositiveInt(param(req.query.limit as string | string[] | undefined), 25, 50);
      const offset = Math.max(
        0,
        Number.parseInt(param(req.query.offset as string | string[] | undefined), 10) || 0,
      );

      // `me` is only worth computing for the first page — the client keeps it
      // pinned from there and pages never invalidate it.
      const [rows, total, me] = await Promise.all([
        getLeaderboard(cycle.id, limit, offset),
        prisma.shareWinStanding.count({ where: { cycleId: cycle.id } }),
        offset === 0 ? getMyStanding(cycle.id, userId) : Promise.resolve(null),
      ]);

      res.json({
        success: true,
        data: {
          cycle: {
            id: cycle.id,
            weekKey: cycle.weekKey,
            startAt: cycle.startAt.toISOString(),
            endAt: cycle.endAt.toISOString(),
            status: cycle.status,
          },
          entries: rows,
          me,
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total,
        },
      });
    } catch (err) {
      logger.error('GET /api/share-win/leaderboard error:', err);
      sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
  },
);

/**
 * GET /api/share-win/cycles
 * Weekly history with each week's winner. Previous cycles are never removed.
 */
router.get(
  '/cycles',
  requireAuth,
  responseCacheMiddleware({ ttl: 60_000 }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = toPositiveInt(param(req.query.limit as string | string[] | undefined), 12, 52);
      const cycles = await getCycleHistory(limit);
      res.json({ success: true, data: { cycles } });
    } catch (err) {
      logger.error('GET /api/share-win/cycles error:', err);
      sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
  },
);

export default router;
