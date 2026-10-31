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
import { requireAdmin } from '../middleware/rbac.middleware';
import { responseCacheMiddleware } from '../middleware/responseCache.middleware';
import { writeLimiter } from '../middleware/rateLimit.middleware';
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
  type ReferralClaimSource,
} from '../services/share-win.service';
import { markInviteFirstOpen } from '../services/share-win-invite-click.service';
import { getShareWinFunnel } from '../services/share-win-funnel.service';

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
 * POST /api/share-win/referral/first-open
 * Public, rate-limited. Marks installed_at on a click row. Always 200 neutral.
 */
router.post(
  '/referral/first-open',
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clickId =
        typeof req.body?.click_id === 'string'
          ? req.body.click_id
          : typeof req.body?.clickId === 'string'
            ? req.body.clickId
            : '';
      await markInviteFirstOpen({
        clickId,
        installId:
          typeof req.body?.install_id === 'string'
            ? req.body.install_id
            : typeof req.body?.installId === 'string'
              ? req.body.installId
              : null,
        platform: typeof req.body?.platform === 'string' ? req.body.platform : null,
        appVersion:
          typeof req.body?.app_version === 'string'
            ? req.body.app_version
            : typeof req.body?.appVersion === 'string'
              ? req.body.appVersion
              : null,
      });
    } catch (err) {
      logger.error('POST /api/share-win/referral/first-open error:', err);
    }
    res.status(200).json({ success: true, data: { ok: true } });
  },
);

/**
 * POST /api/share-win/referral/claim
 * Attach a referral (code and/or click_id) to the authenticated account.
 * Optional fields keep old app builds working (code only).
 */
router.post('/referral/claim', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const clickId =
      typeof req.body?.click_id === 'string'
        ? req.body.click_id
        : typeof req.body?.clickId === 'string'
          ? req.body.clickId
          : null;
    if (!code && !clickId) {
      sendError(req, res, ErrorCode.VALIDATION, 'Referral code or click_id is required');
      return;
    }

    const rawSource = typeof req.body?.source === 'string' ? req.body.source : 'manual';
    const allowed: ReferralClaimSource[] = [
      'deferred',
      'deeplink',
      'webhook',
      'web',
      'manual',
    ];
    const source = (allowed.includes(rawSource as ReferralClaimSource)
      ? rawSource
      : 'manual') as ReferralClaimSource;

    const result = await claimReferral({
      referredUserId: userId,
      code: code || null,
      clickId,
      source,
      appVersion:
        typeof req.body?.app_version === 'string'
          ? req.body.app_version
          : typeof req.body?.appVersion === 'string'
            ? req.body.appVersion
            : null,
      platform: typeof req.body?.platform === 'string' ? req.body.platform : null,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('POST /api/share-win/referral/claim error:', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * GET /api/share-win/admin/funnel?days=7
 * Admin-only click → install → register funnel.
 */
router.get(
  '/admin/funnel',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const days = toPositiveInt(param(req.query.days as string | string[] | undefined), 7, 90);
      const data = await getShareWinFunnel(days);
      res.json({ success: true, data });
    } catch (err) {
      logger.error('GET /api/share-win/admin/funnel error:', err);
      sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
  },
);

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
