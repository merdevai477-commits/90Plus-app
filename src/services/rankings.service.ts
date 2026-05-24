/**
 * Rankings Service — shared logic for leaderboard endpoints and badge cron.
 */

import prisma from '../lib/prisma';

export type RankPeriod = 'weekly' | 'monthly' | '3_days';

export function getPeriodStartDate(period: RankPeriod): Date {
  const start = new Date();
  if (period === 'monthly') {
    start.setMonth(start.getMonth() - 1);
  } else if (period === 'weekly') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 3);
  }
  return start;
}

export interface TopPlayerRow {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  isVerified: boolean;
  level: number;
  /** XP earned within the requested period (ranking metric). */
  xp: number;
  lifetimeXp: number;
  position: string;
  countryFlag: string;
  clubLogo: string | null;
  followersCount: number;
  stats: { totalViews: number; totalLikes: number; profileViews: number };
  score: number;
  rank: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

/**
 * Top players ranked by XP earned in the period, with engagement score and
 * lifetime XP as tiebreakers.
 */
export async function getTopPlayers(
  limit: number,
  period: 'weekly' | 'monthly',
): Promise<TopPlayerRow[]> {
  const take = Math.min(limit, 50);
  const startDate = getPeriodStartDate(period);

  const periodXpRows = await prisma.xpTransaction.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: startDate }, amount: { gt: 0 } },
    _sum: { amount: true },
  });

  if (periodXpRows.length === 0) {
    return [];
  }

  const periodXpMap = new Map<string, number>(
    periodXpRows.map((r) => [r.userId, r._sum.amount ?? 0]),
  );

  const candidateIds = [...periodXpMap.keys()];

  const users = await prisma.user.findMany({
    where: {
      id: { in: candidateIds },
      isDeleted: false,
      isBanned: false,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      isVerified: true,
      level: true,
      xp: true,
      profileViews: true,
      position: true,
      countryFlag: true,
      clubLogo: true,
      reels: {
        where: { createdAt: { gte: startDate } },
        select: {
          views: true,
          _count: { select: { likes: true } },
        },
      },
      _count: { select: { followers: true } },
    },
  });

  const scored = users.map((user) => {
    const totalViews = user.reels.reduce((sum, reel) => sum + (reel.views || 0), 0);
    const totalLikes = user.reels.reduce(
      (sum, reel) => sum + (reel._count?.likes || 0),
      0,
    );
    const periodXp = periodXpMap.get(user.id) ?? 0;
    const score = totalViews * 1 + totalLikes * 3;

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isVerified: user.isVerified,
      level: user.level,
      xp: periodXp,
      lifetimeXp: user.xp,
      position: user.position || 'ST',
      countryFlag: user.countryFlag || '🏳️',
      clubLogo: user.clubLogo,
      followersCount: user._count.followers,
      stats: { totalViews, totalLikes, profileViews: user.profileViews || 0 },
      score,
    };
  });

  return scored
    .sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.score !== a.score) return b.score - a.score;
      if (b.lifetimeXp !== a.lifetimeXp) return b.lifetimeXp - a.lifetimeXp;
      return a.id.localeCompare(b.id);
    })
    .slice(0, take)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
      badge:
        index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
    }));
}

export async function computeGlobalXpRank(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, isDeleted: true, isBanned: true },
  });
  if (!user || user.isDeleted || user.isBanned) return null;

  const higherCount = await prisma.user.count({
    where: {
      isDeleted: false,
      isBanned: false,
      xp: { gt: user.xp },
    },
  });
  return higherCount + 1;
}

/** Returns 1-based rank or null if outside top `maxRank`. */
function rankFromSortedList(
  sortedUserIds: string[],
  userId: string,
  maxRank: number,
): number | null {
  const idx = sortedUserIds.findIndex((id) => id === userId);
  if (idx < 0 || idx >= maxRank) return null;
  return idx + 1;
}

export async function getUserCategoryRanks(userId: string): Promise<{
  views: number | null;
  shares: number | null;
  predictions: number | null;
  comments: number | null;
  globalXpRank: number | null;
}> {
  const since = getPeriodStartDate('3_days');
  const maxRank = 10;

  const [viewsAgg, sharesAgg, predictionsAgg, commentersAgg, globalXpRank] =
    await Promise.all([
      prisma.reel.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since } },
        _sum: { views: true },
        orderBy: { _sum: { views: 'desc' } },
      }),
      prisma.reel.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since }, sharesCount: { gt: 0 } },
        _sum: { sharesCount: true },
        orderBy: { _sum: { sharesCount: 'desc' } },
      }),
      prisma.prediction.groupBy({
        by: ['userId'],
        where: {
          isCorrect: true,
          resolvedAt: { gte: since },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.comment.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      computeGlobalXpRank(userId),
    ]);

  return {
    views: rankFromSortedList(
      viewsAgg.map((r) => r.userId),
      userId,
      maxRank,
    ),
    shares: rankFromSortedList(
      sharesAgg.map((r) => r.userId),
      userId,
      maxRank,
    ),
    predictions: rankFromSortedList(
      predictionsAgg.map((r) => r.userId),
      userId,
      maxRank,
    ),
    comments: rankFromSortedList(
      commentersAgg.map((r) => r.userId),
      userId,
      maxRank,
    ),
    globalXpRank,
  };
}

export type BadgeCategory = 'views' | 'shares' | 'comments' | 'predictions';

export async function getCategoryRankingList(
  category: BadgeCategory,
  take = 100,
): Promise<Array<{ rank: number; userId: string }>> {
  const since = getPeriodStartDate('3_days');

  if (category === 'views') {
    const agg = await prisma.reel.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _sum: { views: true },
      orderBy: { _sum: { views: 'desc' } },
      take,
    });
    return agg.map((r, i) => ({ rank: i + 1, userId: r.userId }));
  }
  if (category === 'shares') {
    const agg = await prisma.reel.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since }, sharesCount: { gt: 0 } },
      _sum: { sharesCount: true },
      orderBy: { _sum: { sharesCount: 'desc' } },
      take,
    });
    return agg.map((r, i) => ({ rank: i + 1, userId: r.userId }));
  }
  if (category === 'comments') {
    const agg = await prisma.comment.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take,
    });
    return agg.map((r, i) => ({ rank: i + 1, userId: r.userId }));
  }
  const agg = await prisma.prediction.groupBy({
    by: ['userId'],
    where: { isCorrect: true, resolvedAt: { gte: since } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take,
  });
  return agg.map((r, i) => ({ rank: i + 1, userId: r.userId }));
}

/**
 * Award ranking badges for a category (per-user aggregation, not per-reel).
 */
export async function awardCategoryBadges(
  category: BadgeCategory,
  period = '3_days',
): Promise<number> {
  const rankedUsers = await getCategoryRankingList(category, 100);

  let count = 0;
  for (const user of rankedUsers) {
    let badgeType: string;
    if (user.rank === 1) badgeType = 'gold';
    else if (user.rank === 2) badgeType = 'silver';
    else if (user.rank === 3) badgeType = 'bronze';
    else badgeType = `rank_${user.rank}`;

    await prisma.rankingBadge.create({
      data: {
        userId: user.userId,
        badgeType,
        category,
        period,
        rank: user.rank,
      },
    });
    count++;
  }
  return count;
}

export async function runDailyRankingBadgesCron(): Promise<void> {
  const categories: BadgeCategory[] = ['views', 'shares', 'comments', 'predictions'];
  for (const category of categories) {
    await awardCategoryBadges(category, '3_days');
  }
}
