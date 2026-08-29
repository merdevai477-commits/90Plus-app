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
        sponsor: true,
        category: true,
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
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

export default router;
