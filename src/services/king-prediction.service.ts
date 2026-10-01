/**
 * King of the Game / King of Results persistence and leaderboard.
 *
 * One prediction row per user+match. Winner mode stores home/draw/away and
 * clears the scoreline. Results mode stores the scoreline and derives the
 * winner from it. A row can be edited until kickoff.
 */

import type { Prediction } from '@prisma/client';
import prisma from '../lib/prisma';
import { XP_VALUES } from './xp.service';

export type KingMode = 'winner' | 'exact';
export type KingPeriod = 'week' | 'all';
export type WinnerPick = 'home' | 'draw' | 'away';

const WINNER_XP = XP_VALUES.PREDICTION_WINNER;
const EXACT_XP = XP_VALUES.PREDICTION_EXACT;

export class KingPredictionError extends Error {
  constructor(
    public readonly reason: 'USER_NOT_FOUND' | 'DAILY_LIMIT_REACHED' | 'MATCH_STARTED' | 'ALREADY_RESOLVED',
  ) {
    super(reason);
    this.name = 'KingPredictionError';
  }
}

/** Sunday 00:00 UTC through the following Sunday. */
export function utcSundayWeek(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function deriveWinner(home: number, away: number): WinnerPick {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

export function kickoffHasPassed(matchDate: Date | null | undefined, now = new Date()): boolean {
  if (!matchDate) return false;
  return matchDate.getTime() <= now.getTime();
}

export interface UpsertKingPredictionInput {
  clerkUserId: string;
  apiMatchId: number;
  mode: KingMode;
  predictionType?: WinnerPick;
  homeScore?: number;
  awayScore?: number;
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  matchDate?: string | null;
  leagueName?: string | null;
  dailyLimit: number;
  coinsSpent: number;
}

export interface UpsertKingPredictionResult {
  prediction: Prediction;
  remaining: number;
  updated: boolean;
  coins: number;
}

export async function upsertKingPrediction(
  input: UpsertKingPredictionInput,
): Promise<UpsertKingPredictionResult> {
  const user = await prisma.user.findFirst({
    where: { clerkUserId: input.clerkUserId },
    select: { id: true, coins: true },
  });
  if (!user) throw new KingPredictionError('USER_NOT_FOUND');

  const predictionType: WinnerPick =
    input.mode === 'exact'
      ? deriveWinner(input.homeScore ?? 0, input.awayScore ?? 0)
      : (input.predictionType as WinnerPick);

  const parsedMatchDate = input.matchDate ? new Date(input.matchDate) : null;
  const safeMatchDate =
    parsedMatchDate && !Number.isNaN(parsedMatchDate.getTime()) ? parsedMatchDate : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.prediction.findUnique({
      where: {
        userId_apiMatchId: { userId: user.id, apiMatchId: input.apiMatchId },
      },
    });

    if (existing) {
      if (existing.isCorrect !== null) {
        throw new KingPredictionError('ALREADY_RESOLVED');
      }
      const kickoff = existing.matchDate ?? safeMatchDate;
      if (kickoffHasPassed(kickoff)) {
        throw new KingPredictionError('MATCH_STARTED');
      }

      const prediction = await tx.prediction.update({
        where: { id: existing.id },
        data: {
          predictionType,
          predictedHomeScore: input.mode === 'exact' ? input.homeScore : null,
          predictedAwayScore: input.mode === 'exact' ? input.awayScore : null,
          homeTeam: input.homeTeam ?? existing.homeTeam,
          awayTeam: input.awayTeam ?? existing.awayTeam,
          homeTeamLogo: input.homeTeamLogo ?? existing.homeTeamLogo,
          awayTeamLogo: input.awayTeamLogo ?? existing.awayTeamLogo,
          matchDate: existing.matchDate ?? safeMatchDate,
          leagueName: input.leagueName ?? existing.leagueName,
        },
      });

      const used = await tx.prediction.count({
        where: { userId: user.id, createdAt: { gte: today, lt: tomorrow } },
      });

      return {
        prediction,
        remaining: Math.max(0, input.dailyLimit - used),
        updated: true,
        coins: user.coins,
      };
    }

    const used = await tx.prediction.count({
      where: { userId: user.id, createdAt: { gte: today, lt: tomorrow } },
    });
    if (used >= input.dailyLimit) {
      throw new KingPredictionError('DAILY_LIMIT_REACHED');
    }

    const prediction = await tx.prediction.create({
      data: {
        userId: user.id,
        apiMatchId: input.apiMatchId,
        predictionType,
        coinsSpent: input.coinsSpent,
        isCorrect: null,
        predictedHomeScore: input.mode === 'exact' ? input.homeScore : null,
        predictedAwayScore: input.mode === 'exact' ? input.awayScore : null,
        homeTeam: input.homeTeam ?? null,
        awayTeam: input.awayTeam ?? null,
        homeTeamLogo: input.homeTeamLogo ?? null,
        awayTeamLogo: input.awayTeamLogo ?? null,
        matchDate: safeMatchDate,
        leagueName: input.leagueName ?? null,
      },
    });

    return {
      prediction,
      remaining: Math.max(0, input.dailyLimit - used - 1),
      updated: false,
      coins: user.coins,
    };
  });
}

export interface KingLeaderboardEntry {
  rank: number;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  xp: number;
}

export interface KingLeaderboardResult {
  mode: KingMode;
  period: KingPeriod;
  entries: KingLeaderboardEntry[];
  me: { rank: number | null; xp: number; userId: string } | null;
}

export async function getKingLeaderboard(params: {
  clerkUserId: string;
  mode: KingMode;
  period: KingPeriod;
  limit: number;
}): Promise<KingLeaderboardResult> {
  const me = await prisma.user.findFirst({
    where: { clerkUserId: params.clerkUserId },
    select: { id: true },
  });

  const week = params.period === 'week' ? utcSundayWeek() : null;
  const predictions = await prisma.prediction.findMany({
    where: {
      isCorrect: true,
      ...(params.mode === 'exact'
        ? { predictedHomeScore: { not: null }, predictedAwayScore: { not: null } }
        : { predictedHomeScore: null }),
      ...(week ? { matchDate: { gte: week.start, lt: week.end } } : {}),
    },
    select: { id: true, userId: true },
  });

  const xpByPrediction = new Map<string, number>();
  if (params.mode === 'exact' && predictions.length > 0) {
    const txs = await prisma.xpTransaction.findMany({
      where: {
        idempotencyKey: { in: predictions.map((p) => `prediction:${p.id}`) },
      },
      select: { idempotencyKey: true, amount: true },
    });
    for (const tx of txs) {
      if (tx.idempotencyKey) xpByPrediction.set(tx.idempotencyKey, tx.amount);
    }
  }

  const xpByUser = new Map<string, number>();
  for (const row of predictions) {
    const xp =
      params.mode === 'winner'
        ? WINNER_XP
        : (xpByPrediction.get(`prediction:${row.id}`) ?? WINNER_XP);
    if (xp <= 0) continue;
    xpByUser.set(row.userId, (xpByUser.get(row.userId) ?? 0) + xp);
  }

  const ranked = [...xpByUser.entries()]
    .map(([userId, xp]) => ({ userId, xp }))
    .sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId));

  const meXp = me ? (xpByUser.get(me.id) ?? 0) : 0;
  const meRank = me && meXp > 0 ? ranked.findIndex((row) => row.userId === me.id) + 1 : null;

  const top = ranked.slice(0, params.limit);
  const users = await prisma.user.findMany({
    where: { id: { in: top.map((row) => row.userId) } },
    select: { id: true, username: true, displayName: true, avatar: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const entries: KingLeaderboardEntry[] = top.flatMap((row, index) => {
    const user = usersById.get(row.userId);
    if (!user) return [];
    return [{
      rank: index + 1,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      xp: row.xp,
    }];
  });

  return {
    mode: params.mode,
    period: params.period,
    entries,
    me: me
      ? { rank: meRank, xp: meXp, userId: me.id }
      : null,
  };
}

export { EXACT_XP, WINNER_XP };
