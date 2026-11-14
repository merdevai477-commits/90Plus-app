/**
 * /api/ass — human-review desk for Predict & Win ads.
 * Auth is a shared username/password session, not Clerk admin.
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { requireAssSession } from '../middleware/ass-auth.middleware';
import {
  ASS_COOKIE_NAME,
  ASS_SESSION_TTL_SECONDS,
  consumeLoginAttempt,
  createAssSession,
  credentialsMatch,
  destroyAssSession,
  isAssConfigured,
} from '../services/ass-session.service';
import { publishCompetition, rejectCompetition } from '../services/competitions.service';
import {
  AssCommunityError,
  assDeleteCommunityComment,
  assDeleteCommunityPost,
  listAssCommunityComments,
  listAssCommunityPosts,
} from '../services/ass-community.service';
import {
  AssReelError,
  assDeleteReel,
  assDeleteReelComment,
  listAssReelComments,
  listAssReels,
} from '../services/ass-reels.service';
import { getAssOverview } from '../services/ass-overview.service';
import {
  EliteBadgeError,
  awardEliteBadge,
  badgeDeskOverview,
  listBadgeDefinitions,
  revokeEliteBadge,
} from '../services/elite-badge.service';
import { listBadgeCandidates, listBadgeCompetitions } from '../services/elite-badge-candidates.service';
import { clearAppUpdateNotice, getAppUpdateNotice, publishAppUpdateNotice } from '../services/app-update-notice.service';
import type { EliteAwardDuration } from '../data/elite-badge-catalog';

const router = Router();

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ASS_SESSION_TTL_SECONDS * 1000,
  };
}

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.ip || 'unknown';
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  if (!isAssConfigured()) {
    res.status(503).json({ status: 'ERROR', message: 'AsS desk is not configured' });
    return;
  }
  const ip = clientIp(req);
  if (!consumeLoginAttempt(ip)) {
    res.status(429).json({ status: 'ERROR', message: 'Too many attempts' });
    return;
  }
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!credentialsMatch(username, password)) {
    res.status(401).json({ status: 'ERROR', message: 'Invalid credentials' });
    return;
  }
  try {
    const token = await createAssSession();
    res.cookie(ASS_COOKIE_NAME, token, cookieOpts());
    res.json({ status: 'SUCCESS', data: { ok: true } });
  } catch (err: any) {
    logger.error('[AsS] login failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Login failed' });
  }
});

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  await destroyAssSession(req.cookies?.[ASS_COOKIE_NAME]);
  res.clearCookie(ASS_COOKIE_NAME, { path: '/' });
  res.json({ status: 'SUCCESS' });
});

router.get('/me', requireAssSession, (_req: Request, res: Response): void => {
  res.json({ status: 'SUCCESS', data: { ok: true } });
});

const STATUSES = ['DRAFT', 'PUBLISHED', 'LOCKED', 'SETTLED', 'REJECTED', 'CANCELLED'] as const;

router.get('/overview', requireAssSession, async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getAssOverview();
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data });
  } catch (err) {
    logger.error('[AsS] overview failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load overview' });
  }
});

router.get('/competitions', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'DRAFT';
    const status = STATUSES.includes(statusRaw as (typeof STATUSES)[number])
      ? (statusRaw as (typeof STATUSES)[number])
      : undefined;
    const take = Math.min(Number.parseInt(String(req.query.limit ?? ''), 10) || 80, 200);
    const competitions = await prisma.competition.findMany({
      where: status ? { status } : {},
      include: {
        sponsor: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                displayName: true,
                email: true,
                avatar: true,
              },
            },
            _count: { select: { followers: true, competitions: true } },
          },
        },
        category: true,
        _count: { select: { entries: true, views: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data: competitions });
  } catch (err) {
    logger.error('[AsS] list competitions failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load competitions' });
  }
});

router.get('/activity', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const take = Math.min(Number.parseInt(String(req.query.limit ?? ''), 10) || 60, 200);
    const rows = await prisma.competitionActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        competition: {
          select: {
            id: true,
            prizeName: true,
            prizeImageUrl: true,
            status: true,
            sponsor: { select: { name: true } },
          },
        },
      },
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data: rows });
  } catch (err) {
    logger.error('[AsS] activity failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load activity' });
  }
});

router.post('/competitions/:id/publish', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const published = await publishCompetition(id);
    res.json({ status: 'SUCCESS', data: published });
  } catch (err: any) {
    const code = err?.message;
    if (code === 'COMPETITION_NOT_FOUND') {
      res.status(404).json({ status: 'ERROR', message: 'Not found' });
      return;
    }
    if (code === 'COMPETITION_NOT_DRAFT') {
      res.status(409).json({ status: 'ERROR', message: 'Already reviewed' });
      return;
    }
    logger.error('[AsS] publish failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to publish' });
  }
});

router.post('/competitions/:id/reject', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    const rejected = await rejectCompetition(id, reason);
    res.json({ status: 'SUCCESS', data: rejected });
  } catch (err: any) {
    const code = err?.message;
    if (code === 'COMPETITION_NOT_FOUND') {
      res.status(404).json({ status: 'ERROR', message: 'Not found' });
      return;
    }
    if (code === 'COMPETITION_NOT_DRAFT') {
      res.status(409).json({ status: 'ERROR', message: 'Already reviewed' });
      return;
    }
    logger.error('[AsS] reject failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to reject' });
  }
});

router.get('/community/posts', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const filterRaw = typeof req.query.filter === 'string' ? req.query.filter : 'all';
    const orderRaw = typeof req.query.order === 'string' ? req.query.order : 'newest';
    const filter = filterRaw === 'reported' || filterRaw === 'ai' ? filterRaw : 'all';
    const order = orderRaw === 'oldest' ? 'oldest' : 'newest';
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? ''), 10) || 80, 200);
    const posts = await listAssCommunityPosts({ filter, order, limit });
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data: posts });
  } catch (err) {
    logger.error('[AsS] list community posts failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load posts' });
  }
});

router.post('/community/posts/:id/delete', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    const result = await assDeleteCommunityPost(id, reason);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    if (err instanceof AssCommunityError) {
      res.status(err.status).json({ status: 'ERROR', message: err.message, code: err.code });
      return;
    }
    logger.error('[AsS] delete community post failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete post' });
  }
});

router.get('/community/comments', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const filterRaw = typeof req.query.filter === 'string' ? req.query.filter : 'all';
    const orderRaw = typeof req.query.order === 'string' ? req.query.order : 'newest';
    const filter = filterRaw === 'reported' || filterRaw === 'ai' ? filterRaw : 'all';
    const order = orderRaw === 'oldest' ? 'oldest' : 'newest';
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? ''), 10) || 80, 200);
    const comments = await listAssCommunityComments({ filter, order, limit });
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data: comments });
  } catch (err) {
    logger.error('[AsS] list community comments failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load comments' });
  }
});

function assContentFilter(raw: unknown): 'all' | 'reported' | 'ai' {
  return raw === 'reported' || raw === 'ai' ? raw : 'all';
}

router.get('/reels', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderRaw = typeof req.query.order === 'string' ? req.query.order : 'newest';
    const reels = await listAssReels({
      filter: assContentFilter(req.query.filter),
      order: orderRaw === 'oldest' ? 'oldest' : 'newest',
      limit: Math.min(Number.parseInt(String(req.query.limit ?? ''), 10) || 80, 200),
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data: reels });
  } catch (err) {
    logger.error('[AsS] list reels failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load reels' });
  }
});

router.post('/reels/:id/delete', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    const result = await assDeleteReel(id, reason);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    if (err instanceof AssReelError) {
      res.status(err.status).json({ status: 'ERROR', message: err.message, code: err.code });
      return;
    }
    logger.error('[AsS] delete reel failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete reel' });
  }
});

router.get('/reels/comments', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderRaw = typeof req.query.order === 'string' ? req.query.order : 'newest';
    const comments = await listAssReelComments({
      filter: assContentFilter(req.query.filter),
      order: orderRaw === 'oldest' ? 'oldest' : 'newest',
      limit: Math.min(Number.parseInt(String(req.query.limit ?? ''), 10) || 80, 200),
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data: comments });
  } catch (err) {
    logger.error('[AsS] list reel comments failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load reel comments' });
  }
});

router.post('/reels/comments/:id/delete', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    const result = await assDeleteReelComment(id, reason);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    if (err instanceof AssReelError) {
      res.status(err.status).json({ status: 'ERROR', message: err.message, code: err.code });
      return;
    }
    logger.error('[AsS] delete reel comment failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete reel comment' });
  }
});

router.post('/community/comments/:id/delete', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    const result = await assDeleteCommunityComment(id, reason);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    if (err instanceof AssCommunityError) {
      res.status(err.status).json({ status: 'ERROR', message: err.message, code: err.code });
      return;
    }
    logger.error('[AsS] delete community comment failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete comment' });
  }
});

router.get('/badges/definitions', requireAssSession, async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await listBadgeDefinitions();
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data });
  } catch (err) {
    logger.error('[AsS] badge definitions failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load badges' });
  }
});

router.get('/badges/overview', requireAssSession, async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await badgeDeskOverview();
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data });
  } catch (err) {
    logger.error('[AsS] badge overview failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load badge overview' });
  }
});

router.get('/badges/competitions', requireAssSession, async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await listBadgeCompetitions();
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data });
  } catch (err) {
    logger.error('[AsS] badge competitions failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load competitions' });
  }
});

router.get('/badges/candidates', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : 'points';
    const period = req.query.period === '7d' || req.query.period === '30d' ? req.query.period : 'all';
    const competitionId = typeof req.query.competitionId === 'string' ? req.query.competitionId : null;
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const data = await listBadgeCandidates({ category, period, competitionId, query });
    res.set('Cache-Control', 'private, no-store');
    res.json({ status: 'SUCCESS', data });
  } catch (err) {
    logger.error('[AsS] badge candidates failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to load candidates' });
  }
});

router.post('/badges/awards', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const duration: EliteAwardDuration =
      req.body?.duration === '7' || req.body?.duration === '30' ? req.body.duration : 'permanent';
    const result = await awardEliteBadge({
      userId: String(req.body?.userId || ''),
      badgeKey: String(req.body?.badgeKey || ''),
      customTitle: String(req.body?.customTitle || ''),
      description: typeof req.body?.description === 'string' ? req.body.description : null,
      duration,
      competitionId: typeof req.body?.competitionId === 'string' ? req.body.competitionId : null,
      actor: 'ass',
    });
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    if (err instanceof EliteBadgeError) {
      res.status(err.status).json({ status: 'ERROR', message: err.message, code: err.code });
      return;
    }
    logger.error('[AsS] award badge failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to award badge' });
  }
});

router.post('/badges/awards/:id/revoke', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await revokeEliteBadge(id, 'ass');
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    if (err instanceof EliteBadgeError) {
      res.status(err.status).json({ status: 'ERROR', message: err.message, code: err.code });
      return;
    }
    logger.error('[AsS] revoke badge failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to revoke badge' });
  }
});

router.get('/app-update', requireAssSession, async (_req: Request, res: Response): Promise<void> => {
  const notice = await getAppUpdateNotice();
  res.json({ status: 'SUCCESS', data: notice });
});

router.post('/app-update', requireAssSession, async (req: Request, res: Response): Promise<void> => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 2 || message.length > 280) {
    res.status(400).json({ status: 'ERROR', message: 'اكتب رسالة التحديث (من حرفين إلى 280)' });
    return;
  }
  const notice = await publishAppUpdateNotice(message);
  res.json({ status: 'SUCCESS', data: notice });
});

router.post('/app-update/clear', requireAssSession, async (_req: Request, res: Response): Promise<void> => {
  await clearAppUpdateNotice();
  res.json({ status: 'SUCCESS' });
});

export default router;
