import prisma from '../lib/prisma';
import { listBadgeDefinitions, listUserEliteBadges } from './elite-badge.service';
import { getKingLeaderboard, type KingMode, type KingPeriod } from './king-prediction.service';
import { getTsfLeaderboard, type TsfPeriod } from './top-scorers-five.service';
import { coachKingUserStanding } from './coach-king.service';
import { ensureCurrentCycle, getMyStanding } from './share-win.service';
import { logger } from '../utils/logger';

export type AchievementStatus = 'done' | 'progress' | 'locked';

export interface ProfileTitleItem {
  id: string;
  kind: 'elite' | 'milestone';
  key: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  accent?: string | null;
  status: AchievementStatus;
  progress?: string | null;
  progressPct?: number | null;
  permanent?: boolean;
  active?: boolean;
}

export interface ProfileStandItem {
  id: string;
  competitionKey:
    | 'king_results'
    | 'king_predictions'
    | 'top_scorers'
    | 'coach_king'
    | 'share_win';
  periodKey: 'week' | 'season' | 'round' | 'month';
  rank: number | null;
  score: number;
  scoreLabel: 'xp' | 'points' | 'participants';
}

export interface ProfileAchievementsBundle {
  titles: ProfileTitleItem[];
  stands: ProfileStandItem[];
  summary: {
    done: number;
    total: number;
    bestRank: number | null;
  };
}

function milestoneStatus(current: number, target: number): {
  status: AchievementStatus;
  progress: string;
  progressPct: number;
} {
  if (current >= target) {
    return { status: 'done', progress: `${target}/${target}`, progressPct: 1 };
  }
  if (current <= 0) {
    return { status: 'locked', progress: `0/${target}`, progressPct: 0 };
  }
  return {
    status: 'progress',
    progress: `${Math.min(current, target)}/${target}`,
    progressPct: Math.min(1, current / target),
  };
}

async function buildMilestones(userId: string): Promise<ProfileTitleItem[]> {
  const [predictionCount, correctCount, followers, user, maxReelViews] = await Promise.all([
    prisma.prediction.count({ where: { userId } }),
    prisma.prediction.count({ where: { userId, isCorrect: true } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, coins: true },
    }),
    prisma.reel
      .aggregate({
        where: { userId, isDeleted: false },
        _max: { views: true },
      })
      .catch(() => ({ _max: { views: 0 } })),
  ]);

  const level = user?.level ?? 1;
  const coins = user?.coins ?? 0;
  const reelViews = maxReelViews._max.views ?? 0;

  const first = milestoneStatus(predictionCount, 1);
  const expert = milestoneStatus(correctCount, 10);
  const community = milestoneStatus(followers, 100);
  const coinsGoal = milestoneStatus(coins, 10000);
  const reelStar = milestoneStatus(reelViews, 1000);
  const legend = milestoneStatus(level, 50);

  return [
    {
      id: 'milestone:first_prediction',
      kind: 'milestone',
      key: 'first_prediction',
      titleAr: 'أول توقع',
      titleEn: 'First prediction',
      descriptionAr: 'سجّل أول توقع لك',
      descriptionEn: 'Make your first prediction',
      status: first.status,
      progress: first.progress,
      progressPct: first.progressPct,
    },
    {
      id: 'milestone:predictions_expert',
      kind: 'milestone',
      key: 'predictions_expert',
      titleAr: 'خبير التوقعات',
      titleEn: 'Predictions expert',
      descriptionAr: '١٠ توقعات صحيحة',
      descriptionEn: '10 correct predictions',
      status: expert.status,
      progress: expert.progress,
      progressPct: expert.progressPct,
    },
    {
      id: 'milestone:community_star',
      kind: 'milestone',
      key: 'community_star',
      titleAr: 'نجم المجتمع',
      titleEn: 'Community star',
      descriptionAr: '١٠٠ متابع',
      descriptionEn: '100 followers',
      status: community.status,
      progress: community.progress,
      progressPct: community.progressPct,
    },
    {
      id: 'milestone:coin_collector',
      kind: 'milestone',
      key: 'coin_collector',
      titleAr: 'جامع العملات',
      titleEn: 'Coin collector',
      descriptionAr: '١٠٬٠٠٠ عملة',
      descriptionEn: '10,000 coins',
      status: coinsGoal.status,
      progress: coinsGoal.progress,
      progressPct: coinsGoal.progressPct,
    },
    {
      id: 'milestone:reel_star',
      kind: 'milestone',
      key: 'reel_star',
      titleAr: 'نجم الريلز',
      titleEn: 'Reel star',
      descriptionAr: '١٠٠٠ مشاهدة على ريل',
      descriptionEn: '1,000 views on a reel',
      status: reelStar.status,
      progress: reelStar.progress,
      progressPct: reelStar.progressPct,
    },
    {
      id: 'milestone:legend',
      kind: 'milestone',
      key: 'legend',
      titleAr: 'أسطورة 90plus',
      titleEn: '90plus Legend',
      descriptionAr: 'الوصول للمستوى ٥٠',
      descriptionEn: 'Reach level 50',
      status: legend.status,
      progress: legend.progress,
      progressPct: legend.progressPct,
    },
  ];
}

async function kingStand(
  clerkUserId: string,
  mode: KingMode,
  period: KingPeriod,
): Promise<{ rank: number | null; score: number }> {
  try {
    const board = await getKingLeaderboard({
      clerkUserId,
      mode,
      period,
      limit: 1,
    });
    return {
      rank: board.me?.rank ?? null,
      score: board.me?.xp ?? 0,
    };
  } catch (err) {
    logger.warn('[profile-achievements] king stand failed', err);
    return { rank: null, score: 0 };
  }
}

async function tsfStand(
  clerkUserId: string,
  period: TsfPeriod,
): Promise<{ rank: number | null; score: number }> {
  try {
    const board = await getTsfLeaderboard({
      clerkUserId,
      period,
      limit: 1,
      allLeagues: true,
    });
    return {
      rank: board.me?.rank ?? null,
      score: board.me?.xp ?? 0,
    };
  } catch (err) {
    logger.warn('[profile-achievements] tsf stand failed', err);
    return { rank: null, score: 0 };
  }
}

async function buildStands(userId: string, clerkUserId: string | null): Promise<ProfileStandItem[]> {
  const empty = { rank: null as number | null, score: 0 };
  const [results, predictions, scorers, coach, shareCycle] = await Promise.all([
    clerkUserId ? kingStand(clerkUserId, 'exact', 'week') : Promise.resolve(empty),
    clerkUserId ? kingStand(clerkUserId, 'winner', 'week') : Promise.resolve(empty),
    clerkUserId ? tsfStand(clerkUserId, 'all') : Promise.resolve(empty),
    coachKingUserStanding(userId, 'week').catch((err) => {
      logger.warn('[profile-achievements] coach stand failed', err);
      return { rank: null as number | null, points: 0 };
    }),
    ensureCurrentCycle()
      .then(async (cycle) => {
        const standing = await getMyStanding(cycle.id, userId);
        const score = standing?.score ?? standing?.participants ?? 0;
        const hasEntry = !!standing && (standing.score > 0 || standing.participants > 0 || standing.shares > 0);
        return {
          rank: hasEntry ? standing.rank : null,
          score,
        };
      })
      .catch((err) => {
        logger.warn('[profile-achievements] share-win stand failed', err);
        return { rank: null as number | null, score: 0 };
      }),
  ]);

  return [
    {
      id: 'king_results',
      competitionKey: 'king_results',
      periodKey: 'week',
      rank: results.rank,
      score: results.score,
      scoreLabel: 'xp',
    },
    {
      id: 'top_scorers',
      competitionKey: 'top_scorers',
      periodKey: 'season',
      rank: scorers.rank,
      score: scorers.score,
      scoreLabel: 'points',
    },
    {
      id: 'king_predictions',
      competitionKey: 'king_predictions',
      periodKey: 'week',
      rank: predictions.rank,
      score: predictions.score,
      scoreLabel: 'xp',
    },
    {
      id: 'coach_king',
      competitionKey: 'coach_king',
      periodKey: 'round',
      rank: coach.rank,
      score: coach.points,
      scoreLabel: 'points',
    },
    {
      id: 'share_win',
      competitionKey: 'share_win',
      periodKey: 'month',
      rank: shareCycle.rank,
      score: shareCycle.score,
      scoreLabel: 'participants',
    },
  ];
}

function buildEliteTitles(
  awards: Awaited<ReturnType<typeof listUserEliteBadges>>,
  definitions: Awaited<ReturnType<typeof listBadgeDefinitions>>,
): ProfileTitleItem[] {
  const earned = awards.filter((row) => !row.revokedAt);
  const earnedByKey = new Map<string, (typeof earned)[number]>();
  for (const row of earned) {
    const current = earnedByKey.get(row.key);
    if (!current || (row.active && !current.active)) {
      earnedByKey.set(row.key, row);
    }
  }

  const titles: ProfileTitleItem[] = [...earnedByKey.values()].map((row) => ({
    id: `elite:${row.id}`,
    kind: 'elite' as const,
    key: row.key,
    titleAr: row.title || row.nameAr,
    titleEn: row.title || row.nameEn,
    descriptionAr: row.description,
    descriptionEn: row.description,
    accent: row.accent,
    status: 'done' as const,
    permanent: row.permanent,
    active: row.active,
  }));

  for (const def of definitions) {
    if (earnedByKey.has(def.key)) continue;
    titles.push({
      id: `elite_locked:${def.key}`,
      kind: 'elite',
      key: def.key,
      titleAr: def.nameAr,
      titleEn: def.nameEn,
      descriptionAr: null,
      descriptionEn: null,
      accent: def.accent,
      status: 'locked',
      permanent: false,
      active: false,
    });
  }

  return titles;
}

/**
 * Full achievements + competition stands for a profile (own or public).
 */
export async function getProfileAchievementsBundle(userId: string): Promise<ProfileAchievementsBundle | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, clerkUserId: true },
  });
  if (!user) return null;

  const [awards, definitions, milestones, stands] = await Promise.all([
    listUserEliteBadges(userId),
    listBadgeDefinitions(),
    buildMilestones(userId),
    buildStands(user.id, user.clerkUserId),
  ]);

  const eliteTitles = buildEliteTitles(awards, definitions);
  // Earned / in-progress first, locked catalog last
  const titles = [...milestones, ...eliteTitles].sort((a, b) => {
    const order = { done: 0, progress: 1, locked: 2 };
    return order[a.status] - order[b.status];
  });

  const done = titles.filter((t) => t.status === 'done').length;
  const ranked = stands.map((s) => s.rank).filter((r): r is number => typeof r === 'number' && r > 0);
  const bestRank = ranked.length ? Math.min(...ranked) : null;

  return {
    titles,
    stands,
    summary: {
      done,
      total: titles.length,
      bestRank,
    },
  };
}
