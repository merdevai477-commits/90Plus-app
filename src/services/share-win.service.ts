/**
 * Share & Win — شارك واربح
 *
 * Weekly referral competition. Every user gets a unique referral code. Sharing
 * it to a real destination (WhatsApp, the OS share sheet, …) raises their
 * share count. Each week is ranked by that count — not by link visits — and
 * archived independently.
 *
 * ── Invariants this module guarantees ────────────────────────────────────────
 *  • The database is the source of truth. Nothing the client sends can change
 *    a share count, participant count or rank directly.
 *  • Weekly rank is confirmed share count (a real handoff to another app),
 *    never link visits and never XP.
 *  • A user can be attributed to at most ONE referrer, ever
 *    (`share_win_referrals.referredUserId` is UNIQUE — races lose on the index,
 *    not on a read-then-write check).
 *  • Self-referral, already-attributed users and pre-existing accounts are
 *    rejected before a referral row is written.
 *  • Closing a cycle never deletes anything: standings keep `finalRank` so
 *    "who won week N, with how many confirmed shares" stays answerable forever.
 */

import { Prisma, ShareWinCycleStatus, type ShareWinCycle } from '@prisma/client';

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { SHARE_BASE_URL } from '../config/shareLinks';
import { awardXp, XP_VALUES } from './xp.service';

// ─── Scoring ────────────────────────────────────────────────────────────────

/** Each successful referral conversion is worth +3 weekly points. */
export const SCORE_PER_PARTICIPANT = 3;
/** Share-only actions are what the weekly leaderboard ranks by. */
export const SCORE_PER_SHARE = 0;

/**
 * The one place Share & Win score is defined. Both the live standings and the
 * archived ones are written through this function, so a cycle can always be
 * recomputed from its raw events and land on the same number.
 */
export function computeScore(participantCount: number, shareCount: number): number {
  return participantCount * SCORE_PER_PARTICIPANT + shareCount * SCORE_PER_SHARE;
}

// ─── Anti-abuse limits ──────────────────────────────────────────────────────

/** Ignore share taps fired faster than this — double-taps, retries, replays. */
const SHARE_MIN_INTERVAL_MS = 5_000;
/** Hard ceiling on counted shares per user per day. */
const SHARE_DAILY_LIMIT = 200;
/**
 * A referral only converts if the referred account was created inside this
 * window. This is what stops a long-standing user from pasting a friend's code
 * and being counted as a "new" participant.
 */
const REFERRAL_ATTRIBUTION_WINDOW_MS = 48 * 60 * 60 * 1000;

// ─── Referral codes ─────────────────────────────────────────────────────────

/** Crockford-ish alphabet: no O/0/I/1, so codes survive being read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeReferralCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidReferralCode(raw: string): boolean {
  return CODE_PATTERN.test(normalizeReferralCode(raw));
}

/** Public share link for a code. Domain comes from the existing share config. */
export function buildReferralLink(code: string): string {
  return `${SHARE_BASE_URL}/invite/${code}`;
}

/**
 * Return the user's referral code, generating one on first use.
 * Collisions retry against the unique index rather than pre-checking, so two
 * concurrent callers can never hand out the same code.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode as string;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Either the code is taken or another request just assigned this user
        // a code. Re-read: if they now have one, we're done.
        const now = await prisma.user.findUnique({
          where: { id: userId },
          select: { referralCode: true },
        });
        if (now?.referralCode) return now.referralCode;
        continue;
      }
      throw err;
    }
  }

  throw new Error('REFERRAL_CODE_GENERATION_FAILED');
}

// ─── Weekly cycles ──────────────────────────────────────────────────────────

/** Monday 00:00 UTC of the week containing `date`. */
function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

/** ISO-8601 week key, e.g. "2026-W32" — stable and sortable. */
export function isoWeekKey(date: Date): string {
  const d = weekStart(date);
  // ISO weeks are numbered by the Thursday they contain.
  const thursday = new Date(d);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekMonday = weekStart(firstThursday);
  const week = Math.round((thursday.getTime() - firstWeekMonday.getTime()) / (7 * 86_400_000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * The cycle that "now" belongs to, creating it if the week just rolled over.
 * Called on every read and write, so cycles advance without a scheduler; the
 * interval job in main.ts only makes the rollover prompt rather than lazy.
 */
export async function ensureCurrentCycle(now = new Date()): Promise<ShareWinCycle> {
  const weekKey = isoWeekKey(now);

  const existing = await prisma.shareWinCycle.findUnique({ where: { weekKey } });
  if (existing) {
    // A cycle whose window has not passed must never be COMPLETED. If it is
    // (early manual close, clock skew), reopen it — otherwise this week's
    // shares and referrals would land in a closed cycle and never be ranked.
    if (existing.status === ShareWinCycleStatus.COMPLETED && existing.endAt > now) {
      logger.warn(`[ShareWin] Reopening prematurely closed cycle ${weekKey}`);
      return prisma.shareWinCycle.update({
        where: { id: existing.id },
        data: { status: ShareWinCycleStatus.ACTIVE, closedAt: null },
      });
    }
    return existing;
  }

  const startAt = weekStart(now);
  const endAt = new Date(startAt.getTime() + 7 * 86_400_000);

  try {
    const created = await prisma.shareWinCycle.create({
      data: { weekKey, startAt, endAt, status: ShareWinCycleStatus.ACTIVE },
    });
    logger.info(`[ShareWin] Opened cycle ${weekKey}`);
    // Any earlier cycle is now over — archive it with final ranks.
    void closeDueCycles(now).catch((err) =>
      logger.error('[ShareWin] closeDueCycles after rollover failed:', err),
    );
    return created;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Concurrent rollover — the other request won the unique index.
      return prisma.shareWinCycle.findUniqueOrThrow({ where: { weekKey } });
    }
    throw err;
  }
}

/**
 * Archive every ACTIVE cycle whose window has passed, stamping `finalRank` on
 * its standings. Idempotent: a cycle already COMPLETED is skipped.
 */
export async function closeDueCycles(now = new Date()): Promise<number> {
  const due = await prisma.shareWinCycle.findMany({
    where: { status: ShareWinCycleStatus.ACTIVE, endAt: { lte: now } },
    select: { id: true, weekKey: true },
  });

  let closed = 0;
  for (const cycle of due) {
    try {
      await closeCycle(cycle.id, now);
      closed += 1;
      logger.info(`[ShareWin] Closed cycle ${cycle.weekKey}`);
    } catch (err) {
      logger.error(`[ShareWin] Failed to close cycle ${cycle.weekKey}:`, err);
    }
  }
  return closed;
}

/**
 * Freeze one cycle's leaderboard. Ranks are assigned by the same ordering the
 * live leaderboard uses, so a user's final rank matches what they last saw.
 */
export async function closeCycle(cycleId: string, now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cycle = await tx.shareWinCycle.findUnique({
      where: { id: cycleId },
      select: { id: true, status: true },
    });
    if (!cycle || cycle.status === ShareWinCycleStatus.COMPLETED) return;

    // Single UPDATE ... FROM — no per-user round trips regardless of size.
    await tx.$executeRaw`
      UPDATE "share_win_standings" AS s
      SET "finalRank" = ranked.rank
      FROM (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            ORDER BY
              "shareCount" DESC,
              COALESCE("firstScoredAt", 'infinity'::timestamp) ASC,
              "userId" ASC
          )::int AS rank
        FROM "share_win_standings"
        WHERE "cycleId" = ${cycleId}
      ) AS ranked
      WHERE s."id" = ranked."id"
    `;

    await tx.shareWinCycle.update({
      where: { id: cycleId },
      data: { status: ShareWinCycleStatus.COMPLETED, closedAt: now },
    });
  });
}

// ─── Standings ──────────────────────────────────────────────────────────────

/**
 * Re-derive one user's standing row for a cycle from its raw events.
 * Counting instead of incrementing keeps the aggregate self-healing: a replayed
 * or rolled-back write can never drift the totals.
 */
async function syncStanding(
  tx: Prisma.TransactionClient,
  cycleId: string,
  userId: string,
  now: Date,
): Promise<{ shareCount: number; participantCount: number; score: number }> {
  const [shareCount, participantCount] = await Promise.all([
    tx.shareWinShareEvent.count({ where: { cycleId, userId } }),
    tx.shareWinReferral.count({ where: { cycleId, referrerId: userId, status: 'CONVERTED' } }),
  ]);

  const score = computeScore(participantCount, shareCount);
  const hasShare = shareCount > 0;

  await tx.shareWinStanding.upsert({
    where: { cycleId_userId: { cycleId, userId } },
    create: {
      cycleId,
      userId,
      shareCount,
      participantCount,
      score,
      firstScoredAt: hasShare ? now : null,
      lastScoredAt: hasShare ? now : null,
    },
    update: {
      shareCount,
      participantCount,
      score,
      lastScoredAt: hasShare ? now : undefined,
      // firstScoredAt is deliberately untouched here — it is the tie-breaker
      // and must keep its original value once set.
    },
  });

  // Stamp firstScoredAt on the first confirmed share. Rank is share-count, so
  // a referral conversion must not start the clock.
  if (hasShare) {
    await tx.$executeRaw`
      UPDATE "share_win_standings"
      SET "firstScoredAt" = ${now}
      WHERE "cycleId" = ${cycleId} AND "userId" = ${userId} AND "firstScoredAt" IS NULL
    `;
  }

  return { shareCount, participantCount, score };
}

// ─── Share tracking ─────────────────────────────────────────────────────────

export interface RecordShareResult {
  counted: boolean;
  reason?: 'throttled' | 'daily_limit';
  shareCount: number;
  participantCount: number;
  score: number;
  totalShareCount: number;
}

/**
 * Record one share by the authenticated user. The caller's identity always
 * comes from the auth middleware — never from the request body.
 */
export async function recordShare(
  userId: string,
  channel: string,
  now = new Date(),
): Promise<RecordShareResult> {
  const cycle = await ensureCurrentCycle(now);
  const safeChannel = String(channel ?? 'system').trim().slice(0, 32) || 'system';

  const lastShare = await prisma.shareWinShareEvent.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const throttled =
    lastShare != null && now.getTime() - lastShare.createdAt.getTime() < SHARE_MIN_INTERVAL_MS;

  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sharesToday = await prisma.shareWinShareEvent.count({
    where: { userId, createdAt: { gte: dayStart } },
  });
  const overLimit = sharesToday >= SHARE_DAILY_LIMIT;

  if (throttled || overLimit) {
    const [standing, totalShareCount] = await Promise.all([
      prisma.shareWinStanding.findUnique({
        where: { cycleId_userId: { cycleId: cycle.id, userId } },
        select: { shareCount: true, participantCount: true, score: true },
      }),
      prisma.shareWinShareEvent.count({ where: { userId } }),
    ]);
    return {
      counted: false,
      reason: throttled ? 'throttled' : 'daily_limit',
      shareCount: standing?.shareCount ?? 0,
      participantCount: standing?.participantCount ?? 0,
      score: standing?.score ?? 0,
      totalShareCount,
    };
  }

  const totals = await prisma.$transaction(async (tx) => {
    await tx.shareWinShareEvent.create({
      data: { userId, cycleId: cycle.id, channel: safeChannel, createdAt: now },
    });
    return syncStanding(tx, cycle.id, userId, now);
  });

  const totalShareCount = await prisma.shareWinShareEvent.count({ where: { userId } });

  return { counted: true, ...totals, totalShareCount };
}

// ─── Referral attribution ───────────────────────────────────────────────────

export type ReferralClaimReason =
  | 'attributed'
  | 'invalid_code'
  | 'unknown_code'
  | 'self_referral'
  | 'already_attributed'
  | 'not_a_new_user';

export interface ReferralClaimResult {
  attributed: boolean;
  reason: ReferralClaimReason;
}

/**
 * Attribute the authenticated (freshly registered) user to a referral code.
 *
 * Rejects, in order: malformed codes, unknown codes, self-referral, users who
 * already have a referrer, and accounts older than the attribution window
 * (i.e. existing users). The final duplicate guard is the unique index, so two
 * simultaneous claims cannot both succeed.
 */
export async function claimReferral(
  referredUserId: string,
  rawCode: string,
  now = new Date(),
): Promise<ReferralClaimResult> {
  const code = normalizeReferralCode(rawCode);
  if (!isValidReferralCode(code)) return { attributed: false, reason: 'invalid_code' };

  const [referrer, referred, alreadyAttributed] = await Promise.all([
    prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, isDeleted: true, isBanned: true },
    }),
    prisma.user.findUnique({
      where: { id: referredUserId },
      select: { id: true, createdAt: true },
    }),
    prisma.shareWinReferral.findUnique({
      where: { referredUserId },
      select: { id: true },
    }),
  ]);

  if (!referrer || referrer.isDeleted || referrer.isBanned) {
    return { attributed: false, reason: 'unknown_code' };
  }
  if (!referred) return { attributed: false, reason: 'not_a_new_user' };
  if (referrer.id === referredUserId) return { attributed: false, reason: 'self_referral' };
  if (alreadyAttributed) return { attributed: false, reason: 'already_attributed' };

  // Only genuinely new accounts convert — an established user opening a link
  // is not a participant.
  if (now.getTime() - referred.createdAt.getTime() > REFERRAL_ATTRIBUTION_WINDOW_MS) {
    return { attributed: false, reason: 'not_a_new_user' };
  }

  const cycle = await ensureCurrentCycle(now);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.shareWinReferral.create({
        data: {
          referrerId: referrer.id,
          referredUserId,
          referralCode: code,
          cycleId: cycle.id,
          convertedAt: now,
        },
      });
      await syncStanding(tx, cycle.id, referrer.id, now);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost a race — the user already has a referrer. Correct outcome.
      return { attributed: false, reason: 'already_attributed' };
    }
    throw err;
  }

  // Global XP for the referrer, through the existing XP pipeline.
  // Idempotency key is the referred user, so a retry can never double-award.
  await awardXp({
    userId: referrer.id,
    action: 'REFERRAL_CONVERSION',
    amount: XP_VALUES.REFERRAL_CONVERSION,
    timezone: 'UTC',
    idempotencyKey: `share-win-referral:${referredUserId}`,
    metadata: { source: 'share_win', cycleId: cycle.id, referralCode: code },
  }).catch((err) => logger.error('[ShareWin] referral XP award failed:', err));

  return { attributed: true, reason: 'attributed' };
}

// ─── Ranking ────────────────────────────────────────────────────────────────

/**
 * A single user's rank, without loading the leaderboard.
 *
 * Counts only the rows that strictly outrank them, using the same tuple the
 * leaderboard sorts by: shares ↓, earliest confirmed share ↑, id ↑.
 *
 * The user's own row is joined in rather than passed as parameters. That is
 * deliberate: binding `firstScoredAt` as a parameter makes the driver send a
 * `timestamptz`, and casting that back to the column's naive `timestamp` runs
 * it through the session timezone — which silently broke the tie-break. Column
 * against column, both sides are the same type and no conversion happens.
 *
 * Returns null when the user has no standing row yet; the caller ranks them at
 * the tail instead.
 */
async function getRankFor(cycleId: string, userId: string): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ ahead: number }>>`
    SELECT COUNT(*)::int AS ahead
    FROM "share_win_standings" s
    JOIN "share_win_standings" me
      ON me."cycleId" = s."cycleId" AND me."userId" = ${userId}
    WHERE s."cycleId" = ${cycleId}
      AND (
        -s."shareCount",
        COALESCE(s."firstScoredAt", 'infinity'::timestamp),
        s."userId"
      ) < (
        -me."shareCount",
        COALESCE(me."firstScoredAt", 'infinity'::timestamp),
        me."userId"
      )
  `;
  if (rows.length === 0) return null;
  return (rows[0]?.ahead ?? 0) + 1;
}

/** Rank for a user with no standing row — immediately after everyone scoring. */
async function tailRank(cycleId: string): Promise<number> {
  return (await prisma.shareWinStanding.count({ where: { cycleId } })) + 1;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  participants: number;
  shares: number;
  score: number;
}

/**
 * The caller's own position in a cycle, for pinning/highlighting in the full
 * leaderboard without paging until their row happens to load.
 */
export async function getMyStanding(
  cycleId: string,
  userId: string,
): Promise<LeaderboardRow | null> {
  const standing = await prisma.shareWinStanding.findUnique({
    where: { cycleId_userId: { cycleId, userId } },
    select: {
      userId: true,
      shareCount: true,
      participantCount: true,
      score: true,
      user: { select: { username: true, displayName: true, avatar: true } },
    },
  });

  const rank = standing ? await getRankFor(cycleId, userId) : null;

  if (!standing) {
    // Not on the board yet — still report a real tail rank, never a blank.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, displayName: true, avatar: true },
    });
    if (!user) return null;
    return {
      rank: await tailRank(cycleId),
      userId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      participants: 0,
      shares: 0,
      score: 0,
    };
  }

  return {
    rank: rank ?? (await tailRank(cycleId)),
    userId,
    username: standing.user.username,
    displayName: standing.user.displayName,
    avatar: standing.user.avatar,
    participants: standing.participantCount,
    shares: standing.shareCount,
    score: standing.score,
  };
}

/**
 * Ranked slice of a cycle. One indexed query plus one batched user lookup —
 * no N+1.
 */
export async function getLeaderboard(
  cycleId: string,
  limit = 5,
  offset = 0,
): Promise<LeaderboardRow[]> {
  const standings = await prisma.shareWinStanding.findMany({
    where: { cycleId },
    orderBy: [
      { shareCount: 'desc' },
      { firstScoredAt: 'asc' },
      { userId: 'asc' },
    ],
    skip: Math.max(0, offset),
    take: Math.min(Math.max(1, limit), 100),
    select: {
      userId: true,
      shareCount: true,
      participantCount: true,
      score: true,
      user: {
        select: { username: true, displayName: true, avatar: true, isDeleted: true },
      },
    },
  });

  return standings.map((row, index) => ({
    rank: offset + index + 1,
    userId: row.userId,
    username: row.user.isDeleted ? 'deleted_user' : row.user.username,
    displayName: row.user.isDeleted ? null : row.user.displayName,
    avatar: row.user.isDeleted ? null : row.user.avatar,
    participants: row.participantCount,
    shares: row.shareCount,
    score: row.score,
  }));
}

// ─── Prizes ─────────────────────────────────────────────────────────────────

export interface SharePrize {
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  /** Remote override; the app falls back to its bundled art when null. */
  imageUrl: string | null;
}

/**
 * Prize line-up for a cycle. Stored per cycle so each week can differ and past
 * weeks keep the prizes they actually ran with. Falls back to the default
 * line-up when a cycle has none configured.
 */
export const DEFAULT_PRIZES: SharePrize[] = [
  {
    id: 'football',
    title: 'كرة قدم أصلية',
    titleEn: 'Official football',
    subtitle: 'أصلية 100%',
    subtitleEn: '100% authentic',
    imageUrl: null,
  },
  {
    id: 'jersey',
    title: 'تيشرت لفريقك',
    titleEn: 'Your team jersey',
    subtitle: 'اختر فريقك المفضل',
    subtitleEn: 'Pick your favourite club',
    imageUrl: null,
  },
  {
    id: 'boots',
    title: 'حذاء كرة قدم',
    titleEn: 'Football boots',
    subtitle: 'اختر فريقك المفضل',
    subtitleEn: 'Pick your favourite club',
    imageUrl: null,
  },
  {
    id: 'boots-pro',
    title: 'حذاء كرة قدم',
    titleEn: 'Football boots',
    subtitle: 'اختر فريقك المفضل',
    subtitleEn: 'Pick your favourite club',
    imageUrl: null,
  },
];

function resolvePrizes(raw: Prisma.JsonValue | null): SharePrize[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_PRIZES;
  return raw
    .filter((item): item is Prisma.JsonObject => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item, index) => ({
      id: String(item.id ?? `prize-${index}`),
      title: String(item.title ?? ''),
      titleEn: String(item.titleEn ?? item.title ?? ''),
      subtitle: String(item.subtitle ?? ''),
      subtitleEn: String(item.subtitleEn ?? item.subtitle ?? ''),
      imageUrl: item.imageUrl ? String(item.imageUrl) : null,
    }));
}

// ─── Screen payload ─────────────────────────────────────────────────────────

export interface ShareWinOverview {
  referralCode: string;
  referralLink: string;
  shareCount: number;
  participants: number;
  score: number;
  rank: number;
  totalShareCount: number;
  cycle: {
    id: string;
    weekKey: string;
    startAt: string;
    endAt: string;
    status: ShareWinCycleStatus;
    endsInMs: number;
  };
  leaderboard: LeaderboardRow[];
  prizes: SharePrize[];
  lastWinner: {
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    participants: number;
    score: number;
    rank: number;
    weekKey: string;
    closedAt: string | null;
  } | null;
  scoring: {
    perParticipant: number;
    perShare: number;
  };
}

/**
 * Everything the Share & Win screen renders, in one round trip.
 * A brand-new user gets a fully valid payload (zeros + their rank at the tail),
 * so the screen never has to invent numbers.
 */
export async function getShareWinOverview(
  userId: string,
  options: { leaderboardLimit?: number; now?: Date } = {},
): Promise<ShareWinOverview> {
  // `now` is injectable so verification can run in an isolated week instead of
  // competing with whatever the live cycle contains.
  const now = options.now ?? new Date();
  const [cycle, referralCode] = await Promise.all([
    ensureCurrentCycle(now),
    ensureReferralCode(userId),
  ]);

  const [standing, leaderboard, totalShareCount, lastWinner] = await Promise.all([
    prisma.shareWinStanding.findUnique({
      where: { cycleId_userId: { cycleId: cycle.id, userId } },
      select: { shareCount: true, participantCount: true, score: true, firstScoredAt: true },
    }),
    getLeaderboard(cycle.id, options.leaderboardLimit ?? 5),
    prisma.shareWinShareEvent.count({ where: { userId } }),
    getLastWinner(),
  ]);

  const participants = standing?.participantCount ?? 0;
  const score = standing?.score ?? 0;
  const rank = standing
    ? ((await getRankFor(cycle.id, userId)) ?? (await tailRank(cycle.id)))
    : await tailRank(cycle.id);

  return {
    referralCode,
    referralLink: buildReferralLink(referralCode),
    shareCount: standing?.shareCount ?? 0,
    participants,
    score,
    rank,
    totalShareCount,
    cycle: {
      id: cycle.id,
      weekKey: cycle.weekKey,
      startAt: cycle.startAt.toISOString(),
      endAt: cycle.endAt.toISOString(),
      status: cycle.status,
      endsInMs: Math.max(0, cycle.endAt.getTime() - now.getTime()),
    },
    leaderboard,
    prizes: resolvePrizes(cycle.prizes),
    lastWinner,
    scoring: { perParticipant: SCORE_PER_PARTICIPANT, perShare: SCORE_PER_SHARE },
  };
}

/** Rank-1 standing of the most recently closed cycle, or null before week one ends. */
export async function getLastWinner(): Promise<ShareWinOverview['lastWinner']> {
  const cycle = await prisma.shareWinCycle.findFirst({
    where: { status: ShareWinCycleStatus.COMPLETED },
    orderBy: { endAt: 'desc' },
    select: { id: true, weekKey: true, closedAt: true },
  });
  if (!cycle) return null;

  const winner = await prisma.shareWinStanding.findFirst({
    where: { cycleId: cycle.id, finalRank: 1 },
    select: {
      userId: true,
      participantCount: true,
      score: true,
      finalRank: true,
      user: { select: { username: true, displayName: true, avatar: true, isDeleted: true } },
    },
  });
  if (!winner || winner.user.isDeleted) return null;

  return {
    userId: winner.userId,
    username: winner.user.username,
    displayName: winner.user.displayName,
    avatar: winner.user.avatar,
    participants: winner.participantCount,
    score: winner.score,
    rank: winner.finalRank ?? 1,
    weekKey: cycle.weekKey,
    closedAt: cycle.closedAt?.toISOString() ?? null,
  };
}

// ─── History ────────────────────────────────────────────────────────────────

export interface CycleSummary {
  id: string;
  weekKey: string;
  startAt: string;
  endAt: string;
  status: ShareWinCycleStatus;
  winner: { userId: string; username: string; participants: number; score: number } | null;
}

/** Past and present cycles, newest first. Nothing is ever deleted. */
export async function getCycleHistory(limit = 12): Promise<CycleSummary[]> {
  const cycles = await prisma.shareWinCycle.findMany({
    orderBy: { startAt: 'desc' },
    take: Math.min(Math.max(1, limit), 52),
    select: {
      id: true,
      weekKey: true,
      startAt: true,
      endAt: true,
      status: true,
      standings: {
        where: { finalRank: 1 },
        take: 1,
        select: {
          userId: true,
          participantCount: true,
          score: true,
          user: { select: { username: true } },
        },
      },
    },
  });

  return cycles.map((cycle) => {
    const top = cycle.standings[0];
    return {
      id: cycle.id,
      weekKey: cycle.weekKey,
      startAt: cycle.startAt.toISOString(),
      endAt: cycle.endAt.toISOString(),
      status: cycle.status,
      winner: top
        ? {
            userId: top.userId,
            username: top.user.username,
            participants: top.participantCount,
            score: top.score,
          }
        : null,
    };
  });
}

/** Resolve a cycle by its week key ("2026-W32") for historical queries. */
export async function getCycleByWeekKey(weekKey: string) {
  return prisma.shareWinCycle.findUnique({ where: { weekKey } });
}
