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
  settleCoachKingGameweek,
} from './coach-king.service';
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
  if (fixture.processedAt) return;
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

  const selected = await prisma.coachKingSquadSlot.findMany({
    where: {
      squad: { gameweekId: gameweek.id, confirmedAt: { not: null } },
      player: { teamId: { in: [fixture.homeTeamId, fixture.awayTeamId] } },
    },
    select: { player: { select: { id: true, externalPlayerId: true, line: true } } },
  });
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
      fixtureDate: fixture.kickoffAt,
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
    const coaches = await prisma.coachKingSquad.findMany({
      where: {
        gameweekId: gameweek.id,
        confirmedAt: { not: null },
        coach: { teamId: { in: [fixture.homeTeamId, fixture.awayTeamId] } },
      },
      select: { coach: { select: { id: true, teamId: true } } },
    });
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
        fixtureDate: fixture.kickoffAt,
      });
    }
  }

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  if (performanceRows.length) {
    writes.push(prisma.coachKingPerformance.createMany({ data: performanceRows, skipDuplicates: true }));
  }
  if (coachRows.length) {
    writes.push(prisma.coachKingCoachScore.createMany({ data: coachRows, skipDuplicates: true }));
  }
  writes.push(prisma.coachKingFixture.update({
    where: { id: fixture.id },
    data: { processedAt: now, status, homeScore, awayScore, lastError: null },
  }));
  await prisma.$transaction(writes);
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
      where: { gameweekId: gameweek.id, confirmedAt: { not: null } },
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
