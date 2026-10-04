/**
 * King of the Game / King of Results persistence and leaderboard.
 *
 * One prediction row per user+match. Winner mode stores home/draw/away and
 * clears the scoreline. Results mode stores the scoreline and derives the
 * winner from it. A row can be edited until kickoff.
 */

import type { Prediction } from '@prisma/client';
import prisma from '../lib/prisma';
import { calendarTodayKey } from '../utils/calendar-day-bounds.util';
import { pickTopFixtures } from '../utils/fixture-importance';
import { projectMatchesForListView } from '../utils/matches-list-projection.util';
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

export const KING_DAILY_MATCH_LIMIT = 10;

const KING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SECONDARY_LEAGUE_RE = /women|femenil|feminin|frauen|reserv|youth|primavera|\bU\d{2}\b/i;
const SECONDARY_TEAM_RE = /\(W\)|\bRes\.?$|\bReserves?\b|\bII$|\bB$|\bU\d{2}\b/i;

function isSecondaryFixture(fixture: any): boolean {
  if (SECONDARY_LEAGUE_RE.test(String(fixture?.league?.name ?? ''))) return true;
  const home = String(fixture?.teams?.home?.name ?? '');
  const away = String(fixture?.teams?.away?.name ?? '');
  return SECONDARY_TEAM_RE.test(home) || SECONDARY_TEAM_RE.test(away);
}

/**
 * The day's top matches, ranked the same way the prediction-groups daily round
 * was (Big 5 first, then marquee clubs per continent).
 *
 * `pickTopFixtures` only considers fixtures that have not kicked off, so every
 * fixture is ranked as if it were still upcoming. Otherwise a match would drop
 * out of the list at kickoff and take the user's locked prediction with it.
 * Women's, reserve and youth sides are left out so quiet days don't fill up
 * with them.
 */
export async function getKingDailyMatches(dateString?: string): Promise<unknown[]> {
  const day = dateString && KING_DATE_RE.test(dateString) ? dateString : calendarTodayKey();
  const { footballDataCacheService } = await import('./football-data-cache.service');
  const fixtures: any[] = await footballDataCacheService.getMatchesByDate(day);

  const asUpcoming = fixtures.filter((f) => !isSecondaryFixture(f)).map((original) => ({
    ...original,
    fixture: {
      ...original?.fixture,
      status: { ...original?.fixture?.status, short: 'NS' },
    },
    __original: original,
  }));

  const top = pickTopFixtures(asUpcoming, KING_DAILY_MATCH_LIMIT)
    .map((row: any) => row.__original)
    .sort((a: any, b: any) => {
      const left = Date.parse(a?.fixture?.date ?? '') || 0;
      const right = Date.parse(b?.fixture?.date ?? '') || 0;
      return left - right;
    })
    .map(({ events: _e, lineups: _l, statistics: _s, players: _p, fullData: _f, ...rest }: any) => rest);

  return projectMatchesForListView(top);
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

    if (kickoffHasPassed(safeMatchDate)) {
      throw new KingPredictionError('MATCH_STARTED');
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
      ...modeWhere(params.mode),
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

export type KingHistoryStatus = 'all' | 'correct' | 'wrong' | 'pending';

export interface KingHistoryItem {
  id: string;
  apiMatchId: number;
  predictionType: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  matchDate: string | null;
  leagueName: string | null;
  isCorrect: boolean | null;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
  matchStatus: string | null;
}

export interface KingHistoryResult {
  items: KingHistoryItem[];
  counts: Record<KingHistoryStatus, number>;
  hasMore: boolean;
}

function modeWhere(mode: KingMode) {
  return mode === 'exact'
    ? { predictedHomeScore: { not: null }, predictedAwayScore: { not: null } }
    : { predictedHomeScore: null };
}

const STATUS_WHERE: Record<Exclude<KingHistoryStatus, 'all'>, boolean | null> = {
  correct: true,
  wrong: false,
  pending: null,
};

export async function getKingHistory(params: {
  clerkUserId: string;
  mode: KingMode;
  status: KingHistoryStatus;
  page: number;
  limit: number;
}): Promise<KingHistoryResult> {
  const empty: KingHistoryResult = {
    items: [],
    counts: { all: 0, correct: 0, wrong: 0, pending: 0 },
    hasMore: false,
  };
  const user = await prisma.user.findFirst({
    where: { clerkUserId: params.clerkUserId },
    select: { id: true },
  });
  if (!user) return empty;

  const base = { userId: user.id, ...modeWhere(params.mode) };
  const where =
    params.status === 'all' ? base : { ...base, isCorrect: STATUS_WHERE[params.status] };

  const [rows, grouped] = await Promise.all([
    prisma.prediction.findMany({
      where,
      orderBy: [{ matchDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip: params.page * params.limit,
      take: params.limit + 1,
    }),
    prisma.prediction.groupBy({ by: ['isCorrect'], where: base, _count: true }),
  ]);

  const counts = { ...empty.counts };
  for (const row of grouped) {
    const n = row._count as number;
    counts.all += n;
    if (row.isCorrect === true) counts.correct += n;
    else if (row.isCorrect === false) counts.wrong += n;
    else counts.pending += n;
  }

  const page = rows.slice(0, params.limit);
  const fixtures = page.length
    ? await prisma.cachedFixture.findMany({
        where: { fixtureId: { in: page.map((row) => row.apiMatchId) } },
        select: { fixtureId: true, homeScore: true, awayScore: true, status: true },
      })
    : [];
  const fixtureById = new Map(fixtures.map((f) => [f.fixtureId, f]));

  return {
    items: page.map((row) => {
      const fixture = fixtureById.get(row.apiMatchId);
      return {
        id: row.id,
        apiMatchId: row.apiMatchId,
        predictionType: row.predictionType,
        predictedHomeScore: row.predictedHomeScore,
        predictedAwayScore: row.predictedAwayScore,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeTeamLogo: row.homeTeamLogo,
        awayTeamLogo: row.awayTeamLogo,
        matchDate: row.matchDate?.toISOString() ?? null,
        leagueName: row.leagueName,
        isCorrect: row.isCorrect,
        finalHomeScore: fixture?.homeScore ?? null,
        finalAwayScore: fixture?.awayScore ?? null,
        matchStatus: fixture?.status ?? null,
      };
    }),
    counts,
    hasMore: rows.length > params.limit,
  };
}

export { EXACT_XP, WINNER_XP };
