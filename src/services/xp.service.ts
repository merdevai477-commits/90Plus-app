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

/**
 * King of Predictions — the same two values for a solo and a group prediction.
 * An exact score is worth 5 IN TOTAL, not 2 + 5: the resolver awards ONE of
 * these actions per settled prediction, never both.
 */
const PREDICTION_XP_WINNER = 2;
const PREDICTION_XP_EXACT = 5;

const GROUP_PREDICTION_XP_VALUES = {
  GROUP_PREDICTION_WINNER: PREDICTION_XP_WINNER,
  GROUP_PREDICTION_EXACT: PREDICTION_XP_EXACT,
} satisfies Record<'GROUP_PREDICTION_WINNER' | 'GROUP_PREDICTION_EXACT', number>;

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
  PREDICTION_EXACT: PREDICTION_XP_EXACT,
  PREDICTION_WINNER: PREDICTION_XP_WINNER,
  ...GROUP_PREDICTION_XP_VALUES,
  /** One question answered correctly. A wrong one costs the same, see QUIZ_ANSWER_WRONG. */
  QUIZ_ANSWER_CORRECT: 1,
  QUIZ_ANSWER_WRONG: 1,
  /**
   * RETIRED. The "finished a quiz with ≥80%" bonus is no longer awarded: a
   * question is worth ±1 XP and nothing else (quiz-daily.service.ts). The
   * action stays in the enum so the rows it already wrote still read back, and
   * the value is 0 so awardXp would refuse it as invalid if anything ever
   * called it again.
   */
  QUIZ_COMPLETED_HIGH: 0,
  DAILY_LOGIN: 5, // base; actual value comes from LOGIN_STREAK_TABLE
  /** One valid share of the app. */
  APP_SHARE: 1,
  REFERRAL_CONVERSION: 50, // Share & Win — a referred friend completed registration

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
 * THE LEVEL CURVE — one hundred XP per level.
 *
 *   Level 1 ....... 100 XP
 *   Level 2 ....... 200 XP
 *   Level 3 ....... 300 XP
 *   …
 *   Level 100 ... 10 000 XP
 *
 * i.e. the XP a user must hold to BE level N is `N × 100`, and a level is
 * therefore 100 XP wide. This replaced a quadratic curve
 * (`40 + 125·N·(N−1)`, level 2 at 290 XP) that no longer matches the product.
 *
 * A brand-new account holds 0 XP and is level 1: `LEVEL_ONE` is the floor,
 * not a threshold anybody has to reach.
 */
export const XP_PER_LEVEL = 100;
const LEVEL_ONE = 1;

/** XP a user must hold to be `level`. */
export function xpForLevel(level: number): number {
  return Math.max(level, LEVEL_ONE) * XP_PER_LEVEL;
}

/**
 * XP needed to go from currentLevel to currentLevel+1 — one level's width.
 */
export function xpForNextLevel(currentLevel: number): number {
  return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel);
}

/**
 * Level for an XP total. Pure — no DB access.
 *
 * Every consumer (profile, header, leaderboards, the app) must derive the
 * level through THIS function; a second formula anywhere else is how a user
 * ends up being two different levels on two screens.
 */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return LEVEL_ONE;
  return Math.max(LEVEL_ONE, Math.floor(xp / XP_PER_LEVEL));
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
  reason?: 'duplicate' | 'cap_reached' | 'invalid' | 'ok' | 'cooldown';
  nextEligibleAt?: string;
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

// ─── Take XP away (wrong answers) ───────────────────────────────────────────

/**
 * Charge a user XP — the mirror of `awardXp`, through the SAME ledger.
 *
 * Used for the wrong-answer penalty, which the product prices at 1 XP. It is
 * one transaction: the negative `xp_transactions` row and the balance change
 * commit together, so a balance can never move without its history line (or
 * the other way round).
 *
 * Two rules the callers depend on:
 *  • IDEMPOTENT. `idempotencyKey` is unique per (user, key), so a double tap,
 *    a retried request or a resubmitted answer charges once. A repeat returns
 *    the current balance with `awarded: 0`.
 *  • NEVER NEGATIVE. The charge is clamped to what the user actually holds, so
 *    XP has a floor of zero and the level derived from it stays valid.
 */
export async function penalizeXp(input: {
  userId: string;
  action: XpActionType;
  amount?: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<AwardXpResult> {
  const { userId, action, idempotencyKey, metadata } = input;
  const requested = Math.abs(input.amount ?? XP_VALUES[action]);

  if (!Number.isFinite(requested) || requested <= 0) {
    return { awarded: 0, newXp: 0, newLevel: 1, leveledUp: false, previousLevel: 1, reason: 'invalid' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.xpTransaction.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      const current = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { xp: true, level: true },
      });

      if (existing) {
        return {
          awarded: 0,
          newXp: current.xp,
          newLevel: current.level,
          leveledUp: false,
          previousLevel: current.level,
          reason: 'duplicate' as const,
        };
      }

      // Never below zero: the charge is what the user can actually pay.
      const charged = Math.min(current.xp, requested);
      const newXp = current.xp - charged;
      const newLevel = levelFromXp(newXp);

      await tx.xpTransaction.create({
        data: {
          userId,
          action,
          amount: -charged,
          idempotencyKey,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { xp: newXp, level: newLevel, lastActiveAt: new Date() },
      });

      return {
        awarded: -charged,
        newXp,
        newLevel,
        leveledUp: false,
        previousLevel: current.level,
        reason: 'ok' as const,
      };
    });

    if (result.awarded !== 0) {
      logger.info('XP charged', { userId, action, amount: result.awarded, newXp: result.newXp });
      pushXpUpdate(userId, {
        xp: result.newXp,
        level: result.newLevel,
        xpGained: result.awarded,
        action,
        leveledUp: false,
      });
    }

    return result;
  } catch (error: any) {
    // Lost the idempotency race — somebody else charged for this exact action.
    if (error.code === 'P2002') {
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
    logger.error('penalizeXp failed', { error: error.message, userId, action, idempotencyKey });
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

// ─── App Share Reward (XP_VALUES.APP_SHARE per 24h) ─────────────────────────

const APP_SHARE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface AppShareStatus {
  eligible: boolean;
  rewardXp: number;
  nextEligibleAt: string | null;
}

export async function getAppShareStatus(userId: string): Promise<AppShareStatus> {
  const last = await prisma.xpTransaction.findFirst({
    where: { userId, action: 'APP_SHARE' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const rewardXp = XP_VALUES.APP_SHARE;
  if (!last) {
    return { eligible: true, rewardXp, nextEligibleAt: null };
  }

  const nextEligible = new Date(last.createdAt.getTime() + APP_SHARE_COOLDOWN_MS);
  if (Date.now() >= nextEligible.getTime()) {
    return { eligible: true, rewardXp, nextEligibleAt: null };
  }

  return {
    eligible: false,
    rewardXp,
    nextEligibleAt: nextEligible.toISOString(),
  };
}

export async function awardAppShare(userId: string, timezone: string): Promise<AwardXpResult> {
  const status = await getAppShareStatus(userId);
  if (!status.eligible) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, level: true },
    });
    return {
      awarded: 0,
      newXp: user.xp,
      newLevel: user.level,
      leveledUp: false,
      previousLevel: user.level,
      reason: 'cooldown',
      nextEligibleAt: status.nextEligibleAt ?? undefined,
    };
  }

  /*
   * The key names the COOLDOWN WINDOW, not the moment of the request.
   *
   * It used to be `app-share:${userId}:${Date.now()}` — a value that differs on
   * every call, which meant the idempotency table could never recognise a
   * repeat: two taps, or a retried request whose response was lost, both
   * passed the eligibility read above and both paid out. Keyed by the day the
   * share belongs to, the second one is a duplicate and awards nothing.
   */
  return awardXp({
    userId,
    action: 'APP_SHARE',
    amount: XP_VALUES.APP_SHARE,
    timezone,
    idempotencyKey: `app-share:${userId}:${getUserToday(timezone)}`,
    metadata: { source: 'app_share' },
  });
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
