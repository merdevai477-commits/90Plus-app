/**
 * Admin / AsS helpers for the locked Share & Win seed account.
 * Friends are real referral rows (plus ghost users) so standings stay
 * self-healing when syncStanding re-counts events.
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';
import { SEED_XP_TARGET_CLERK_ID } from '../constants/seed-xp-target';
import {
  SCORE_PER_PARTICIPANT,
  computeScore,
  ensureCurrentCycle,
} from './share-win.service';
import { awardXp, penalizeXp, XP_VALUES } from './xp.service';
import { logger } from '../utils/logger';

export const SEED_FRIENDS_MAX = 500;
export const SEED_FRIENDS_DELTA_MAX_ABS = 100;

function randSuffix(n = 10): string {
  return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}

export async function getSeedAccountBundle() {
  const user = await prisma.user.findUnique({
    where: { clerkUserId: SEED_XP_TARGET_CLERK_ID },
    select: {
      id: true,
      clerkUserId: true,
      username: true,
      displayName: true,
      avatar: true,
      xp: true,
      level: true,
      referralCode: true,
    },
  });
  if (!user) return null;

  const cycle = await ensureCurrentCycle();
  const standing = await prisma.shareWinStanding.findUnique({
    where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
    select: {
      shareCount: true,
      participantCount: true,
      score: true,
    },
  });

  const [friends, shares] = await Promise.all([
    prisma.shareWinReferral.count({
      where: { cycleId: cycle.id, referrerId: user.id, status: 'CONVERTED' },
    }),
    prisma.shareWinShareEvent.count({
      where: { cycleId: cycle.id, userId: user.id },
    }),
  ]);

  return {
    ...user,
    shareWin: {
      cycleId: cycle.id,
      weekKey: cycle.weekKey,
      friends: standing?.participantCount ?? friends,
      shares: standing?.shareCount ?? shares,
      score: standing?.score ?? computeScore(friends, shares),
    },
  };
}

/**
 * Raise or lower converted-friend count for the seed account in the active
 * cycle. Also mirrors REFERRAL_CONVERSION XP onto the profile (±1 per friend).
 */
export async function adjustSeedFriends(delta: number): Promise<{
  friends: number;
  shares: number;
  score: number;
  xp: number;
  level: number;
  friendsDelta: number;
  xpDelta: number;
}> {
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    throw Object.assign(new Error('delta must be a non-zero integer'), { status: 400 });
  }
  if (Math.abs(delta) > SEED_FRIENDS_DELTA_MAX_ABS) {
    throw Object.assign(new Error(`delta abs must be ≤ ${SEED_FRIENDS_DELTA_MAX_ABS}`), {
      status: 400,
    });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: SEED_XP_TARGET_CLERK_ID },
    select: { id: true, username: true, referralCode: true, xp: true, level: true },
  });
  if (!user) {
    throw Object.assign(new Error('Seed target account not found'), { status: 404 });
  }

  const cycle = await ensureCurrentCycle();
  const code = user.referralCode || 'SEEDASS';
  if (!user.referralCode) {
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: code },
    });
  }

  const existing = await prisma.shareWinReferral.findMany({
    where: { cycleId: cycle.id, referrerId: user.id, status: 'CONVERTED' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      referredUserId: true,
      referred: { select: { email: true, username: true } },
    },
  });

  const targetFriends = existing.length + delta;
  if (targetFriends < 0) {
    throw Object.assign(new Error('friends cannot go below 0'), { status: 400 });
  }
  if (targetFriends > SEED_FRIENDS_MAX) {
    throw Object.assign(new Error(`friends cannot exceed ${SEED_FRIENDS_MAX}`), { status: 400 });
  }

  const now = Date.now();
  const createdReferredIds: string[] = [];
  const removedReferredIds: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      if (delta > 0) {
        for (let i = 0; i < delta; i += 1) {
          const suffix = randSuffix(10);
          const createdAt = new Date(now - (i + 1) * 60_000);
          const referred = await tx.user.create({
            data: {
              email: `sharewin.seed.${suffix}@example.invalid`,
              username: `sw_seed_${suffix}`,
              displayName: `Seed Friend ${existing.length + i + 1}`,
              password: null,
              createdAt,
              referralCode: null,
            },
            select: { id: true },
          });
          await tx.shareWinReferral.create({
            data: {
              referrerId: user.id,
              referredUserId: referred.id,
              referralCode: code,
              cycleId: cycle.id,
              status: 'CONVERTED',
              convertedAt: createdAt,
              createdAt,
            },
          });
          createdReferredIds.push(referred.id);
        }
      } else {
        const needDrop = Math.abs(delta);
        // Prefer dropping ghost seed accounts we created; fall back to oldest.
        const seedRefs = existing.filter(
          (r) =>
            (r.referred.email || '').endsWith('@example.invalid') &&
            (r.referred.username || '').startsWith('sw_seed_'),
        );
        const dropPool = seedRefs.length >= needDrop ? seedRefs : existing;
        const toDrop = dropPool.slice(-needDrop);
        const refIds = toDrop.map((r) => r.id);
        const userIds = toDrop.map((r) => r.referredUserId);
        removedReferredIds.push(...userIds);

        await tx.shareWinReferral.deleteMany({ where: { id: { in: refIds } } });
        await tx.user.deleteMany({
          where: {
            id: { in: userIds },
            email: { endsWith: '@example.invalid' },
            username: { startsWith: 'sw_seed_' },
          },
        });
      }

      const [shareCount, participantCount] = await Promise.all([
        tx.shareWinShareEvent.count({ where: { cycleId: cycle.id, userId: user.id } }),
        tx.shareWinReferral.count({
          where: { cycleId: cycle.id, referrerId: user.id, status: 'CONVERTED' },
        }),
      ]);
      const score = computeScore(participantCount, shareCount);
      const stamped = new Date();
      const hasActivity = shareCount > 0 || participantCount > 0;

      await tx.shareWinStanding.upsert({
        where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
        create: {
          cycleId: cycle.id,
          userId: user.id,
          shareCount,
          participantCount,
          score,
          firstScoredAt: hasActivity ? stamped : null,
          lastScoredAt: hasActivity ? stamped : null,
        },
        update: {
          shareCount,
          participantCount,
          score,
          lastScoredAt: hasActivity ? stamped : undefined,
        },
      });
    },
    { timeout: 60_000 },
  );

  // Mirror referral XP on the profile (±1 per friend), same as live conversions.
  let xpDelta = 0;
  if (createdReferredIds.length > 0) {
    for (const referredUserId of createdReferredIds) {
      const result = await awardXp({
        userId: user.id,
        action: 'REFERRAL_CONVERSION',
        amount: XP_VALUES.REFERRAL_CONVERSION,
        timezone: 'Africa/Cairo',
        idempotencyKey: `share-win-referral:${referredUserId}`,
        metadata: { source: 'seed_friends', cycleId: cycle.id },
      });
      xpDelta += result.awarded;
    }
  } else if (removedReferredIds.length > 0) {
    const charge = removedReferredIds.length * XP_VALUES.REFERRAL_CONVERSION;
    const result = await penalizeXp({
      userId: user.id,
      action: 'ADMIN_ADJUSTMENT',
      amount: charge,
      idempotencyKey: `ass.seed.friends.xp.${Date.now()}.${randSuffix(6)}`,
      metadata: {
        source: 'ass_seed',
        removed: removedReferredIds.length,
        cycleId: cycle.id,
      },
    });
    xpDelta += result.awarded;
  }

  const refreshed = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { xp: true, level: true },
  });
  const standing = await prisma.shareWinStanding.findUniqueOrThrow({
    where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
    select: { shareCount: true, participantCount: true, score: true },
  });

  logger.info('[SeedAccount] friends adjust', {
    userId: user.id,
    delta,
    friends: standing.participantCount,
    score: standing.score,
    xpDelta,
  });

  return {
    friends: standing.participantCount,
    shares: standing.shareCount,
    score: standing.score,
    xp: refreshed.xp,
    level: refreshed.level,
    friendsDelta: delta,
    xpDelta,
  };
}

/** Score points currently shown for friends (friends × 3). */
export function friendsScorePreview(friends: number): number {
  return friends * SCORE_PER_PARTICIPANT;
}
