/**
 * Durable invite-click capture for Share & Win.
 * Matching uses clickId (+ referral code). IP is hashed for abuse analysis only.
 */

import { createHash, randomBytes } from 'crypto';
import {
  Prisma,
  ShareWinInvitePlatform,
  type ShareWinInviteClick,
} from '@prisma/client';

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  isValidReferralCode,
  normalizeReferralCode,
} from './share-win.service';

const CLICK_ID_BYTES = 12; // → 16 base64url chars

export function generateClickId(): string {
  return randomBytes(CLICK_ID_BYTES).toString('base64url');
}

export function hashIpForAbuse(ip: string | null | undefined): string | null {
  if (!ip || !String(ip).trim()) return null;
  return createHash('sha256').update(String(ip).trim()).digest('hex').slice(0, 32);
}

export function detectInvitePlatform(
  userAgent: string | undefined,
): ShareWinInvitePlatform {
  const ua = userAgent ?? '';
  if (/Android/i.test(ua)) return ShareWinInvitePlatform.android;
  if (/iPhone|iPad|iPod/i.test(ua)) return ShareWinInvitePlatform.ios;
  return ShareWinInvitePlatform.other;
}

export interface RecordInviteClickInput {
  code: string;
  userAgent?: string;
  ip?: string | null;
}

export async function recordInviteClick(
  input: RecordInviteClickInput,
): Promise<ShareWinInviteClick | null> {
  const code = normalizeReferralCode(input.code);
  if (!isValidReferralCode(code)) return null;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, isDeleted: true, isBanned: true },
  });

  // Still record the click when the code alphabet is valid even if the owner
  // is missing — claim will reject inactive referrers later.
  const clickId = generateClickId();
  try {
    return await prisma.shareWinInviteClick.create({
      data: {
        clickId,
        referralCode: code,
        referrerId: referrer && !referrer.isDeleted && !referrer.isBanned ? referrer.id : referrer?.id ?? null,
        platform: detectInvitePlatform(input.userAgent),
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        ipHash: hashIpForAbuse(input.ip),
      },
    });
  } catch (err) {
    logger.error('[ShareWin] recordInviteClick failed:', err);
    return null;
  }
}

export interface MarkFirstOpenInput {
  clickId: string;
  installId?: string | null;
  platform?: string | null;
  appVersion?: string | null;
}

/**
 * Idempotent first-open stamp. Never reveals whether the click exists.
 */
export async function markInviteFirstOpen(input: MarkFirstOpenInput): Promise<void> {
  const clickId = String(input.clickId ?? '').trim();
  if (!clickId || clickId.length < 8) return;

  try {
    const existing = await prisma.shareWinInviteClick.findUnique({
      where: { clickId },
      select: { id: true, installedAt: true },
    });
    if (!existing) return;
    if (existing.installedAt) return;

    const platform =
      input.platform === 'android'
        ? ShareWinInvitePlatform.android
        : input.platform === 'ios'
          ? ShareWinInvitePlatform.ios
          : undefined;

    await prisma.shareWinInviteClick.update({
      where: { clickId },
      data: {
        installedAt: new Date(),
        installId: input.installId?.slice(0, 64) || null,
        appVersion: input.appVersion?.slice(0, 64) || null,
        ...(platform ? { platform } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return;
    }
    logger.error('[ShareWin] markInviteFirstOpen failed:', { clickId, err });
  }
}

export async function getInviteClickByClickId(clickId: string) {
  return prisma.shareWinInviteClick.findUnique({
    where: { clickId },
  });
}
