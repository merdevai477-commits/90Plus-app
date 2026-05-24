/**
 * XP & Level Service
 *
 * Single entry point for all XP awards. Pure, testable, transaction-safe.
 * Implements the level curve, daily caps, idempotency, and streak logic.
 */

import { XpActionType, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { pushXpUpdate } from './xp-sse.service';
import { notifyUser } from './notify.service';
import { NotificationType } from './notification.service';

// ─── XP Values Map ──────────────────────────────────────────────────────────

export const XP_VALUES: Record<XpActionType, number> = {
  PROFILE_AVATAR: 50,
  PROFILE_DISPLAY_NAME: 30,
  PROFILE_BIO: 30,
  PROFILE_SOCIAL_INSTAGRAM: 20,
  PROFILE_SOCIAL_TWITTER: 20,
  PROFILE_SOCIAL_TIKTOK: 20,
  PROFILE_SOCIAL_SNAPCHAT: 20,
  PROFILE_FIFA_POSITION: 10,
  PROFILE_FIFA_AGE: 10,
  PROFILE_FIFA_HEIGHT: 10,
  PROFILE_FIFA_WEIGHT: 10,
  PROFILE_FIFA_FOOT: 10,
  PROFILE_FIFA_COUNTRY: 10,
  PROFILE_FIFA_CLUB: 10,
  PROFILE_FIFA_BRAND: 10,
  PROFILE_FIFA_COMPLETE: 20,
  REEL_UPLOAD: 30,
  REEL_COMMENT: 5,
  REEL_SHARE: 3,
  REEL_VIEWS_100: 5,
  REEL_VIEWS_500: 10,
  REEL_VIEWS_1000: 20,
  REEL_RECEIVED_LIKE: 2,
  REEL_RECEIVED_COMMENT: 3,
  REEL_RECEIVED_SHARE: 5,
  RECEIVED_FOLLOW: 5,
  PREDICTION_EXACT: 30,
  PREDICTION_WINNER: 10,
  QUIZ_ANSWER_CORRECT: 2,
  QUIZ_COMPLETED_HIGH: 20,
  DAILY_LOGIN: 5, // base; actual value comes from LOGIN_STREAK_TABLE
  ADMIN_ADJUSTMENT: 0,
  STREAK_FREEZE_USED: 0,
};

// ─── Login Streak XP Table ──────────────────────────────────────────────────

export const LOGIN_STREAK_TABLE: Record<number, number> = {
  1: 5,
  2: 10,
  3: 15,
  4: 20,
  5: 30,
  6: 40,
  7: 50,
};

export function getLoginStreakXp(day: number): number {
  if (day <= 0) return 0;
  if (day >= 7) return 50;
  return LOGIN_STREAK_TABLE[day] ?? 50;
}

// ─── Level Curve ────────────────────────────────────────────────────────────

/**
 * Cumulative XP required to reach a given level.
 * xpRequired(1) = 0
 * xpRequired(2) = 290
 * xpRequired(N) = 40 + 125 × N × (N-1)   for N >= 3
 *
 * Derived from: delta(N→N+1) = 250×N for N >= 2, with delta(1→2) = 290.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 290;
  return 40 + 125 * level * (level - 1);
}

/**
 * XP needed to go from currentLevel to currentLevel+1.
 */
export function xpForNextLevel(currentLevel: number): number {
  return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel);
}

/**
 * Compute level from total XP using binary search.
 * Pure function — no DB access.
 */
export function levelFromXp(xp: number): number {
  if (xp < 290) return 1;
  let lo = 2;
  let hi = 200;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const required = xpForLevel(mid);
    if (required <= xp) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return hi;
}

/**
 * Level title based on level number.
 */
export function levelTitle(level: number): string {
  if (level >= 50) return 'Hall of Fame';
  if (level >= 20) return 'Icon';
  if (level >= 10) return 'Legend';
  if (level >= 5) return 'Star';
  if (level >= 3) return 'Striker';
  if (level >= 2) return 'Captain';
  return 'Rookie';
}

// ─── Award XP Interface ─────────────────────────────────────────────────────

export interface AwardXpInput {
  userId: string;
  action: XpActionType;
  idempotencyKey?: string;
  dailyCap?: number;
  amount?: number;
  timezone: string;
  metadata?: Record<string, unknown>;
}

export interface AwardXpResult {
  awarded: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  previousLevel: number;
  reason?: 'duplicate' | 'cap_reached' | 'invalid' | 'ok';
}

export interface XpEvent {
  action: XpActionType;
  amount: number;
  leveledUp: boolean;
  newLevel: number;
  newTitle?: string;
}

// ─── Core Award Function ────────────────────────────────────────────────────

/**
 * Award XP to a user. Handles idempotency, daily caps, level computation,
 * and notification creation on level-up. All in one atomic transaction.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const { userId, action, idempotencyKey, dailyCap, timezone, metadata } = input;
  const amount = input.amount ?? XP_VALUES[action];

  if (amount <= 0 && action !== 'ADMIN_ADJUSTMENT') {
    return { awarded: 0, newXp: 0, newLevel: 1, leveledUp: false, previousLevel: 1, reason: 'invalid' };
  }

  // Compute today's date in user's timezone
  const todayStr = getUserToday(timezone);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      if (idempotencyKey) {
        const existing = await tx.xpTransaction.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        if (existing) {
          const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, level: true } });
          return { awarded: 0, newXp: user.xp, newLevel: user.level, leveledUp: false, previousLevel: user.level, reason: 'duplicate' as const };
        }
      }

      // 2. Daily cap check
      if (dailyCap !== undefined && dailyCap > 0) {
        const capRecord = await tx.xpDailyCap.upsert({
          where: { userId_action_date: { userId, action, date: todayStr } },
          create: { userId, action, date: todayStr, count: 0 },
          update: {},
        });

        if (capRecord.count >= dailyCap) {
          const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, level: true } });
          return { awarded: 0, newXp: user.xp, newLevel: user.level, leveledUp: false, previousLevel: user.level, reason: 'cap_reached' as const };
        }

        // Increment cap count
        await tx.xpDailyCap.update({
          where: { userId_action_date: { userId, action, date: todayStr } },
          data: { count: { increment: 1 } },
        });
      }

      // 3. Insert XP transaction
      await tx.xpTransaction.create({
        data: {
          userId,
          action,
          amount,
          idempotencyKey: idempotencyKey || null,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      // 4. Increment user XP and recompute level
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: amount }, lastActiveAt: new Date() },
        select: { xp: true, level: true },
      });

      const newLevel = levelFromXp(updatedUser.xp);
      const previousLevel = updatedUser.level;
      const leveledUp = newLevel > previousLevel;

      // 5. Update level if changed. The LEVEL_UP notification is dispatched
      //    *after* the transaction commits via notifyUser, so push/WS are
      //    not blocked on the DB transaction and we get proper localization
      //    + preference gating + idempotency.
      if (leveledUp) {
        await tx.user.update({
          where: { id: userId },
          data: { level: newLevel },
        });
      }

      return {
        awarded: amount,
        newXp: updatedUser.xp,
        newLevel,
        leveledUp,
        previousLevel,
        reason: 'ok' as const,
      };
    });

    if (result.awarded > 0) {
      logger.info('XP awarded', { userId, action, amount: result.awarded, newXp: result.newXp, newLevel: result.newLevel, leveledUp: result.leveledUp });

      // Push real-time update via SSE
      pushXpUpdate(userId, {
        xp: result.newXp,
        level: result.newLevel,
        xpGained: result.awarded,
        action,
        leveledUp: result.leveledUp,
        newTitle: result.leveledUp ? levelTitle(result.newLevel) : undefined,
      });
    }

    // Fire the LEVEL_UP notification out-of-band so a failure here can never
    // roll back the XP award. Idempotency key includes (userId, newLevel) so
    // repeated calls for the same level are silently coalesced.
    if (result.leveledUp) {
      notifyUser({
        userId,
        type: NotificationType.LEVEL_UP,
        titleKey: 'levelUpTitle',
        bodyKey: 'levelUpBody',
        vars: { level: String(result.newLevel) },
        data: {
          screen: '/(tabs)/profile',
          stat: 'level',
          previousLevel: result.previousLevel,
          newLevel: result.newLevel,
          title: levelTitle(result.newLevel),
        },
        idempotencyKey: `level-up:${userId}:${result.newLevel}`,
      }).catch((err) => {
        logger.warn('[xp] LEVEL_UP notify failed (non-fatal):', err?.message);
      });
    }

    return result;
  } catch (error: any) {
    // Handle unique constraint violation (P2002) for idempotency
    if (error.code === 'P2002' && idempotencyKey) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } });
      return {
        awarded: 0,
        newXp: user?.xp ?? 0,
        newLevel: user?.level ?? 1,
        leveledUp: false,
        previousLevel: user?.level ?? 1,
        reason: 'duplicate',
      };
    }
    logger.error('awardXp failed', { error: error.message, userId, action, idempotencyKey });
    throw error;
  }
}

// ─── Revert XP (for match cancellation) ─────────────────────────────────────

export async function revertXp(input: {
  userId: string;
  action: XpActionType;
  originalAmount: number;
  idempotencyKey: string;
  timezone: string;
  metadata?: Record<string, unknown>;
}): Promise<AwardXpResult> {
  const { userId, action, originalAmount, idempotencyKey, timezone, metadata } = input;
  const revertKey = `${idempotencyKey}:reverted`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if already reverted
      const existing = await tx.xpTransaction.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: revertKey } },
      });
      if (existing) {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, level: true } });
        return { awarded: 0, newXp: user.xp, newLevel: user.level, leveledUp: false, previousLevel: user.level, reason: 'duplicate' as const };
      }

      // Insert negative transaction
      await tx.xpTransaction.create({
        data: {
          userId,
          action,
          amount: -originalAmount,
          idempotencyKey: revertKey,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      // Decrement user XP (never below 0)
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, level: true } });
      const newXp = Math.max(0, user.xp - originalAmount);
      const newLevel = levelFromXp(newXp);

      await tx.user.update({
        where: { id: userId },
        data: { xp: newXp, level: newLevel },
      });

      return {
        awarded: -originalAmount,
        newXp,
        newLevel,
        leveledUp: false,
        previousLevel: user.level,
        reason: 'ok' as const,
      };
    });

    logger.info('XP reverted', { userId, action, amount: -input.originalAmount, newXp: result.newXp });
    return result;
  } catch (error: any) {
    if (error.code === 'P2002') {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } });
      return { awarded: 0, newXp: user?.xp ?? 0, newLevel: user?.level ?? 1, leveledUp: false, previousLevel: user?.level ?? 1, reason: 'duplicate' };
    }
    logger.error('revertXp failed', { error: error.message, userId, action });
    throw error;
  }
}

// ─── Daily Login Streak ─────────────────────────────────────────────────────

export async function awardDailyLogin(userId: string, timezone: string): Promise<AwardXpResult> {
  const todayStr = getUserToday(timezone);

  // Upsert login streak
  let streak = await prisma.loginStreak.findUnique({ where: { userId } });

  if (!streak) {
    streak = await prisma.loginStreak.create({
      data: { userId, current: 1, longest: 1, lastLoginDate: todayStr },
    });
  } else {
    if (streak.lastLoginDate === todayStr) {
      // Already counted today — no-op
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, level: true } });
      return { awarded: 0, newXp: user.xp, newLevel: user.level, leveledUp: false, previousLevel: user.level, reason: 'duplicate' };
    }

    const yesterday = getYesterday(todayStr);
    const twoDaysAgo = getYesterday(yesterday);
    let newCurrent: number;

    if (streak.lastLoginDate === yesterday) {
      // Consecutive day — increment normally
      newCurrent = streak.current + 1;
    } else if (streak.lastLoginDate === twoDaysAgo) {
      // Missed exactly 1 day — check for streak freeze
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { streakFreezes: true } });
      if (user.streakFreezes > 0) {
        // Use a streak freeze
        await prisma.user.update({ where: { id: userId }, data: { streakFreezes: { decrement: 1 } } });
        newCurrent = streak.current + 1; // Keep streak intact

        // Log the freeze usage as an XP transaction (0 XP)
        await prisma.xpTransaction.create({
          data: {
            userId,
            action: 'STREAK_FREEZE_USED',
            amount: 0,
            idempotencyKey: `streak-freeze:${yesterday}`,
            metadata: { frozenDate: yesterday, streakDay: streak.current },
          },
        });

        logger.info('Streak freeze used', { userId, frozenDate: yesterday, streakDay: streak.current });
      } else {
        // No freeze available — reset streak
        newCurrent = 1;
      }
    } else {
      // More than 2 days missed — reset streak (freeze only covers 1 day)
      newCurrent = 1;
    }

    const newLongest = Math.max(streak.longest, newCurrent);

    streak = await prisma.loginStreak.update({
      where: { userId },
      data: { current: newCurrent, longest: newLongest, lastLoginDate: todayStr },
    });
  }

  // Update User.consecutiveLoginDays to keep existing UI working
  await prisma.user.update({
    where: { id: userId },
    data: { consecutiveLoginDays: streak.current, lastLoginDate: new Date() },
  });

  // Award XP based on streak day
  const xpAmount = getLoginStreakXp(streak.current);

  return awardXp({
    userId,
    action: 'DAILY_LOGIN',
    idempotencyKey: `login:${todayStr}`,
    amount: xpAmount,
    timezone,
    metadata: { streakDay: streak.current },
  });
}

/**
 * Grant streak freeze items to a user.
 * Used by admin endpoints or Lucky Wheel rewards.
 */
export async function grantStreakFreeze(userId: string, amount: number): Promise<{ newTotal: number }> {
  if (amount <= 0) throw new Error('Amount must be positive');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { streakFreezes: { increment: amount } },
    select: { streakFreezes: true },
  });
  logger.info('Streak freeze granted', { userId, amount, newTotal: user.streakFreezes });
  return { newTotal: user.streakFreezes };
}

// ─── Social Link Validation ─────────────────────────────────────────────────

const SOCIAL_LINK_PATTERNS: Record<string, RegExp> = {
  instagram: /^https?:\/\/(www\.)?instagram\.com\//i,
  twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i,
  tiktok: /^https?:\/\/(www\.)?tiktok\.com\//i,
  snapchat: /^https?:\/\/(www\.)?snapchat\.com\//i,
};

export function isValidSocialUrl(platform: string, url: string): boolean {
  const pattern = SOCIAL_LINK_PATTERNS[platform.toLowerCase()];
  if (!pattern) return false;
  return pattern.test(url);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUserToday(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now); // YYYY-MM-DD
  } catch {
    // Fallback to UTC
    return new Date().toISOString().slice(0, 10);
  }
}

function getYesterday(todayStr: string): string {
  const d = new Date(todayStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
