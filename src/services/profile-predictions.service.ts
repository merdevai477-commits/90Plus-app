/**
 * Merges regular match predictions with group (90 بلس كينجز) predictions for profile analytics.
 */

import prisma from '../lib/prisma';

export const GROUP_PREDICTION_SOURCE_LABEL = '90 بلس كينجز';

export interface ProfilePredictionRow {
  id: string;
  apiMatchId: number;
  predictionType: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  matchDate: string | null;
  leagueName: string | null;
  isCorrect: boolean | null;
  coinsWon: number | null;
  coinsSpent: number;
  xpAwarded?: number;
  createdAt: string;
  source?: 'match' | 'group';
  sourceLabel?: string;
  mode?: 'WINNER' | 'EXACT';
  predictedHomeScore?: number | null;
  predictedAwayScore?: number | null;
}

function resolveGroupPredictionType(pred: {
  mode: string;
  predictedWinner: string | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
}): string {
  if (pred.predictedWinner === 'home' || pred.predictedWinner === 'away' || pred.predictedWinner === 'draw') {
    return pred.predictedWinner;
  }
  const h = pred.predictedHomeScore ?? 0;
  const a = pred.predictedAwayScore ?? 0;
  if (h > a) return 'home';
  if (a > h) return 'away';
  return 'draw';
}

export async function fetchGroupPredictionsForProfile(
  userId: string,
  take = 50,
): Promise<ProfilePredictionRow[]> {
  const preds = await prisma.groupPrediction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      apiMatchId: true,
      mode: true,
      predictedWinner: true,
      predictedHomeScore: true,
      predictedAwayScore: true,
      isCorrect: true,
      xpAwarded: true,
      createdAt: true,
    },
  });

  if (preds.length === 0) return [];

  const matchIds = [...new Set(preds.map((p) => p.apiMatchId))];
  const fixtures = await prisma.cachedFixture.findMany({
    where: { fixtureId: { in: matchIds } },
    select: {
      fixtureId: true,
      homeTeamName: true,
      awayTeamName: true,
      homeTeamLogo: true,
      awayTeamLogo: true,
      matchDate: true,
      leagueName: true,
    },
  });
  const fixtureById = new Map(fixtures.map((f) => [f.fixtureId, f]));

  return preds.map((p) => {
    const f = fixtureById.get(p.apiMatchId);
    return {
      id: `group-${p.id}`,
      apiMatchId: p.apiMatchId,
      predictionType: resolveGroupPredictionType(p),
      homeTeam: f?.homeTeamName ?? null,
      awayTeam: f?.awayTeamName ?? null,
      homeTeamLogo: f?.homeTeamLogo ?? null,
      awayTeamLogo: f?.awayTeamLogo ?? null,
      matchDate: f?.matchDate?.toISOString() ?? null,
      leagueName: f?.leagueName ?? null,
      isCorrect: p.isCorrect,
      coinsWon: null,
      coinsSpent: 0,
      xpAwarded: p.xpAwarded,
      createdAt: p.createdAt.toISOString(),
      source: 'group' as const,
      sourceLabel: GROUP_PREDICTION_SOURCE_LABEL,
      mode: p.mode as 'WINNER' | 'EXACT',
      predictedHomeScore: p.predictedHomeScore,
      predictedAwayScore: p.predictedAwayScore,
    };
  });
}

export async function buildGroupPredictionStats(userId: string) {
  const grouped = await prisma.groupPrediction.groupBy({
    by: ['isCorrect'],
    where: { userId },
    _count: { _all: true },
  });

  let correct = 0;
  let incorrect = 0;
  let pending = 0;
  for (const row of grouped) {
    const c = row._count._all || 0;
    if (row.isCorrect === true) correct = c;
    else if (row.isCorrect === false) incorrect = c;
    else pending = c;
  }

  const xpAgg = await prisma.groupPrediction.aggregate({
    where: { userId, isCorrect: true },
    _sum: { xpAwarded: true },
  });

  return {
    correct,
    incorrect,
    pending,
    totalXp: xpAgg._sum.xpAwarded ?? 0,
  };
}

export function mergePredictionStats(
  base: {
    total: number;
    correct: number;
    incorrect: number;
    pending: number;
    accuracy: number;
    resolved: number;
    totalCoinsWon: number;
    groupCorrect?: number;
    groupXp?: number;
  },
  group: { correct: number; incorrect: number; pending: number; totalXp: number },
) {
  const correct = base.correct + group.correct;
  const incorrect = base.incorrect + group.incorrect;
  const pending = base.pending + group.pending;
  const total = correct + incorrect + pending;
  const resolved = correct + incorrect;
  const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0;

  return {
    ...base,
    total,
    correct,
    incorrect,
    pending,
    resolved,
    accuracy,
    groupCorrect: group.correct,
    groupXp: group.totalXp,
  };
}

export function mergePredictionLists(
  regular: ProfilePredictionRow[],
  group: ProfilePredictionRow[],
  take = 50,
): ProfilePredictionRow[] {
  const regularTagged = regular.map((p) => ({
    ...p,
    source: 'match' as const,
    sourceLabel: undefined,
  }));
  return [...regularTagged, ...group]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, take);
}
