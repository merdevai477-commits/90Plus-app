/**
 * Share & Win admin funnel + zero-credit alert helper.
 */

import { Prisma } from '@prisma/client';

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export async function getShareWinFunnel(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [clicks, installs, registered, shares, credited, claimByResult, claimByVersion, lastClicks] =
    await Promise.all([
      prisma.shareWinInviteClick.count({ where: { createdAt: { gte: since } } }),
      prisma.shareWinInviteClick.count({
        where: { createdAt: { gte: since }, installedAt: { not: null } },
      }),
      prisma.shareWinInviteClick.count({
        where: { createdAt: { gte: since }, registeredAt: { not: null } },
      }),
      prisma.shareWinShareEvent.count({ where: { createdAt: { gte: since } } }),
      prisma.shareWinReferral.count({ where: { convertedAt: { gte: since } } }),
      prisma.shareWinClaimAttempt.groupBy({
        by: ['result'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.shareWinClaimAttempt.groupBy({
        by: ['appVersion', 'result'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.shareWinInviteClick.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          clickId: true,
          referralCode: true,
          referrerId: true,
          platform: true,
          createdAt: true,
          installedAt: true,
          registeredAt: true,
          referredUserId: true,
          claimSource: true,
          appVersion: true,
        },
      }),
    ]);

  const perSharer = await prisma.$queryRaw<
    Array<{
      referrerId: string | null;
      referralCode: string;
      clicks: number;
      installs: number;
      registered: number;
    }>
  >(Prisma.sql`
    SELECT
      "referrerId",
      "referralCode",
      COUNT(*)::int AS clicks,
      COUNT("installedAt")::int AS installs,
      COUNT("registeredAt")::int AS registered
    FROM share_win_invite_clicks
    WHERE "createdAt" >= ${since}
    GROUP BY "referrerId", "referralCode"
    ORDER BY clicks DESC
    LIMIT 50
  `);

  return {
    days,
    since: since.toISOString(),
    totals: {
      shares,
      clicks,
      installs,
      registered,
      credited,
      clickToInstallRate: clicks ? installs / clicks : 0,
      installToRegisterRate: installs ? registered / installs : 0,
      clickToRegisterRate: clicks ? registered / clicks : 0,
    },
    claimAttemptsByResult: claimByResult.map((r) => ({
      result: r.result,
      count: r._count._all,
    })),
    claimAttemptsByAppVersion: claimByVersion.map((r) => ({
      appVersion: r.appVersion,
      result: r.result,
      count: r._count._all,
    })),
    perSharer,
    lastClicks,
  };
}

/** Log an alert when shares are high but credits are zero in the last 24h. */
export async function maybeAlertShareWinZeroCredits(): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [shares, credited] = await Promise.all([
    prisma.shareWinShareEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.shareWinReferral.count({ where: { convertedAt: { gte: since } } }),
  ]);
  if (shares > 20 && credited === 0) {
    logger.error('[ShareWin] ALERT: high shares with zero credited referrals in 24h', {
      shares,
      credited,
      since: since.toISOString(),
    });
  }
}
