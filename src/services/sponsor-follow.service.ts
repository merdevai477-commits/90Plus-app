/**
 * Store-page follows for Predict & Win.
 *
 * Followers are notified when an admin publishes a new competition for that
 * sponsor — see `notifySponsorFollowersOfPublish`.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export async function isFollowingSponsor(userId: string, sponsorId: string): Promise<boolean> {
  const row = await prisma.sponsorFollow.findUnique({
    where: { userId_sponsorId: { userId, sponsorId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function followSponsor(userId: string, sponsorId: string): Promise<{ following: true }> {
  const sponsor = await prisma.sponsor.findUnique({
    where: { id: sponsorId },
    select: { id: true, isActive: true },
  });
  if (!sponsor || !sponsor.isActive) throw new Error('SPONSOR_NOT_FOUND');

  await prisma.sponsorFollow.upsert({
    where: { userId_sponsorId: { userId, sponsorId } },
    create: { userId, sponsorId },
    update: {},
  });
  return { following: true };
}

export async function unfollowSponsor(userId: string, sponsorId: string): Promise<{ following: false }> {
  await prisma.sponsorFollow.deleteMany({ where: { userId, sponsorId } });
  return { following: false };
}

export async function listSponsorFollowerIds(sponsorId: string): Promise<string[]> {
  const rows = await prisma.sponsorFollow.findMany({
    where: { sponsorId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Fan-out when a competition goes live. Never throws — publish must succeed. */
export async function notifySponsorFollowersOfPublish(opts: {
  sponsorId: string;
  sponsorName: string;
  competitionId: string;
  prizeName: string;
  homeTeam: string;
  awayTeam: string;
  /** Sponsor owner — skip so they do not get a fan notification for their own drop. */
  ownerId?: string | null;
}): Promise<void> {
  try {
    const followerIds = await listSponsorFollowerIds(opts.sponsorId);
    const recipients = followerIds.filter((id) => id && id !== opts.ownerId);
    if (recipients.length === 0) return;

    const { notifyUsers } = await import('./notify.service');
    const { NotificationType } = await import('./notification.service');

    await notifyUsers(
      recipients.map((userId) => ({
        userId,
        type: NotificationType.PREDICTION_RESULT,
        titleKey: 'competitionFollowerTitle' as const,
        bodyKey: 'competitionFollowerBody' as const,
        vars: {
          store: opts.sponsorName,
          prize: opts.prizeName,
          home: opts.homeTeam,
          away: opts.awayTeam,
        },
        data: {
          screen: `/predict-and-win/${opts.competitionId}`,
          entityId: opts.competitionId,
          kind: 'competition_follower_new',
          sponsorId: opts.sponsorId,
        },
        idempotencyKey: `competitionFollower:${opts.competitionId}:${userId}`,
      })),
      { concurrency: 20 },
    );
  } catch (err: any) {
    logger.warn('[SponsorFollow] notify followers failed:', err?.message ?? err);
  }
}
