/**
 * Top Scorers Five ("خماسي الهدافين") routes — mounted at /api/top-scorers-five.
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { ErrorCode, sendError, type ErrorCodeValue } from '../constants/errors';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import {
  TopScorersFiveError,
  clearTsfSelection,
  getTsfLeaderboard,
  getTsfMyFixtures,
  getTsfSelection,
  getTsfUserScore,
  listTsfEligiblePlayers,
  listTsfPlayerFixtures,
  listTsfUpcomingFixtures,
  saveTsfSelection,
  type TsfErrorCode,
  type TsfLanguage,
} from '../services/top-scorers-five.service';
import { processTopScorersFive, syncTsfPickFixtures } from '../services/top-scorers-five-processing.service';
import { resolveTopScorersFivePool, seedTopScorersFivePool } from '../services/top-scorers-five-pool.service';
import { getTsfLeagueConfig, type TsfLeagueKey } from '../services/top-scorers-five-scoring';

const router = Router();

const ERROR_MAP: Record<TsfErrorCode, ErrorCodeValue> = {
  USER_NOT_FOUND: ErrorCode.NOT_FOUND,
  LEAGUE_NOT_SUPPORTED: ErrorCode.NOT_FOUND,
  PLAYER_NOT_FOUND: ErrorCode.NOT_FOUND,
  PLAYER_NOT_ELIGIBLE: ErrorCode.VALIDATION,
  PLAYER_UNRESOLVED: ErrorCode.VALIDATION,
  GAMEWEEK_LOCKED: ErrorCode.CONFLICT,
  GAMEWEEK_PICK_LOCKED: ErrorCode.CONFLICT,
};

function language(req: Request): TsfLanguage {
  const raw = String(req.query.lang ?? req.headers['accept-language'] ?? 'ar').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'ar';
}

function handle(label: string, fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof TopScorersFiveError) {
        sendError(req, res, ERROR_MAP[error.code], error.message, { reason: error.code });
        return;
      }
      logger.error(`[TopScorersFive] ${label} failed:`, error);
      sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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

/** A. GET /leagues/:leagueKey/players — the league's eligible players. */
router.get('/leagues/:leagueKey/players', handle('players', async (req, res) => {
  const data = await listTsfEligiblePlayers(String(req.params.leagueKey), language(req));
  res.json({ success: true, data });
}));

/** B + D. GET /leagues/:leagueKey/selection — my pick and its gameweek score. */
router.get('/leagues/:leagueKey/selection', requireAuth, handle('get selection', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  const data = await getTsfSelection(id, String(req.params.leagueKey), language(req));
  res.json({ success: true, data });
}));

/**
 * C. PUT /leagues/:leagueKey/selection { playerId } — confirm the pick; final
 * for the gameweek. Only `playerId` is read: the gameweek, lock and points are
 * the server's.
 */
router.put('/leagues/:leagueKey/selection', requireAuth, handle('save selection', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  const playerId = typeof req.body?.playerId === 'string' ? req.body.playerId.trim() : '';
  if (!playerId) {
    sendError(req, res, ErrorCode.VALIDATION, 'playerId is required');
    return;
  }
  const leagueKey = String(req.params.leagueKey);
  const data = await saveTsfSelection(id, leagueKey, playerId, language(req));
  res.json({ success: true, data });
  syncTsfPickFixtures(leagueKey, data.selection?.player.teamId ?? null).catch((error) =>
    logger.warn(`[TopScorersFive] fixture sync after confirm failed: ${(error as Error)?.message}`),
  );
}));

/** GET /leagues/:leagueKey/fixtures/upcoming — the league's fixtures in the next 7 days. */
router.get('/leagues/:leagueKey/fixtures/upcoming', handle('upcoming fixtures', async (req, res) => {
  res.json({ success: true, data: await listTsfUpcomingFixtures(String(req.params.leagueKey)) });
}));

/** GET /me/fixtures — only the fixtures of my picked players, with their results once stored. */
router.get('/me/fixtures', requireAuth, handle('my fixtures', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  res.json({ success: true, data: await getTsfMyFixtures(id, language(req)) });
}));

/** DELETE /leagues/:leagueKey/selection — drop an unconfirmed pick while open. */
router.delete('/leagues/:leagueKey/selection', requireAuth, handle('clear selection', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  await clearTsfSelection(id, String(req.params.leagueKey));
  res.json({ success: true });
}));

/** E. GET /me/score — my total across leagues and gameweeks. */
router.get('/me/score', requireAuth, handle('score', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  res.json({ success: true, data: await getTsfUserScore(id) });
}));

/** GET /leaderboard?period=week|all&limit=50 */
router.get('/leaderboard', requireAuth, handle('leaderboard', async (req, res) => {
  const id = clerkId(req, res);
  if (!id) return;
  const period = req.query.period === 'all' ? 'all' : 'week';
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
  res.json({ success: true, data: await getTsfLeaderboard({ clerkUserId: id, period, limit }) });
}));

/** GET /players/:playerId/fixtures — the player's club's next league fixtures. */
router.get('/players/:playerId/fixtures', handle('fixtures', async (req, res) => {
  res.json({ success: true, data: await listTsfPlayerFixtures(String(req.params.playerId)) });
}));

// ─── Admin ──────────────────────────────────────────────────────────────────

function adminLeague(req: Request, res: Response): TsfLeagueKey | null {
  const key = String(req.body?.leagueKey ?? req.query.leagueKey ?? '');
  const cfg = getTsfLeagueConfig(key);
  if (!cfg) {
    sendError(req, res, ErrorCode.VALIDATION, 'Unsupported leagueKey');
    return null;
  }
  return cfg.key;
}

/** F. POST /admin/process { leagueKey? } — run the scoring pass now. */
router.post('/admin/process', requireAuth, requireAdmin, handle('process', async (req, res) => {
  const leagueKey = typeof req.body?.leagueKey === 'string' ? req.body.leagueKey : undefined;
  res.json({ success: true, data: await processTopScorersFive({ leagueKey }) });
}));

/** GET /admin/players?leagueKey= — the full pool, resolved or not. */
router.get('/admin/players', requireAuth, requireAdmin, handle('admin players', async (req, res) => {
  const leagueKey = adminLeague(req, res);
  if (!leagueKey) return;
  const data = await prisma.topScorersFivePlayer.findMany({ where: { leagueKey }, orderBy: { sortOrder: 'asc' } });
  res.json({ success: true, data });
}));

/** POST /admin/players/seed { leagueKey } — upsert the supplied list, then resolve. */
router.post('/admin/players/seed', requireAuth, requireAdmin, handle('seed', async (req, res) => {
  const leagueKey = adminLeague(req, res);
  if (!leagueKey) return;
  const seeded = await seedTopScorersFivePool(leagueKey);
  const resolved = await resolveTopScorersFivePool(leagueKey);
  res.json({ success: true, data: { ...seeded, resolved } });
}));

/** POST /admin/players/resolve { leagueKey, force? } — (re)link names to athlete ids. */
router.post('/admin/players/resolve', requireAuth, requireAdmin, handle('resolve', async (req, res) => {
  const leagueKey = adminLeague(req, res);
  if (!leagueKey) return;
  res.json({ success: true, data: await resolveTopScorersFivePool(leagueKey, { force: req.body?.force === true }) });
}));

/** POST /admin/players { leagueKey, nameAr, clubNameAr, teamId, nameEn?, clubNameEn? } */
router.post('/admin/players', requireAuth, requireAdmin, handle('create player', async (req, res) => {
  const leagueKey = adminLeague(req, res);
  if (!leagueKey) return;
  const { nameAr, clubNameAr, teamId, nameEn, clubNameEn } = req.body ?? {};
  if (typeof nameAr !== 'string' || !nameAr.trim() || typeof clubNameAr !== 'string' || !clubNameAr.trim()) {
    sendError(req, res, ErrorCode.VALIDATION, 'nameAr and clubNameAr are required');
    return;
  }
  const last = await prisma.topScorersFivePlayer.findFirst({ where: { leagueKey }, orderBy: { sortOrder: 'desc' } });
  const player = await prisma.topScorersFivePlayer.create({
    data: {
      leagueKey,
      nameAr: nameAr.trim(),
      clubNameAr: clubNameAr.trim(),
      nameEn: typeof nameEn === 'string' ? nameEn.trim() || null : null,
      clubNameEn: typeof clubNameEn === 'string' ? clubNameEn.trim() || null : null,
      teamId: Number.isFinite(Number(teamId)) ? Number(teamId) : null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  res.status(201).json({ success: true, data: player });
}));

/** PATCH /admin/players/:id — fix a link by hand, rename, or deactivate. */
router.patch('/admin/players/:id', requireAuth, requireAdmin, handle('update player', async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};
  for (const key of ['nameAr', 'nameEn', 'clubNameAr', 'clubNameEn', 'photoUrl', 'position'] as const) {
    if (typeof body[key] === 'string') data[key] = body[key].trim() || null;
  }
  for (const key of ['teamId', 'externalPlayerId', 'sortOrder'] as const) {
    if (body[key] === null) data[key] = null;
    else if (Number.isFinite(Number(body[key]))) data[key] = Number(body[key]);
  }
  if (typeof body.active === 'boolean') data.active = body.active;
  if (data.externalPlayerId != null) {
    data.resolvedAt = new Date();
    data.resolveNote = 'manual';
  }
  const player = await prisma.topScorersFivePlayer.update({ where: { id: String(req.params.id) }, data });
  res.json({ success: true, data: player });
}));

export default router;
