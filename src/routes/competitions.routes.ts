/**
 * Predict & Win Routes — توقع واربح
 *
 * Public reads are open; every mutation requires auth, and sponsor-scoped
 * mutations additionally verify ownership in the service layer.
 */

import { Router, Request, Response } from 'express';
import { optionalAuth, requireAuth } from '../middleware/clerk.middleware';
import { responseCacheMiddleware, clearResponseCache } from '../middleware/responseCache.middleware';
import prisma from '../lib/prisma';
import { ErrorCode, sendError, type ErrorCodeValue } from '../constants/errors';
import { logger } from '../utils/logger';
import { POOL_SIZE } from '../services/competition-match-pool.service';
import {
  createCompetition,
  getCompetition,
  getMatchPool,
  listCompetitions,
  listMyCompetitions,
  listPrizeCategories,
  submitPrediction,
  updateOwnCompetition,
  type CompetitionFilter,
  type CompetitionSort,
  type CompetitionTab,
} from '../services/competitions.service';

const router = Router();

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveUser(req: Request) {
  const clerkUserId = req.auth?.userId;
  if (!clerkUserId) return null;
  return prisma.user.findFirst({ where: { clerkUserId }, select: { id: true } });
}

const ERROR_MAP: Record<string, { status: ErrorCodeValue; message: string }> = {
  AUTH_REQUIRED: { status: ErrorCode.AUTHENTICATION, message: 'يجب تسجيل الدخول' },
  FORBIDDEN: { status: ErrorCode.AUTHORIZATION, message: 'غير مسموح' },
  COMPETITION_NOT_FOUND: { status: ErrorCode.NOT_FOUND, message: 'المسابقة غير موجودة' },
  COMPETITION_NOT_OPEN: { status: ErrorCode.CONFLICT, message: 'المسابقة غير متاحة للتوقع' },
  COMPETITION_NOT_DRAFT: { status: ErrorCode.CONFLICT, message: 'المسابقة تمت مراجعتها بالفعل' },
  COMPETITION_SETTLED: { status: ErrorCode.CONFLICT, message: 'تم اعتماد نتيجة المسابقة' },
  DEADLINE_PASSED: { status: ErrorCode.CONFLICT, message: 'انتهى وقت التوقع لهذه المسابقة' },
  MATCH_STARTED: { status: ErrorCode.CONFLICT, message: 'بدأت المباراة، التوقع مغلق' },
  INVALID_PREDICTION: { status: ErrorCode.VALIDATION, message: 'التوقع غير صالح' },
  INVALID_SPONSOR: { status: ErrorCode.VALIDATION, message: 'بيانات الراعي غير صالحة' },
  INVALID_SPONSOR_ADDRESS: {
    status: ErrorCode.VALIDATION,
    message: 'عنوان المتجر مطلوب',
  },
  SPONSOR_DISABLED: { status: ErrorCode.AUTHORIZATION, message: 'حساب الراعي موقوف' },
  SPONSOR_NOT_FOUND: { status: ErrorCode.NOT_FOUND, message: 'الراعي غير موجود' },
  INVALID_PRIZE: { status: ErrorCode.VALIDATION, message: 'بيانات الجائزة غير صالحة' },
  INVALID_CASH_AMOUNT: {
    status: ErrorCode.VALIDATION,
    message: 'مبلغ الجائزة النقدية يجب أن يكون 100 جنيه أو أكثر',
  },
  INVALID_WINNERS_COUNT: { status: ErrorCode.VALIDATION, message: 'عدد الفائزين غير صالح' },
  INVALID_DEADLINE: { status: ErrorCode.VALIDATION, message: 'موعد انتهاء التوقعات غير صالح' },
  DEADLINE_AFTER_KICKOFF: {
    status: ErrorCode.VALIDATION,
    message: 'يجب أن ينتهي التوقع قبل بداية المباراة',
  },
  INVALID_WINDOW: { status: ErrorCode.VALIDATION, message: 'مدة المسابقة غير صالحة' },
  CATEGORY_NOT_FOUND: { status: ErrorCode.VALIDATION, message: 'فئة الجائزة غير موجودة' },
  INVALID_POOL_DATE: { status: ErrorCode.VALIDATION, message: 'تاريخ غير صالح' },
  MATCH_NOT_IN_POOL: {
    status: ErrorCode.VALIDATION,
    message: 'يمكن اختيار مباراة من القائمة اليومية فقط',
  },
  MATCH_NOT_FINISHED: {
    status: ErrorCode.CONFLICT,
    message: 'النتيجة لم تُعتمد بعد',
  },
  ENTRY_NOT_FOUND: { status: ErrorCode.NOT_FOUND, message: 'المشارك غير موجود' },
  ENTRY_NOT_CORRECT: { status: ErrorCode.CONFLICT, message: 'هذا التوقع غير صحيح' },
  ALREADY_AWARDED: { status: ErrorCode.CONFLICT, message: 'تم تربيح هذا المستخدم مسبقاً' },
  WINNERS_FULL: { status: ErrorCode.CONFLICT, message: 'اكتمل عدد الفائزين' },
};

/**
 * Every `message` above is Arabic. The app is bilingual, so the *code* is what
 * the client renders from (`details.code` → `t.predictAndWin.errors[code]`) and
 * the prose is only a fallback for non-app consumers. Omitting the code is what
 * forced the app to display the Arabic sentence in its English build.
 */
export function mapCompetitionError(req: Request, res: Response, err: unknown): void {
  const code = err instanceof Error ? err.message : 'UNKNOWN';
  const mapped = ERROR_MAP[code] ?? { status: ErrorCode.INTERNAL, message: 'Internal server error' };
  if (!ERROR_MAP[code]) logger.error('[Competitions] unhandled error:', err);
  sendError(req, res, mapped.status, mapped.message, {
    code: ERROR_MAP[code] ? code : 'GENERIC',
  });
}

const mapError = mapCompetitionError;

router.get('/prize-categories', responseCacheMiddleware({ ttl: 60_000 }), async (req, res) => {
  try {
    res.json({ success: true, data: await listPrizeCategories() });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.get('/match-pool', requireAuth, async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const matches = await getMatchPool(date);
    res.json({ success: true, data: matches, meta: { poolSize: POOL_SIZE } });
  } catch (err) {
    mapError(req, res, err);
  }
});

/** Competitions owned by the caller's sponsor profile. */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found', { code: 'AUTH_REQUIRED' });
      return;
    }
    res.json({ success: true, data: await listMyCompetitions(user.id) });
  } catch (err) {
    mapError(req, res, err);
  }
});

/**
 * Public list. `optionalAuth` is load-bearing, not decorative: the global
 * `clerkMiddleware()` leaves `req.auth` as a *function*, so `req.auth?.userId`
 * reads as undefined until `requireAuth`/`optionalAuth` replaces it with our
 * enriched object. Without it a signed-in caller looks anonymous — `myEntry`
 * would always come back null and `tab=mine` would always 401.
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    const tab = (typeof req.query.tab === 'string' ? req.query.tab : 'all') as CompetitionTab;
    const filter =
      typeof req.query.filter === 'string' ? (req.query.filter as CompetitionFilter) : undefined;
    const sort =
      typeof req.query.sort === 'string' ? (req.query.sort as CompetitionSort) : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = Number.parseInt(String(req.query.limit ?? ''), 10) || undefined;
    const result = await listCompetitions({
      userId: user?.id ?? null,
      tab,
      filter,
      sort,
      cursor,
      limit,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.get('/:id/leaderboard', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found', { code: 'AUTH_REQUIRED' });
      return;
    }
    const { getOwnerLeaderboard } = await import('../services/competition-award.service');
    const board = await getOwnerLeaderboard(user.id, param(req.params.id));
    res.json({ success: true, data: board });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/:id/award', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found', { code: 'AUTH_REQUIRED' });
      return;
    }
    const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId : '';
    if (!entryId) {
      sendError(req, res, ErrorCode.VALIDATION, 'entryId required', { code: 'ENTRY_NOT_FOUND' });
      return;
    }
    const { awardWinner } = await import('../services/competition-award.service');
    const board = await awardWinner(user.id, param(req.params.id), entryId);
    res.json({ success: true, data: board });
  } catch (err) {
    mapError(req, res, err);
  }
});

/** Public detail. See the note on `GET /` for why `optionalAuth` is required. */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    const competition = await getCompetition(param(req.params.id), user?.id ?? null);
    res.json({ success: true, data: competition });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/:id/predict', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found', { code: 'AUTH_REQUIRED' });
      return;
    }
    const { predictedHomeScore, predictedAwayScore, predictedWinner } = req.body ?? {};
    const entry = await submitPrediction(user.id, param(req.params.id), {
      predictedHomeScore,
      predictedAwayScore,
      predictedWinner,
    });
    await clearResponseCache('/competitions').catch(() => undefined);
    res.json({ success: true, data: entry });
  } catch (err) {
    mapError(req, res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found', { code: 'AUTH_REQUIRED' });
      return;
    }
    const competition = await createCompetition(user.id, req.body ?? {});
    res.status(201).json({ success: true, data: competition });
  } catch (err) {
    mapError(req, res, err);
  }
});

/** Sponsors may revise their own competition while it is still a draft. */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found', { code: 'AUTH_REQUIRED' });
      return;
    }
    const competition = await updateOwnCompetition(user.id, param(req.params.id), req.body ?? {});
    res.json({ success: true, data: competition });
  } catch (err) {
    mapError(req, res, err);
  }
});

export default router;
