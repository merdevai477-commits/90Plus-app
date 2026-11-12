/**
 * King of Coaches scoring job. One pass stores the selected clubs' fixtures,
 * writes insert-only player and coach points, then renews the weekly 100M budget when the
 * Tuesday window is complete.
 */

import { Prisma, type CoachKingFixture, type CoachKingGameweek, type CoachKingGameweekStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';
import { classifyScores365MatchStatus, fetchScores365GameById } from './scores365-experiment.service';
import { ensureCoachKingPool, refreshCoachKingPoolIfStale } from './coach-king-pool.service';
import {
  coachKingMatchResult,
  coachKingResultPoints,
  computeCoachKingPoints,
  extractCoachKingStats,
  type CkLine,
  type CkScorableGame,
} from './coach-king-scoring';
import {
  carryOverCoachKingSquads,
  ensureCoachKingGameweek,
  ensureCoachKingSchema,
  invalidateBoard,
  settleCoachKingGameweek,
} from './coach-king.service';
import { performanceCountsForMember, providerKickoff, shouldRefetchScoredFixture, statLineHash } from './squad-lock';
import {
  TSF_EUROPE_LEAGUE_KEYS,
  TSF_LEAGUES,
  isTsfFinishedStatus,
  isTsfPostponedStatus,
  isTsfVoidStatus,
  nextTsfGameweekStatus,
  tsfStatusRank,
} from './top-scorers-five-scoring';

const EXPECTED_DURATION_MS = 130 * 60_000;
const GIVE_UP_AFTER_MS = 36 * 60 * 60_000;
const TICK_MS = 10 * 60_000;

type Discovered = {
  fixtureId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string | null;
  awayTeamName: string | null;
  kickoffAt: Date;
  status: string;
};

function europeConfigs() {
  return TSF_EUROPE_LEAGUE_KEYS.map((key) => TSF_LEAGUES[key]!).filter(Boolean);
}

async function discoverFixtures(gameweek: CoachKingGameweek, teamIds: number[]): Promise<Discovered[]> {
  if (teamIds.length === 0) return [];
  const found = new Map<number, Discovered>();
  for (const cfg of europeConfigs()) {
    const rows = await prisma.cachedFixture.findMany({
      where: {
        leagueId: cfg.competitionLeagueId,
        matchDate: { gte: gameweek.startAt, lt: gameweek.endAt },
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
      },
      select: {
        fixtureId: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeamName: true,
        awayTeamName: true,
        matchDate: true,
        status: true,
      },
    });
    for (const row of rows) {
      found.set(row.fixtureId, {
        fixtureId: row.fixtureId,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        homeTeamName: row.homeTeamName,
        awayTeamName: row.awayTeamName,
        kickoffAt: row.matchDate,
        status: row.status,
      });
    }
  }
  return [...found.values()];
}

async function storeFixtures(gameweekId: string, fixtures: Discovered[]): Promise<void> {
  for (const fixture of fixtures) {
    await prisma.coachKingFixture.upsert({
      where: { gameweekId_fixtureId: { gameweekId, fixtureId: fixture.fixtureId } },
      create: { gameweekId, ...fixture },
      update: {
        kickoffAt: fixture.kickoffAt,
        homeTeamName: fixture.homeTeamName,
        awayTeamName: fixture.awayTeamName,
      },
    });
  }
}

async function scoreFixture(gameweek: CoachKingGameweek, fixture: CoachKingFixture, now: Date): Promise<void> {
  if (!shouldRefetchScoredFixture(fixture, now)) return;
  if (fixture.kickoffAt > now) return;
  if (isTsfVoidStatus(fixture.status)) {
    await prisma.coachKingFixture.update({ where: { id: fixture.id }, data: { processedAt: now } });
    return;
  }
  const due = now.getTime() - fixture.kickoffAt.getTime() >= EXPECTED_DURATION_MS;
  if (!isTsfFinishedStatus(fixture.status) && !due) return;
  if (!isNative365FixtureId(fixture.fixtureId)) {
    await prisma.coachKingFixture.update({
      where: { id: fixture.id },
      data: { lastError: 'not a 365Scores game id', ...(now.getTime() - fixture.kickoffAt.getTime() >= GIVE_UP_AFTER_MS ? { processedAt: now, status: 'NO_DATA' } : {}) },
    });
    return;
  }

  const game = await fetchScores365GameById(fixture.fixtureId, { force: true, language: 'en' });
  if (!game) return;
  const movedKickoff = providerKickoff(game);
  let kickoffAt = fixture.kickoffAt;
  if (movedKickoff && movedKickoff.getTime() !== kickoffAt.getTime()) {
    kickoffAt = movedKickoff;
    await prisma.coachKingFixture.update({ where: { id: fixture.id }, data: { kickoffAt } });
  }
  if (kickoffAt > now) return;
  const status = classifyScores365MatchStatus(game).short;
  if (isTsfVoidStatus(status)) {
    await prisma.coachKingFixture.update({ where: { id: fixture.id }, data: { processedAt: now, status } });
    return;
  }
  if (isTsfPostponedStatus(status) || !isTsfFinishedStatus(status)) {
    await prisma.coachKingFixture.update({ where: { id: fixture.id }, data: { status } });
    return;
  }

  const scorable = game as unknown as CkScorableGame;
  const stats = extractCoachKingStats(scorable);
  const homeScore = typeof scorable.homeCompetitor?.score === 'number' ? scorable.homeCompetitor.score : null;
  const awayScore = typeof scorable.awayCompetitor?.score === 'number' ? scorable.awayCompetitor.score : null;

  const [selected, memberPlayers] = await Promise.all([
    prisma.coachKingSquadSlot.findMany({
      where: {
        squad: { gameweekId: gameweek.id, confirmedAt: { not: null }, isLive: false },
        player: { teamId: { in: [fixture.homeTeamId, fixture.awayTeamId] } },
      },
      select: { player: { select: { id: true, externalPlayerId: true, line: true } } },
    }),
    prisma.coachKingMembership.findMany({
      where: {
        player: { teamId: { in: [fixture.homeTeamId, fixture.awayTeamId] } },
        selectedAt: { lte: kickoffAt },
        OR: [{ removedAt: null }, { removedAt: { gt: kickoffAt } }],
      },
      select: { player: { select: { id: true, externalPlayerId: true, line: true } } },
    }),
  ]);
  for (const row of memberPlayers) {
    if (row.player) selected.push({ player: row.player });
  }
  const players = new Map(selected.map((row) => [row.player.id, row.player]));
  const performanceRows = [...players.values()].map((player) => {
    const line = stats.get(player.externalPlayerId) ?? {
      minutes: 0, goals: 0, assists: 0, yellows: 0, reds: 0, ownGoals: 0, teamConceded: null,
    };
    const scored = computeCoachKingPoints(player.line as CkLine, line);
    return {
      gameweekId: gameweek.id,
      playerId: player.id,
      fixtureId: fixture.fixtureId,
      minutes: line.minutes,
      goals: line.goals,
      assists: line.assists,
      yellows: line.yellows,
      reds: line.reds,
      ownGoals: line.ownGoals,
      cleanSheet: scored.cleanSheet,
      points: scored.points,
      fixtureDate: kickoffAt,
    };
  });

  const coachRows: Array<{
    gameweekId: string;
    coachId: string;
    fixtureId: number;
    result: string;
    points: number;
    fixtureDate: Date;
  }> = [];
  if (homeScore != null && awayScore != null) {
    const [legacyCoaches, coachMembers] = await Promise.all([
      prisma.coachKingSquad.findMany({
        where: {
          gameweekId: gameweek.id,
          isLive: false,
          confirmedAt: { not: null },
          coach: { teamId: { in: [fixture.homeTeamId, fixture.awayTeamId] } },
        },
        select: { coach: { select: { id: true, teamId: true } } },
      }),
      prisma.coachKingMembership.findMany({
        where: {
          coach: { teamId: { in: [fixture.homeTeamId, fixture.awayTeamId] } },
          selectedAt: { lte: kickoffAt },
          OR: [{ removedAt: null }, { removedAt: { gt: kickoffAt } }],
        },
        select: { coach: { select: { id: true, teamId: true } } },
      }),
    ]);
    const coaches = [
      ...legacyCoaches,
      ...coachMembers.filter((row) => row.coach).map((row) => ({ coach: row.coach })),
    ];
    const seen = new Set<string>();
    for (const row of coaches) {
      if (!row.coach || seen.has(row.coach.id)) continue;
      seen.add(row.coach.id);
      const teamGoals = row.coach.teamId === fixture.homeTeamId ? homeScore : awayScore;
      const conceded = row.coach.teamId === fixture.homeTeamId ? awayScore : homeScore;
      const result = coachKingMatchResult(teamGoals, conceded);
      coachRows.push({
        gameweekId: gameweek.id,
        coachId: row.coach.id,
        fixtureId: fixture.fixtureId,
        result,
        points: coachKingResultPoints(result),
        fixtureDate: kickoffAt,
      });
    }
  }

  const hash = statLineHash([
    ...performanceRows.map((row) => ({
      key: `p:${row.playerId}`,
      goals: row.goals,
      assists: row.assists,
      points: row.points,
      mark: `${row.minutes}:${row.yellows}:${row.reds}:${row.ownGoals}:${row.cleanSheet}`,
    })),
    ...coachRows.map((row) => ({ key: `c:${row.coachId}`, goals: 0, assists: 0, points: row.points, mark: row.result })),
  ]);
  if (fixture.processedAt && fixture.sourceHash === hash) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "coach_king_fixtures" WHERE id = ${fixture.id} FOR UPDATE`;
      const current = await tx.coachKingFixture.findUnique({ where: { id: fixture.id }, select: { sourceHash: true } });
      if (current?.sourceHash === hash) return;
      for (const row of performanceRows) {
        await tx.coachKingPerformance.upsert({
          where: { gameweekId_playerId_fixtureId: { gameweekId: row.gameweekId, playerId: row.playerId, fixtureId: row.fixtureId } },
          create: row,
          update: {
            minutes: row.minutes,
            goals: row.goals,
            assists: row.assists,
            yellows: row.yellows,
            reds: row.reds,
            ownGoals: row.ownGoals,
            cleanSheet: row.cleanSheet,
            points: row.points,
            fixtureDate: row.fixtureDate,
          },
        });
      }
      await tx.coachKingPerformance.deleteMany({
        where: performanceRows.length === 0
          ? { gameweekId: gameweek.id, fixtureId: fixture.fixtureId }
          : { gameweekId: gameweek.id, fixtureId: fixture.fixtureId, playerId: { notIn: performanceRows.map((row) => row.playerId) } },
      });
      for (const row of coachRows) {
        await tx.coachKingCoachScore.upsert({
          where: { gameweekId_coachId_fixtureId: { gameweekId: row.gameweekId, coachId: row.coachId, fixtureId: row.fixtureId } },
          create: row,
          update: { result: row.result, points: row.points, fixtureDate: row.fixtureDate },
        });
      }
      await tx.coachKingCoachScore.deleteMany({
        where: coachRows.length === 0
          ? { gameweekId: gameweek.id, fixtureId: fixture.fixtureId }
          : { gameweekId: gameweek.id, fixtureId: fixture.fixtureId, coachId: { notIn: coachRows.map((row) => row.coachId) } },
      });
      await tx.coachKingFixture.update({
        where: { id: fixture.id },
        data: {
          processedAt: fixture.processedAt ?? now,
          status,
          homeScore,
          awayScore,
          lastError: null,
          sourceHash: hash,
          revisedAt: fixture.sourceHash ? now : null,
        },
      });
      if (fixture.sourceHash && fixture.sourceHash !== hash) {
        const payouts = await tx.coachKingWeekPayout.findMany({ where: { gameweekId: gameweek.id }, select: { id: true, userId: true } });
        if (payouts.length) {
          const perfs = await tx.coachKingPerformance.findMany({
            where: { gameweekId: gameweek.id },
            select: { playerId: true, fixtureId: true, points: true, fixtureDate: true, createdAt: true },
          });
          const scores = await tx.coachKingCoachScore.findMany({
            where: { gameweekId: gameweek.id },
            select: { coachId: true, fixtureId: true, points: true, fixtureDate: true, createdAt: true },
          });
          const squads = await tx.coachKingSquad.findMany({
            where: { isLive: true, userId: { in: payouts.map((row) => row.userId) } },
            include: { memberships: true },
          });
          for (const squad of squads) {
            let points = 0;
            const seen = new Set<string>();
            for (const member of squad.memberships) {
              for (const row of perfs) {
                if (row.playerId !== member.playerId) continue;
                const key = `p:${row.fixtureId}`;
                if (seen.has(key)) continue;
                if (!performanceCountsForMember({ kickoffAt: row.fixtureDate, createdAt: row.createdAt, gameweekId: gameweek.id }, member, squad.gameweekId)) continue;
                seen.add(key);
                points += row.points;
              }
              for (const row of scores) {
                if (row.coachId !== member.coachId) continue;
                const key = `c:${row.fixtureId}`;
                if (seen.has(key)) continue;
                if (!performanceCountsForMember({ kickoffAt: row.fixtureDate, createdAt: row.createdAt, gameweekId: gameweek.id }, member, squad.gameweekId)) continue;
                seen.add(key);
                points += row.points;
              }
            }
            await tx.coachKingWeekPayout.updateMany({
              where: { userId: squad.userId, gameweekId: gameweek.id },
              data: { points },
            });
          }
        }
      }
    });
  } catch (error) {
    logger.error(`[fantasy.revision.failed] mode=coach-king fixtureId=${fixture.fixtureId} gameweekId=${gameweek.id}`);
    throw error;
  }
  if (fixture.sourceHash && fixture.sourceHash !== hash) {
    invalidateBoard();
    logger.info(`[fantasy.revision.applied] mode=coach-king fixtureId=${fixture.fixtureId} gameweekId=${gameweek.id}`);
  }
}

export async function processCoachKing(now: Date = new Date()): Promise<void> {
  try {
    await ensureCoachKingSchema();
    await ensureCoachKingPool();
    await refreshCoachKingPoolIfStale(now);
  } catch (error) {
    logger.warn(`[CoachKing] pool sync failed: ${(error as Error)?.message}`);
  }

  const current = await ensureCoachKingGameweek(now);
  await carryOverCoachKingSquads(current, now).catch((error) => {
    logger.warn(`[CoachKing] carry-over failed: ${(error as Error)?.message}`);
  });
  const pending = await prisma.coachKingGameweek.findMany({
    where: { status: { not: 'COMPLETED' }, startAt: { lte: current.startAt } },
    orderBy: { startAt: 'asc' },
  });
  const weeks = pending.length ? pending : [current];

  for (const gameweek of weeks) {
    if (gameweek.status === 'COMPLETED') {
      if (!gameweek.settledAt) await settleCoachKingGameweek(gameweek.id, now);
      continue;
    }

    const squads = await prisma.coachKingSquad.findMany({
      where: {
        confirmedAt: { not: null },
        OR: [{ gameweekId: gameweek.id, isLive: false }, { isLive: true }],
      },
      select: { coach: { select: { teamId: true } }, slots: { select: { player: { select: { teamId: true } } } } },
    });
    const teamIds = [...new Set(squads.flatMap((squad) => [
      ...squad.slots.map((slot) => slot.player.teamId),
      ...(squad.coach ? [squad.coach.teamId] : []),
    ]))];
    if (teamIds.length && now >= gameweek.startAt) {
      await storeFixtures(gameweek.id, await discoverFixtures(gameweek, teamIds));
    }

    const fixtures = await prisma.coachKingFixture.findMany({ where: { gameweekId: gameweek.id }, orderBy: { kickoffAt: 'asc' } });
    for (const fixture of fixtures) {
      try {
        await scoreFixture(gameweek, fixture, now);
      } catch (error) {
        logger.error(`[CoachKing] fixture ${fixture.fixtureId} failed:`, error);
        await prisma.coachKingFixture.update({
          where: { id: fixture.id },
          data: { failureCount: { increment: 1 }, lastError: ((error as Error)?.message ?? 'unknown').slice(0, 500) },
        }).catch(() => undefined);
      }
    }

    const refreshed = await prisma.coachKingFixture.findMany({
      where: { gameweekId: gameweek.id },
      select: { kickoffAt: true, processedAt: true, status: true },
    });
    const anyStarted = refreshed.some((row) => row.kickoffAt <= now && !isTsfPostponedStatus(row.status));
    const allSettled = refreshed.every((row) => row.processedAt != null || isTsfPostponedStatus(row.status));
    let status = nextTsfGameweekStatus(gameweek.status as never, {
      now,
      lockAt: gameweek.lockAt,
      endAt: gameweek.endAt,
      anyStarted,
      allSettled,
    }) as CoachKingGameweekStatus;
    const data: { status: CoachKingGameweekStatus; completedAt?: Date } = { status };
    if (status === 'CALCULATING') {
      status = 'COMPLETED';
      data.status = 'COMPLETED';
      data.completedAt = now;
    }
    if (tsfStatusRank(status as never) > tsfStatusRank(gameweek.status as never)) {
      await prisma.coachKingGameweek.update({ where: { id: gameweek.id }, data });
    }
    if (status === 'COMPLETED') await settleCoachKingGameweek(gameweek.id, now);
  }
}

let timer: NodeJS.Timeout | null = null;

export function startCoachKingProcessor(): void {
  if (timer) return;
  const tick = () => {
    processCoachKing().catch((error) => logger.error('[CoachKing] processor failed:', error));
  };
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  tick();
}
