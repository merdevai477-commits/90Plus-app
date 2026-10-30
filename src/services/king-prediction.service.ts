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
import {
  cairoDayKey,
  cairoDayRange,
  cairoWeekBounds,
  kingWeekWhere,
  lockVerdict,
  resolveServerFixture,
} from './king-prediction-rules';

export type KingMode = 'winner' | 'exact';
export type KingPeriod = 'week' | 'all';
export type WinnerPick = 'home' | 'draw' | 'away';

const WINNER_XP = XP_VALUES.PREDICTION_WINNER;
const EXACT_XP = XP_VALUES.PREDICTION_EXACT;

export type KingPredictionErrorReason =
  | 'USER_NOT_FOUND'
  | 'DAILY_LIMIT_REACHED'
  | 'MATCH_STARTED'
  | 'ALREADY_RESOLVED'
  | 'KICKOFF_UNKNOWN'
  | 'MATCH_NOT_ELIGIBLE'
  | 'DUPLICATE_FIXTURE';

export class KingPredictionError extends Error {
  constructor(public readonly reason: KingPredictionErrorReason) {
    super(reason);
    this.name = 'KingPredictionError';
  }
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

  // Kickoff, eligibility and identity are server truth; the client matchDate is ignored (B1, B2).
  const fixture = await resolveServerFixture(input.apiMatchId);
  const dayKey = cairoDayKey();
  const now = new Date();

  // Concurrent first-create on (userId, apiMatchId) can lose with P2002; retry once as update (GK-6).
  let racedCreate = false;
  for (;;) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.prediction.findUnique({
          where: {
            userId_apiMatchId: { userId: user.id, apiMatchId: input.apiMatchId },
          },
        });

        if (existing) {
          if (existing.isCorrect !== null) {
            throw new KingPredictionError('ALREADY_RESOLVED');
          }
          // Any change after kickoff is refused, including switching mode (B4, Q4, Q6).
          const verdict = lockVerdict(fixture, { isNew: false }, now);
          if (verdict !== 'OPEN') throw new KingPredictionError(verdict);

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
              matchDate: fixture!.kickoff,
              leagueName: input.leagueName ?? existing.leagueName,
              canonicalFixtureKey: existing.canonicalFixtureKey ?? fixture!.canonicalKey,
            },
          });

          const used = await readDailyCount(tx, user.id, dayKey);
          return {
            prediction,
            remaining: Math.max(0, input.dailyLimit - used),
            updated: true,
            coins: user.coins,
          };
        }

        const verdict = lockVerdict(fixture, { isNew: true }, now);
        if (verdict !== 'OPEN') throw new KingPredictionError(verdict);

        const used = await claimDailySlot(tx, user.id, dayKey, input.dailyLimit);
        if (used == null) throw new KingPredictionError('DAILY_LIMIT_REACHED');

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
            matchDate: fixture!.kickoff,
            leagueName: input.leagueName ?? null,
            canonicalFixtureKey: fixture!.canonicalKey,
          },
        });

        return {
          prediction,
          remaining: Math.max(0, input.dailyLimit - used),
          updated: false,
          coins: user.coins,
        };
      });
    } catch (err: any) {
      if (err instanceof KingPredictionError) throw err;
      if (err?.code === 'P2002') {
        const target = String(err?.meta?.target ?? '');
        if (target.includes('canonicalFixtureKey')) {
          throw new KingPredictionError('DUPLICATE_FIXTURE');
        }
        if (!racedCreate && target.includes('apiMatchId')) {
          racedCreate = true;
          continue;
        }
      }
      throw err;
    }
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Seeds today's counter from rows created before the counter existed, then
 * takes one slot atomically. Returns the new count, or null when full (B3).
 */
export async function claimDailySlot(
  tx: Tx,
  userId: string,
  dayKey: string,
  limit: number,
): Promise<number | null> {
  const { start, end } = cairoDayRange(dayKey);
  await tx.$executeRaw`
    INSERT INTO "prediction_daily_counters" ("userId", "cairoDay", "count", "updatedAt")
    VALUES (
      ${userId}, ${dayKey}::date,
      (SELECT count(*)::int FROM "predictions" WHERE "userId" = ${userId} AND "createdAt" >= ${start} AND "createdAt" < ${end}),
      now()
    )
    ON CONFLICT ("userId", "cairoDay") DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    UPDATE "prediction_daily_counters"
    SET "count" = "count" + 1, "updatedAt" = now()
    WHERE "userId" = ${userId} AND "cairoDay" = ${dayKey}::date AND "count" < ${limit}
    RETURNING "count"`;
  return rows.length ? Number(rows[0].count) : null;
}

async function readDailyCount(tx: Tx, userId: string, dayKey: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    SELECT "count" FROM "prediction_daily_counters"
    WHERE "userId" = ${userId} AND "cairoDay" = ${dayKey}::date`;
  if (rows.length) return Number(rows[0].count);
  const { start, end } = cairoDayRange(dayKey);
  return tx.prediction.count({ where: { userId, createdAt: { gte: start, lt: end } } });
}

/** Today's used King slots (Africa/Cairo day) for the /remaining endpoint (C1). */
export async function getDailyPredictionsUsed(userId: string, now: Date = new Date()): Promise<number> {
  return readDailyCount(prisma as unknown as Tx, userId, cairoDayKey(now));
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

  const week = params.period === 'week' ? cairoWeekBounds() : null;
  const predictions = await prisma.prediction.findMany({
    where: {
      isCorrect: true,
      ...modeWhere(params.mode),
      ...(week ? kingWeekWhere(week) : {}),
    },
    select: {
      id: true,
      userId: true,
      apiMatchId: true,
      predictedHomeScore: true,
      predictedAwayScore: true,
      settledHomeScore: true,
      settledAwayScore: true,
    },
  });

  // Rows settled before King of Results required the exact scoreline were
  // marked correct for the right winner alone; only exact hits count here.
  const finalScoreByMatch = new Map<number, { home: number | null; away: number | null }>();
  const unsnapshotted = predictions.filter((p) => p.settledHomeScore == null || p.settledAwayScore == null);
  if (params.mode === 'exact' && unsnapshotted.length > 0) {
    const fixtures = await prisma.cachedFixture.findMany({
      where: { fixtureId: { in: [...new Set(unsnapshotted.map((p) => p.apiMatchId))] } },
      select: { fixtureId: true, homeScore: true, awayScore: true },
    });
    for (const f of fixtures) {
      finalScoreByMatch.set(f.fixtureId, { home: f.homeScore, away: f.awayScore });
    }
  }

  const points = params.mode === 'winner' ? WINNER_XP : EXACT_XP;
  const xpByUser = new Map<string, number>();
  for (const row of predictions) {
    if (params.mode === 'exact') {
      const final =
        row.settledHomeScore != null && row.settledAwayScore != null
          ? { home: row.settledHomeScore, away: row.settledAwayScore }
          : finalScoreByMatch.get(row.apiMatchId);
      if (
        final &&
        final.home != null &&
        final.away != null &&
        (final.home !== row.predictedHomeScore || final.away !== row.predictedAwayScore)
      ) {
        continue;
      }
    }
    xpByUser.set(row.userId, (xpByUser.get(row.userId) ?? 0) + points);
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
  voided: boolean;
}

export interface KingHistoryResult {
  items: KingHistoryItem[];
  counts: Record<KingHistoryStatus | 'void', number>;
  hasMore: boolean;
}

function modeWhere(mode: KingMode) {
  return mode === 'exact'
    ? { predictedHomeScore: { not: null }, predictedAwayScore: { not: null } }
    : { predictedHomeScore: null };
}

const STATUS_WHERE: Record<Exclude<KingHistoryStatus, 'all'>, object> = {
  correct: { isCorrect: true },
  wrong: { isCorrect: false },
  pending: { isCorrect: null, voidedAt: null },
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
    counts: { all: 0, correct: 0, wrong: 0, pending: 0, void: 0 },
    hasMore: false,
  };
  const user = await prisma.user.findFirst({
    where: { clerkUserId: params.clerkUserId },
    select: { id: true },
  });
  if (!user) return empty;

  // The King history starts empty every week, on the same Cairo Sunday boundary
  // and the same predicate as the weekly leaderboard. Rows are kept; the
  // profile still lists them all.
  const base = {
    userId: user.id,
    ...modeWhere(params.mode),
    ...kingWeekWhere(cairoWeekBounds()),
  };
  const where = params.status === 'all' ? base : { ...base, ...STATUS_WHERE[params.status] };

  const [rows, grouped, voided] = await Promise.all([
    prisma.prediction.findMany({
      where,
      orderBy: [{ matchDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip: params.page * params.limit,
      take: params.limit + 1,
    }),
    prisma.prediction.groupBy({ by: ['isCorrect'], where: base, _count: true }),
    prisma.prediction.count({ where: { ...base, isCorrect: null, voidedAt: { not: null } } }),
  ]);

  const counts = { ...empty.counts, void: voided };
  for (const row of grouped) {
    const n = row._count as number;
    counts.all += n;
    if (row.isCorrect === true) counts.correct += n;
    else if (row.isCorrect === false) counts.wrong += n;
    else counts.pending += n;
  }
  counts.pending = Math.max(0, counts.pending - voided);

  const page = rows.slice(0, params.limit);
  const needLive = page.filter((row) => row.settledHomeScore == null || row.settledAwayScore == null);
  const fixtures = needLive.length
    ? await prisma.cachedFixture.findMany({
        where: { fixtureId: { in: needLive.map((row) => row.apiMatchId) } },
        select: { fixtureId: true, homeScore: true, awayScore: true, status: true },
      })
    : [];
  const fixtureById = new Map(fixtures.map((f) => [f.fixtureId, f]));

  return {
    items: page.map((row) => {
      const fixture = fixtureById.get(row.apiMatchId);
      // Settled rows show the score they were judged on, not whatever the cache says now (E10).
      const snapshotted = row.settledHomeScore != null && row.settledAwayScore != null;
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
        finalHomeScore: snapshotted ? row.settledHomeScore : (fixture?.homeScore ?? null),
        finalAwayScore: snapshotted ? row.settledAwayScore : (fixture?.awayScore ?? null),
        matchStatus: row.settledStatus ?? row.voidReason ?? fixture?.status ?? null,
        voided: row.voidedAt != null,
      };
    }),
    counts,
    hasMore: rows.length > params.limit,
  };
}

export { EXACT_XP, WINNER_XP };
