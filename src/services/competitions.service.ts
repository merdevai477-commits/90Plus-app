/**
 * Predict & Win (توقع واربح) — sponsored prediction competitions.
 *
 * Errors are thrown as `Error(CODE)` and mapped to HTTP responses by the
 * route layer, matching the `prediction-groups.service.ts` convention.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { calendarDayBounds, calendarTodayKey } from '../utils/calendar-day-bounds.util';
import { DEFAULT_PRIZE_CATEGORIES } from '../data/prize-categories';
import { logger } from '../utils/logger';
import {
  findInPool,
  getPoolForDate,
  getUpcomingPool,
  type PoolMatch,
} from './competition-match-pool.service';

export type CompetitionTab = 'all' | 'today' | 'mine' | 'sponsored';
export type CompetitionFilter = 'daily' | 'free' | 'sponsored' | 'popular';
/**
 * Orderings offered by the hub's sort dropdown (Figma `Component 10`), whose
 * default label is "الأحدث". `closing` is the ordering the list used before the
 * control existed and stays available.
 */
export type CompetitionSort = 'newest' | 'closing' | 'popular';

export const COMPETITION_TABS: CompetitionTab[] = ['all', 'today', 'mine', 'sponsored'];
export const COMPETITION_FILTERS: CompetitionFilter[] = ['daily', 'free', 'sponsored', 'popular'];
export const COMPETITION_SORTS: CompetitionSort[] = ['newest', 'closing', 'popular'];

export interface SponsorInput {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  hasDelivery?: boolean;
  socialLinks?: Record<string, string> | null;
}

export interface CreateCompetitionInput {
  /** Required for sponsor self-service; admin creation supplies `sponsorId`. */
  sponsor?: SponsorInput;
  categoryId: string;
  prizeName: string;
  prizeImageUrl?: string | null;
  prizeType: string;
  prizeDescription?: string | null;
  winnersCount: number;
  apiMatchId: number;
  predictionDeadline: string | Date;
  predictionMode?: 'WINNER' | 'EXACT_SCORE';
  /** Competition window; `startAt` defaults to publication time. */
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  /** Free-form entry conditions. */
  rules?: string | null;
  isFree?: boolean;
  /** Pool day the match is chosen from. Defaults to today. */
  poolDate?: string;
}

export interface SubmitPredictionInput {
  predictedHomeScore?: number | null;
  predictedAwayScore?: number | null;
  predictedWinner?: 'home' | 'draw' | 'away' | null;
}

/** Public list shape — never leaks unpublished (DRAFT/REJECTED) rows. */
const PUBLIC_STATUSES: Prisma.EnumCompetitionStatusFilter = {
  in: ['PUBLISHED', 'LOCKED', 'SETTLED'],
};

/**
 * Detail adds CANCELLED. A competition is cancelled when its match is
 * postponed or abandoned, and hiding it outright stranded everyone who had
 * already entered: their notification deep-link and their "تحدياتي" card both
 * landed on "المسابقة غير موجودة" instead of "أُلغيت المسابقة". It stays out
 * of the browse list — it just remains readable to anyone holding its id.
 */
const READABLE_STATUSES: Prisma.EnumCompetitionStatusFilter = {
  in: ['PUBLISHED', 'LOCKED', 'SETTLED', 'CANCELLED'],
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "تحديات اليوم" must mean *the app's* calendar day (Africa/Cairo by default),
 * not the server's. Railway runs UTC, so `new Date().setHours(0,0,0,0)` would
 * put a 01:00 Cairo kickoff on the previous day and drop it out of the Today
 * tab — and it would disagree with the match pool, which is keyed on the same
 * app calendar day as the fixture cache.
 */
function todayBounds(): { start: Date; end: Date } {
  return calendarDayBounds(calendarTodayKey());
}

export async function listPrizeCategories() {
  try {
    const existing = await prisma.prizeCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (existing.length > 0) return existing;

    await Promise.all(
      DEFAULT_PRIZE_CATEGORIES.map((category) =>
        prisma.prizeCategory.upsert({
          where: { key: category.key },
          create: category,
          update: {
            nameAr: category.nameAr,
            nameEn: category.nameEn,
            description: category.description,
            descriptionEn: category.descriptionEn,
            sortOrder: category.sortOrder,
            isActive: true,
          },
        }),
      ),
    );

    return prisma.prizeCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  } catch (error: any) {
    if (error?.code === 'P2021') {
      logger.error(
        '[Competitions] prize_categories table missing — apply the Predict & Win migration',
      );
    }
    throw error;
  }
}

/**
 * With no `date` this returns the whole upcoming window (today's remaining
 * fixtures plus the next few days) rather than only today, so a sponsor can
 * schedule a challenge for a future match. Every entry is guaranteed to kick
 * off in the future — see `getPoolForDate`.
 */
export async function getMatchPool(dateString?: string): Promise<PoolMatch[]> {
  return dateString ? getPoolForDate(dateString) : getUpcomingPool();
}

export async function listCompetitions(params: {
  userId?: string | null;
  tab?: CompetitionTab;
  filter?: CompetitionFilter;
  sort?: CompetitionSort;
  cursor?: string;
  limit?: number;
}) {
  const { userId, cursor } = params;
  const tab: CompetitionTab = COMPETITION_TABS.includes(params.tab as CompetitionTab)
    ? (params.tab as CompetitionTab)
    : 'all';
  const filter = COMPETITION_FILTERS.includes(params.filter as CompetitionFilter)
    ? (params.filter as CompetitionFilter)
    : undefined;
  const sort = COMPETITION_SORTS.includes(params.sort as CompetitionSort)
    ? (params.sort as CompetitionSort)
    : undefined;
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);

  // A disabled sponsor's competitions disappear from every public surface.
  const sponsorWhere: Prisma.SponsorWhereInput = { isActive: true };
  const where: Prisma.CompetitionWhereInput = { status: PUBLIC_STATUSES, sponsor: sponsorWhere };

  if (tab === 'today' || filter === 'daily') {
    const { start, end } = todayBounds();
    where.matchDate = { gte: start, lte: end };
  }
  if (tab === 'sponsored' || filter === 'sponsored') {
    sponsorWhere.isVerified = true;
  }
  if (filter === 'free') {
    where.isFree = true;
  }
  if (tab === 'mine') {
    if (!userId) throw new Error('AUTH_REQUIRED');

    /**
     * "تحدياتي" means both halves of "mine":
     *
     *  - competitions the user **entered**, and
     *  - competitions their sponsor profile **created**.
     *
     * Only the first half was implemented, and a sponsor's own competition is
     * created as `DRAFT` — which appears in no visible status set anywhere.
     * The wizard therefore ended with "سيتم مراجعتها ونشرها قريباً" and the
     * submission then vanished completely: not in the hub (DRAFT is not
     * public, correctly), and not in the one tab named after them either. The
     * sponsor had no way to tell a successful submission from a failed one.
     *
     * DRAFT stays out of every *public* surface — that rule is unchanged. It
     * is only visible to the sponsor who owns it, on their own tab.
     */
    const ownedSponsor = await prisma.sponsor.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    where.OR = [
      {
        entries: { some: { userId } },
        // A competition the user entered stays listed after its match was
        // postponed — it must not silently vanish from their own history.
        status: READABLE_STATUSES,
        // This block runs after the sponsor filters above have finalised this
        // object, so `filter=sponsored` still narrows the entered half.
        sponsor: sponsorWhere,
      },
      ...(ownedSponsor
        ? [
            {
              // Any status, including DRAFT and REJECTED: this is the sponsor's
              // own submission and its review state is the point of showing it.
              // The `isActive` gate is skipped too — a suspended sponsor still
              // needs to see what they have in the system.
              sponsorId: ownedSponsor.id,
            },
          ]
        : []),
    ];
    // Both branches carry their own status/sponsor rules, so the top-level ones
    // must not also apply — they would re-hide the DRAFT rows.
    delete where.status;
    delete where.sponsor;
  }


  /**
   * `id` is the tiebreaker so cursor paging stays stable when the primary sort
   * key ties across rows.
   *
   * The `popular` *filter* keeps implying the popular ordering: it is the
   * "مئات المشاركين" tile, whose whole point is most-joined-first, and it
   * behaved that way before the sort control existed. An explicit `sort`
   * overrides it.
   */
  const effectiveSort: CompetitionSort =
    sort ?? (filter === 'popular' ? 'popular' : 'newest');
  const orderBy: Prisma.CompetitionOrderByWithRelationInput[] =
    effectiveSort === 'popular'
      ? [{ participantsCount: 'desc' }, { id: 'asc' }]
      : effectiveSort === 'closing'
        ? [{ predictionDeadline: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'asc' }];

  const items = await prisma.competition.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      sponsor: true,
      category: true,
      ...(userId ? { entries: { where: { userId } } } : {}),
    },
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  return {
    items: page.map(({ entries, ...c }: any) => ({ ...c, myEntry: entries?.[0] ?? null })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getCompetition(id: string, userId?: string | null) {
  /**
   * The sponsor who owns a competition can open it in any state, including the
   * `DRAFT` it is created in. "تحدياتي" lists their own submissions, so without
   * this the card they can see answers `COMPETITION_NOT_FOUND` when tapped.
   * Everyone else still gets the readable set only.
   */
  const competition = await prisma.competition.findFirst({
    where: {
      id,
      OR: [
        { status: READABLE_STATUSES, sponsor: { isActive: true } },
        ...(userId ? [{ sponsor: { ownerId: userId } }] : []),
      ],
    },
    include: {
      sponsor: true,
      category: true,
      ...(userId ? { entries: { where: { userId } } } : {}),
    },
  });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  const ownerId = competition.sponsor?.ownerId ?? null;
  if (userId && ownerId !== userId) {
    void recordUniqueView(id, userId).catch(() => undefined);
  }
  const { entries, ...rest } = competition as any;
  return { ...rest, myEntry: entries?.[0] ?? null };
}

/** Count a unique authenticated viewer once. Owner views are ignored by the caller. */
async function recordUniqueView(competitionId: string, userId: string): Promise<void> {
  const created = await prisma.competitionView.createMany({
    data: { competitionId, userId },
    skipDuplicates: true,
  });
  if (created.count === 0) return;
  await prisma.competition.update({
    where: { id: competitionId },
    data: { viewsCount: { increment: 1 } },
  });
}

/**
 * Records a prediction. Every gate is enforced here, not just in the UI:
 * competition open, sponsor active, deadline not passed, and kickoff not
 * reached (a deadline mistakenly set past kickoff must not let someone predict
 * a match already in play).
 */
export async function submitPrediction(
  userId: string,
  competitionId: string,
  input: SubmitPredictionInput,
) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { sponsor: { select: { isActive: true } } },
  });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  if (!competition.sponsor.isActive) throw new Error('COMPETITION_NOT_OPEN');
  if (competition.status !== 'PUBLISHED') throw new Error('COMPETITION_NOT_OPEN');

  const now = new Date();
  if (now >= competition.predictionDeadline) throw new Error('DEADLINE_PASSED');
  if (now >= competition.matchDate) throw new Error('MATCH_STARTED');

  let data: Prisma.CompetitionEntryCreateInput | null = null;
  if (competition.predictionMode === 'EXACT_SCORE') {
    const { predictedHomeScore: h, predictedAwayScore: a } = input;
    if (!Number.isInteger(h) || !Number.isInteger(a) || (h as number) < 0 || (a as number) < 0) {
      throw new Error('INVALID_PREDICTION');
    }
    data = {
      competition: { connect: { id: competitionId } },
      user: { connect: { id: userId } },
      predictedHomeScore: h as number,
      predictedAwayScore: a as number,
      predictedWinner: null,
    };
  } else {
    if (!input.predictedWinner || !['home', 'draw', 'away'].includes(input.predictedWinner)) {
      throw new Error('INVALID_PREDICTION');
    }
    data = {
      competition: { connect: { id: competitionId } },
      user: { connect: { id: userId } },
      predictedWinner: input.predictedWinner,
      predictedHomeScore: null,
      predictedAwayScore: null,
    };
  }

  const update = {
    predictedHomeScore: data.predictedHomeScore ?? null,
    predictedAwayScore: data.predictedAwayScore ?? null,
    predictedWinner: data.predictedWinner ?? null,
  };

  // Create-first so the unique index decides who is "new". Concurrent submits
  // by the same user therefore increment `participantsCount` exactly once —
  // a read-then-upsert would let both callers see "no existing row".
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.competitionEntry.create({ data: data! });
      await tx.competition.update({
        where: { id: competitionId },
        data: { participantsCount: { increment: 1 } },
      });
      return created;
    });
    return entry;
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err;
    // Already entered → this is an edit, and the counter must not move.
    return prisma.competitionEntry.update({
      where: { competitionId_userId: { competitionId, userId } },
      data: update,
    });
  }
}

async function upsertOwnedSponsor(userId: string, input: SponsorInput) {
  const existing = await prisma.sponsor.findFirst({ where: { ownerId: userId } });
  if (existing) {
    return prisma.sponsor.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description ?? existing.description,
        logoUrl: input.logoUrl ?? existing.logoUrl,
        address: input.address ?? existing.address,
        hasDelivery: input.hasDelivery ?? existing.hasDelivery,
        socialLinks: (input.socialLinks ?? existing.socialLinks) as Prisma.InputJsonValue,
      },
    });
  }
  return prisma.sponsor.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      address: input.address ?? null,
      hasDelivery: input.hasDelivery ?? false,
      socialLinks: (input.socialLinks ?? undefined) as Prisma.InputJsonValue,
    },
  });
}

/** Shared validation for sponsor- and admin-created competitions. */
async function buildCompetitionData(input: CreateCompetitionInput, sponsorId: string) {
  if (!input.prizeName?.trim()) throw new Error('INVALID_PRIZE');
  if (!input.prizeType?.trim()) throw new Error('INVALID_PRIZE');
  if (!Number.isInteger(input.winnersCount) || input.winnersCount < 1) {
    throw new Error('INVALID_WINNERS_COUNT');
  }

  const category = await prisma.prizeCategory.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) throw new Error('CATEGORY_NOT_FOUND');

  const match = await findInPool(input.apiMatchId, input.poolDate);
  if (!match) throw new Error('MATCH_NOT_IN_POOL');

  const deadline = toDate(input.predictionDeadline);
  if (!deadline || deadline <= new Date()) throw new Error('INVALID_DEADLINE');

  const kickoff = new Date(match.kickoffIso);
  // Predictions must close by kickoff at the latest.
  if (deadline > kickoff) throw new Error('DEADLINE_AFTER_KICKOFF');

  const startAt = toDate(input.startAt ?? null);
  const endAt = toDate(input.endAt ?? null);
  if (startAt && endAt && endAt <= startAt) throw new Error('INVALID_WINDOW');
  if (startAt && startAt > deadline) throw new Error('INVALID_WINDOW');

  return {
    sponsorId,
    categoryId: category.id,
    prizeName: input.prizeName.trim(),
    prizeImageUrl: input.prizeImageUrl ?? null,
    prizeType: input.prizeType.trim(),
    prizeDescription: input.prizeDescription ?? null,
    winnersCount: input.winnersCount,
    apiMatchId: input.apiMatchId,
    homeTeam: match.home.name,
    awayTeam: match.away.name,
    homeTeamLogo: match.home.logo,
    awayTeamLogo: match.away.logo,
    matchDate: kickoff,
    matchStatus: match.status,
    leagueName: match.leagueName,
    predictionDeadline: deadline,
    predictionMode: input.predictionMode ?? 'EXACT_SCORE',
    startAt,
    endAt,
    rules: input.rules ?? null,
    isFree: input.isFree ?? true,
  };
}

/** Sponsor-facing creation. Always lands as DRAFT pending admin review. */
export async function createCompetition(userId: string, input: CreateCompetitionInput) {
  if (!input.sponsor?.name?.trim()) throw new Error('INVALID_SPONSOR');
  const sponsor = await upsertOwnedSponsor(userId, input.sponsor);
  if (!sponsor.isActive) throw new Error('SPONSOR_DISABLED');

  const data = await buildCompetitionData(input, sponsor.id);
  return prisma.competition.create({
    data: { ...data, status: 'DRAFT' },
    include: { sponsor: true, category: true },
  });
}

/** Admin-facing creation against an existing sponsor; publishes immediately. */
export async function adminCreateCompetition(
  input: CreateCompetitionInput & { sponsorId: string; publish?: boolean },
) {
  const sponsor = await prisma.sponsor.findUnique({ where: { id: input.sponsorId } });
  if (!sponsor) throw new Error('SPONSOR_NOT_FOUND');

  const data = await buildCompetitionData(input, sponsor.id);
  const publish = input.publish !== false;
  return prisma.competition.create({
    data: {
      ...data,
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? new Date() : null,
      startAt: data.startAt ?? (publish ? new Date() : null),
    },
    include: { sponsor: true, category: true },
  });
}

/** Competitions owned by this user's sponsor profile. */
export async function listMyCompetitions(userId: string) {
  const sponsor = await prisma.sponsor.findFirst({ where: { ownerId: userId } });
  if (!sponsor) return { sponsor: null, items: [] };
  const items = await prisma.competition.findMany({
    where: { sponsorId: sponsor.id },
    orderBy: { createdAt: 'desc' },
    include: { category: true },
  });
  return { sponsor, items };
}

/**
 * Ownership gate for sponsor-scoped mutations — prevents editing another
 * sponsor's competition by swapping the id in the request.
 */
export async function assertCompetitionOwner(userId: string, competitionId: string) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { sponsor: { select: { ownerId: true, isActive: true } } },
  });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  if (!competition.sponsor.ownerId || competition.sponsor.ownerId !== userId) {
    throw new Error('FORBIDDEN');
  }
  return competition;
}

/** A sponsor may revise its own competition only while it is still a draft. */
export async function updateOwnCompetition(
  userId: string,
  competitionId: string,
  patch: Partial<CreateCompetitionInput>,
) {
  const competition = await assertCompetitionOwner(userId, competitionId);
  if (competition.status !== 'DRAFT') throw new Error('COMPETITION_NOT_DRAFT');

  const data: Prisma.CompetitionUpdateInput = {};
  if (patch.prizeName !== undefined) data.prizeName = patch.prizeName.trim();
  if (patch.prizeType !== undefined) data.prizeType = patch.prizeType.trim();
  if (patch.prizeImageUrl !== undefined) data.prizeImageUrl = patch.prizeImageUrl;
  if (patch.prizeDescription !== undefined) data.prizeDescription = patch.prizeDescription;
  if (patch.rules !== undefined) data.rules = patch.rules;
  if (patch.winnersCount !== undefined) {
    if (!Number.isInteger(patch.winnersCount) || patch.winnersCount < 1) {
      throw new Error('INVALID_WINNERS_COUNT');
    }
    data.winnersCount = patch.winnersCount;
  }
  if (patch.predictionDeadline !== undefined) {
    const deadline = toDate(patch.predictionDeadline);
    if (!deadline || deadline <= new Date()) throw new Error('INVALID_DEADLINE');
    if (deadline > competition.matchDate) throw new Error('DEADLINE_AFTER_KICKOFF');
    data.predictionDeadline = deadline;
  }

  return prisma.competition.update({
    where: { id: competitionId },
    data,
    include: { sponsor: true, category: true },
  });
}

export async function publishCompetition(id: string) {
  const competition = await prisma.competition.findUnique({
    where: { id },
    include: { sponsor: { select: { ownerId: true, name: true } } },
  });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  if (competition.status !== 'DRAFT') throw new Error('COMPETITION_NOT_DRAFT');
  const published = await prisma.competition.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      reviewedAt: new Date(),
      rejectionReason: null,
      startAt: competition.startAt ?? new Date(),
    },
    include: { sponsor: { select: { ownerId: true, name: true } } },
  });
  const { recordCompetitionActivity, notifySponsorReviewDecision, notifyAssAdmin } =
    await import('./competition-moderation.service');
  await recordCompetitionActivity(id, 'APPROVED', {
    prizeName: published.prizeName,
    storeName: published.sponsor.name,
  });
  await notifySponsorReviewDecision({
    ownerId: published.sponsor.ownerId,
    competitionId: id,
    approved: true,
    prizeName: published.prizeName,
  });
  await notifyAssAdmin({
    titleKey: 'competitionAdminApprovedTitle',
    bodyKey: 'competitionAdminApprovedBody',
    vars: { prize: published.prizeName, store: published.sponsor.name },
    data: { screen: `/predict-and-win/${id}`, entityId: id, kind: 'competition_admin_approved' },
    idempotencyKey: `competitionAdminApproved:${id}`,
  });
  return published;
}

export async function rejectCompetition(id: string, reason?: string | null) {
  const competition = await prisma.competition.findUnique({
    where: { id },
    include: { sponsor: { select: { ownerId: true, name: true } } },
  });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  if (competition.status !== 'DRAFT') throw new Error('COMPETITION_NOT_DRAFT');
  const trimmed = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  const rejected = await prisma.competition.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      rejectionReason: trimmed || null,
    },
    include: { sponsor: { select: { ownerId: true, name: true } } },
  });
  const { recordCompetitionActivity, notifySponsorReviewDecision, notifyAssAdmin } =
    await import('./competition-moderation.service');
  await recordCompetitionActivity(id, 'REJECTED', {
    prizeName: rejected.prizeName,
    storeName: rejected.sponsor.name,
    reason: trimmed || null,
  });
  await notifySponsorReviewDecision({
    ownerId: rejected.sponsor.ownerId,
    competitionId: id,
    approved: false,
    prizeName: rejected.prizeName,
    reason: trimmed || null,
  });
  await notifyAssAdmin({
    titleKey: 'competitionAdminRejectedTitle',
    bodyKey: 'competitionAdminRejectedBody',
    vars: { prize: rejected.prizeName, store: rejected.sponsor.name },
    data: { screen: `/predict-and-win/${id}`, entityId: id, kind: 'competition_admin_rejected' },
    idempotencyKey: `competitionAdminRejected:${id}`,
  });
  return rejected;
}

/** Pull a live competition back out of the public list without deleting it. */
export async function unpublishCompetition(id: string) {
  const competition = await prisma.competition.findUnique({ where: { id } });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  if (competition.status === 'SETTLED') throw new Error('COMPETITION_SETTLED');
  return prisma.competition.update({ where: { id }, data: { status: 'DRAFT', publishedAt: null } });
}

export async function cancelCompetition(id: string) {
  const competition = await prisma.competition.findUnique({ where: { id } });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  return prisma.competition.update({ where: { id }, data: { status: 'CANCELLED' } });
}

/** Entrants for the admin dashboard. */
export async function listCompetitionEntries(id: string, onlyWinners = false) {
  return prisma.competitionEntry.findMany({
    where: { competitionId: id, ...(onlyWinners ? { isWinner: true } : {}) },
    orderBy: onlyWinners ? { rank: 'asc' } : { createdAt: 'asc' },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
  });
}
