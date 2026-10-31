/**
 * Attributes a Play Store install when the installed app never reports a code.
 *
 * The production Play build (1.1.2, Oct 16) parks an invite only if the https
 * link opens the app. A cold install opens from the Play "Open" button, which
 * carries no URL, and that build does not read Play Install Referrer. The
 * landing page records the phone's public IP when an Android browser opens
 * /invite/:code. A minute after signup, if the app still has not claimed, the
 * same IP is matched to that code.
 *
 * The grace period lets a newer app claim the real code first. One code per
 * IP; a second different code on the same IP is a conflict and is ignored.
 */

import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import {
  claimReferral,
  REFERRAL_ATTRIBUTION_WINDOW_MS,
} from './share-win.service';

/** Let the device claim before this fallback runs. */
export const INSTALL_CLICK_GRACE_MS = 60 * 1000;
/** Click and pending-user keys expire together. */
const CLICK_TTL_SEC = 6 * 60 * 60;
/** Signup may be timestamped slightly before the click lands. */
const CLICK_SKEW_MS = 2 * 60 * 1000;

const CLICK_PREFIX = 'sw:install-click:';
const PENDING_PREFIX = 'sw:pending-attr:';
export const INSTALL_CLICK_CONFLICT = 'CONFLICT';

const PREVIEW_BOT =
  /facebookexternalhit|facebot|whatsapp\/|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|googlebot|bingbot|applebot|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator/i;

export function isAndroidInviteBrowser(userAgent: string | undefined): boolean {
  const ua = userAgent ?? '';
  if (!/Android/i.test(ua)) return false;
  if (PREVIEW_BOT.test(ua)) return false;
  return true;
}

/** Keep one code per IP. A different code invalidates the slot. */
export function mergeInstallClick(
  existing: string | null,
  code: string,
  clickedAt: number,
): string {
  if (!existing) return `${code}|${clickedAt}`;
  if (existing === INSTALL_CLICK_CONFLICT) return INSTALL_CLICK_CONFLICT;
  const cut = existing.lastIndexOf('|');
  const prevCode = cut > 0 ? existing.slice(0, cut) : existing;
  const prevAt = cut > 0 ? Number(existing.slice(cut + 1)) : clickedAt;
  if (!prevCode || prevCode !== code) return INSTALL_CLICK_CONFLICT;
  const at = Number.isFinite(prevAt) ? Math.min(prevAt, clickedAt) : clickedAt;
  return `${code}|${at}`;
}

export function parseInstallClick(
  raw: string | null,
): { code: string; clickedAt: number } | null {
  if (!raw || raw === INSTALL_CLICK_CONFLICT) return null;
  const cut = raw.lastIndexOf('|');
  if (cut <= 0) return null;
  const code = raw.slice(0, cut);
  const clickedAt = Number(raw.slice(cut + 1));
  if (!code || !Number.isFinite(clickedAt)) return null;
  return { code, clickedAt };
}

/**
 * True when this signup can still be the person who opened the invite.
 * Accounts older than the click, or older than the referral window, cannot.
 */
export function signupMatchesInstallClick(
  clickedAt: number,
  userCreatedAt: Date,
  now = new Date(),
): boolean {
  const created = userCreatedAt.getTime();
  const age = now.getTime() - created;
  if (age < 0 || age > REFERRAL_ATTRIBUTION_WINDOW_MS) return false;
  if (created + CLICK_SKEW_MS < clickedAt) return false;
  return true;
}

function pendingValue(ip: string, notBefore: number): string {
  return `${ip}|${notBefore}`;
}

function parsePending(raw: string | null): { ip: string; notBefore: number } | null {
  if (!raw) return null;
  const cut = raw.lastIndexOf('|');
  if (cut <= 0) return null;
  const ip = raw.slice(0, cut);
  const notBefore = Number(raw.slice(cut + 1));
  if (!ip || !Number.isFinite(notBefore)) return null;
  return { ip, notBefore };
}

async function redisOrNull() {
  if (process.env.NODE_ENV === 'test') return null;
  try {
    const { getRedisClient } = await import('../lib/redis');
    return getRedisClient();
  } catch (err) {
    logger.warn('[ShareWin] install-click redis unavailable:', err);
    return null;
  }
}

/** Record that this public IP opened an Android invite page. Never throws. */
export async function rememberInviteClick(ip: string, code: string, now = Date.now()): Promise<void> {
  const redis = await redisOrNull();
  if (!redis || !ip || !code) return;
  const key = `${CLICK_PREFIX}${ip}`;
  try {
    const existing = await redis.get(key);
    const next = mergeInstallClick(existing, code, now);
    await redis.set(key, next, 'EX', CLICK_TTL_SEC);
  } catch (err) {
    logger.warn('[ShareWin] failed to remember invite click:', err);
  }
}

/**
 * Queue a fallback attribution. The device has INSTALL_CLICK_GRACE_MS to
 * claim the code itself; after that, the IP match runs.
 */
export function scheduleInstallClickAttribution(
  userId: string,
  createdAt: Date,
  ip: string,
  now = Date.now(),
): void {
  if (!userId || !ip) return;
  const age = now - createdAt.getTime();
  if (age < 0 || age > REFERRAL_ATTRIBUTION_WINDOW_MS) return;

  const notBefore = now + INSTALL_CLICK_GRACE_MS;
  void redisOrNull()
    .then((redis) => {
      if (!redis) return null;
      return redis.set(
        `${PENDING_PREFIX}${userId}`,
        pendingValue(ip, notBefore),
        'EX',
        CLICK_TTL_SEC,
        'NX',
      );
    })
    .then((wrote) => {
      if (wrote !== 'OK') return;
      const timer = setTimeout(() => {
        void attributePendingInstallClick(userId);
      }, INSTALL_CLICK_GRACE_MS);
      timer.unref?.();
    })
    .catch((err) => logger.warn('[ShareWin] failed to schedule install attribution:', err));
}

export async function attributePendingInstallClick(userId: string, now = new Date()): Promise<void> {
  const redis = await redisOrNull();
  if (!redis || !userId) return;
  const pendingKey = `${PENDING_PREFIX}${userId}`;
  try {
    const pending = parsePending(await redis.get(pendingKey));
    if (!pending || pending.notBefore > now.getTime()) return;

    const existing = await prisma.shareWinReferral.findUnique({
      where: { referredUserId: userId },
      select: { id: true },
    });
    if (existing) {
      await redis.del(pendingKey);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true },
    });
    if (!user) {
      await redis.del(pendingKey);
      return;
    }

    const clickKey = `${CLICK_PREFIX}${pending.ip}`;
    const click = parseInstallClick(await redis.get(clickKey));
    if (!click || !signupMatchesInstallClick(click.clickedAt, user.createdAt, now)) {
      await redis.del(pendingKey);
      return;
    }

    const result = await claimReferral(userId, click.code, now);
    await redis.del(pendingKey);
    if (result.attributed) {
      await redis.del(clickKey);
      logger.info('[ShareWin] attributed install from invite click', { userId });
    }
  } catch (err) {
    logger.warn('[ShareWin] install-click attribution failed:', err);
  }
}

/** Backup for the in-process timer (restart between schedule and grace). */
export async function drainPendingInstallAttributions(now = new Date()): Promise<void> {
  const redis = await redisOrNull();
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${PENDING_PREFIX}*`, 'COUNT', 50);
      cursor = next;
      for (const key of keys) {
        const userId = key.slice(PENDING_PREFIX.length);
        if (userId) await attributePendingInstallClick(userId, now);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('[ShareWin] install-click drain failed:', err);
  }
}
