import prisma from '../lib/prisma';

const CORRECT_PREDICTION_POINTS = 10;

export interface GroupMemberStatsSeed {
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  totalCorrect: number;
  totalResolved: number;
  weeklyCorrect: number;
  weeklyResolved: number;
  todayCorrect: number;
}

export interface GroupLeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  totalPoints: number;
  weeklyPoints: number;
  todayPoints: number;
  totalAccuracy: number;
  weeklyAccuracy: number;
  totalCorrect: number;
}

export interface GroupSummary {
  leaderboard: GroupLeaderboardRow[];
  currentUser: GroupLeaderboardRow | null;
  userInsight: {
    rank: number | null;
    pointsToNextRank: number | null;
    nextRank: number | null;
  };
  tabs: {
    overall: GroupLeaderboardRow[];
    weekly: GroupLeaderboardRow[];
    bestPrecisePrediction: GroupLeaderboardRow | null;
    topPointsToday: GroupLeaderboardRow | null;
  };
}

function toAccuracy(correct: number, resolved: number): number {
  if (resolved <= 0) return 0;
  return Math.round((correct / resolved) * 100);
}

export function startOfDayUtc(input = new Date()): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function startOfWeekUtc(input = new Date()): Date {
  const dayStart = startOfDayUtc(input);
  const day = dayStart.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  dayStart.setUTCDate(dayStart.getUTCDate() - diffToMonday);
  return dayStart;
}

function computeInsight(rows: GroupLeaderboardRow[], currentUserId: string): GroupSummary['userInsight'] {
  const current = rows.find((row) => row.userId === currentUserId);
  if (!current) {
    return { rank: null, pointsToNextRank: null, nextRank: null };
  }

  if (current.rank <= 1) {
    return { rank: 1, pointsToNextRank: null, nextRank: null };
  }

  const next = rows.find((row) => row.rank === current.rank - 1);
  if (!next) {
    return { rank: current.rank, pointsToNextRank: null, nextRank: null };
  }

  const pointsToNextRank = Math.max(0, next.totalPoints - current.totalPoints);
  return {
    rank: current.rank,
    pointsToNextRank,
    nextRank: next.rank,
  };
}

export function buildGroupSummary(
  seeds: GroupMemberStatsSeed[],
  currentUserId: string,
): GroupSummary {
  const leaderboard = [...seeds]
    .map((seed) => ({
      userId: seed.userId,
      username: seed.username,
      displayName: seed.displayName,
      avatar: seed.avatar,
      totalPoints: seed.totalCorrect * CORRECT_PREDICTION_POINTS,
      weeklyPoints: seed.weeklyCorrect * CORRECT_PREDICTION_POINTS,
      todayPoints: seed.todayCorrect * CORRECT_PREDICTION_POINTS,
      totalAccuracy: toAccuracy(seed.totalCorrect, seed.totalResolved),
      weeklyAccuracy: toAccuracy(seed.weeklyCorrect, seed.weeklyResolved),
      totalCorrect: seed.totalCorrect,
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.totalAccuracy !== a.totalAccuracy) return b.totalAccuracy - a.totalAccuracy;
      return a.username.localeCompare(b.username);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const weekly = [...leaderboard]
    .sort((a, b) => {
      if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints;
      if (b.weeklyAccuracy !== a.weeklyAccuracy) return b.weeklyAccuracy - a.weeklyAccuracy;
      return a.rank - b.rank;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const bestPrecisePrediction = [...weekly]
    .filter((row) => row.weeklyPoints > 0)
    .sort((a, b) => {
      if (b.weeklyAccuracy !== a.weeklyAccuracy) return b.weeklyAccuracy - a.weeklyAccuracy;
      if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints;
      return a.rank - b.rank;
    })[0] ?? null;

  const topPointsToday = [...leaderboard]
    .filter((row) => row.todayPoints > 0)
    .sort((a, b) => {
      if (b.todayPoints !== a.todayPoints) return b.todayPoints - a.todayPoints;
      return a.rank - b.rank;
    })[0] ?? null;

  const currentUser = leaderboard.find((row) => row.userId === currentUserId) ?? null;

  return {
    leaderboard,
    currentUser,
    userInsight: computeInsight(leaderboard, currentUserId),
    tabs: {
      overall: leaderboard,
      weekly,
      bestPrecisePrediction,
      topPointsToday,
    },
  };
}

function randomInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '90P';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function generateUniqueInviteCode(): Promise<string> {
  const db = prisma as any;
  for (let i = 0; i < 20; i += 1) {
    const candidate = randomInviteCode(5);
    const existing = await db.predictionGroup.findUnique({
      where: { inviteCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error('Could not generate unique invite code');
}

export async function buildGroupSummaryFromDb(groupId: string, currentUserId: string): Promise<GroupSummary> {
  const db = prisma as any;
  const group = await db.predictionGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatar: true },
          },
        },
      },
    },
  });

  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  const userIds = group.members.map((member: any) => member.userId);
  if (userIds.length === 0) {
    return buildGroupSummary([], currentUserId);
  }

  const weekStart = startOfWeekUtc();
  const todayStart = startOfDayUtc();

  const [totalCorrect, totalResolved, weeklyCorrect, weeklyResolved, todayCorrect] = await Promise.all([
    db.prediction.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCorrect: true },
      _count: { _all: true },
    }),
    db.prediction.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCorrect: { not: null } },
      _count: { _all: true },
    }),
    db.prediction.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCorrect: true, resolvedAt: { gte: weekStart } },
      _count: { _all: true },
    }),
    db.prediction.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCorrect: { not: null }, resolvedAt: { gte: weekStart } },
      _count: { _all: true },
    }),
    db.prediction.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCorrect: true, resolvedAt: { gte: todayStart } },
      _count: { _all: true },
    }),
  ]);

  const totalCorrectMap = new Map(totalCorrect.map((row: any) => [row.userId, row._count._all || 0]));
  const totalResolvedMap = new Map(totalResolved.map((row: any) => [row.userId, row._count._all || 0]));
  const weeklyCorrectMap = new Map(weeklyCorrect.map((row: any) => [row.userId, row._count._all || 0]));
  const weeklyResolvedMap = new Map(weeklyResolved.map((row: any) => [row.userId, row._count._all || 0]));
  const todayCorrectMap = new Map(todayCorrect.map((row: any) => [row.userId, row._count._all || 0]));

  const seeds: GroupMemberStatsSeed[] = group.members.map((member: any) => ({
    userId: member.userId,
    username: member.user.username,
    displayName: member.user.displayName,
    avatar: member.user.avatar,
    totalCorrect: totalCorrectMap.get(member.userId) ?? 0,
    totalResolved: totalResolvedMap.get(member.userId) ?? 0,
    weeklyCorrect: weeklyCorrectMap.get(member.userId) ?? 0,
    weeklyResolved: weeklyResolvedMap.get(member.userId) ?? 0,
    todayCorrect: todayCorrectMap.get(member.userId) ?? 0,
  }));

  return buildGroupSummary(seeds, currentUserId);
}
