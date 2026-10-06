/**
 * Top Scorers Five — the scoring job.
 *
 *   unique selected players → their clubs → the gameweek's fixtures (stored)
 *   → finished fixtures only → one 365Scores game read per fixture
 *   → per-player goals/assists → insert-only performance rows.
 *
 * The work is per fixture, never per user: one game read scores every pool
 * player in it, and every user who picked them. A processed fixture is never
 * read again, and performance rows are unique per (gameweek, player, fixture),
 * so re-runs and overlapping runs cannot double count.
 *
 * Data comes from the app's existing pipeline: `CachedFixture` and
 * `footballDataCacheService.getMatchesByDate` for discovery, and
 * `fetchScores365GameById` for status + events. No API-Football quota is used.
 */

import type { TopScorersFiveFixture, TopScorersFiveGameweek } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';
import { classifyScores365MatchStatus, fetchScores365GameById } from './scores365-experiment.service';
import {
  computeTsfPoints,
  enabledTsfLeagues,
  extractTsfStatsFrom365Game,
  getTsfLeagueConfig,
  isTsfFinishedStatus,
  isTsfPostponedStatus,
  isTsfVoidStatus,
  nextTsfGameweekStatus,
  tsfGameAthleteIds,
  tsfStatusRank,
  type TsfLeagueConfig,
  type TsfScorableGame,
} from './top-scorers-five-scoring';
import { computeTsfLockAt, ensureTsfGameweek } from './top-scorers-five.service';

const TICK_MS = 10 * 60 * 1000;
/** A match is worth re-checking for a final whistle this long after kickoff. */
const EXPECTED_DURATION_MS = 110 * 60 * 1000;
const DAY_MS = 86_400_000;
/** Day lists are re-read at most this often per day per process. */
const DAY_SUPPLEMENT_TTL_MS = 30 * 60 * 1000;
/** Past this, a fixture that still has no result data is closed without points. */
const GIVE_UP_AFTER_MS = 4 * DAY_MS;

export type TsfFixtureOutcome =
  | 'scored'
  | 'already_processed'
  | 'not_started'
  | 'in_progress'
  | 'voided'
  | 'postponed'
  | 'missing_data'
  | 'error';

export type TsfProcessReport = {
  leagueKey: string;
  gameweekId: string;
  weekKey: string;
  status: TopScorersFiveGameweek['status'];
  selectedPlayers: number;
  fixtures: Array<{ fixtureId: number; outcome: TsfFixtureOutcome; rows?: number; error?: string }>;
};

type DiscoveredFixture = {
  fixtureId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string | null;
  awayTeamName: string | null;
  kickoffAt: Date;
  status: string;
};

type Game = NonNullable<Awaited<ReturnType<typeof fetchScores365GameById>>>;

/** The API-Football-shaped rows `getMatchesByDate` returns, as far as discovery reads them. */
type DayListItem = {
  fixture?: { id?: number; date?: string; status?: { short?: string } };
  league?: { id?: number };
  teams?: { home?: { id?: number; name?: string }; away?: { id?: number; name?: string } };
};

export type TsfProcessingDeps = {
  now: () => Date;
  fetchGame: (fixtureId: number) => Promise<Game | null>;
  classifyStatus: (game: Game) => string;
  listDayFixtures: (day: string) => Promise<unknown[]>;
};

const defaultDeps: TsfProcessingDeps = {
  now: () => new Date(),
  fetchGame: (fixtureId) => fetchScores365GameById(fixtureId, { force: true, language: 'en' }),
  classifyStatus: (game) => classifyScores365MatchStatus(game).short,
  listDayFixtures: async (day) => {
    const { footballDataCacheService } = await import('./football-data-cache.service');
    return footballDataCacheService.getMatchesByDate(day);
  },
};

const supplementedDays = new Map<string, number>();

function dayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  for (let t = start.getTime() - DAY_MS; t <= end.getTime(); t += DAY_MS) {
    keys.push(new Date(t).toISOString().slice(0, 10));
  }
  return keys;
}

/** The gameweek's fixtures for the given clubs, from the fixture cache plus day lists. */
async function discoverFixtures(
  cfg: TsfLeagueConfig,
  gameweek: TopScorersFiveGameweek,
  teamIds: number[],
  deps: TsfProcessingDeps,
): Promise<DiscoveredFixture[]> {
  const found = new Map<number, DiscoveredFixture>();
  const teamSet = new Set(teamIds);

  const cached = await prisma.cachedFixture.findMany({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: gameweek.startAt, lt: gameweek.endAt },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: {
      fixtureId: true, homeTeamId: true, awayTeamId: true,
      homeTeamName: true, awayTeamName: true, matchDate: true, status: true,
    },
  });
  for (const row of cached) {
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

  // The durable cache can miss days; the shared day lists fill the gaps for
  // days that have already started (future fixtures are always in the cache).
  const now = deps.now();
  const until = new Date(Math.min(now.getTime(), gameweek.endAt.getTime()));
  for (const day of dayKeysBetween(gameweek.startAt, until)) {
    const key = `${cfg.key}:${day}`;
    const last = supplementedDays.get(key);
    if (last && now.getTime() - last < DAY_SUPPLEMENT_TTL_MS) continue;
    try {
      const list = (await deps.listDayFixtures(day)) as DayListItem[];
      supplementedDays.set(key, now.getTime());
      for (const item of list ?? []) {
        if (item?.league?.id !== cfg.competitionLeagueId) continue;
        const homeId = Number(item?.teams?.home?.id);
        const awayId = Number(item?.teams?.away?.id);
        if (!teamSet.has(homeId) && !teamSet.has(awayId)) continue;
        const fixtureId = Number(item?.fixture?.id);
        const kickoffAt = new Date(item?.fixture?.date ?? '');
        if (!Number.isFinite(fixtureId) || Number.isNaN(kickoffAt.getTime())) continue;
        if (kickoffAt < gameweek.startAt || kickoffAt >= gameweek.endAt) continue;
        found.set(fixtureId, {
          fixtureId,
          homeTeamId: homeId,
          awayTeamId: awayId,
          homeTeamName: item?.teams?.home?.name ?? null,
          awayTeamName: item?.teams?.away?.name ?? null,
          kickoffAt,
          status: String(item?.fixture?.status?.short ?? 'NS'),
        });
      }
    } catch (error) {
      logger.warn(`[TopScorersFive] day list ${day} unavailable: ${(error as Error)?.message}`);
    }
  }

  return [...found.values()];
}

async function storeFixtures(gameweek: TopScorersFiveGameweek, fixtures: DiscoveredFixture[]): Promise<void> {
  for (const fixture of fixtures) {
    await prisma.topScorersFiveFixture.upsert({
      where: { gameweekId_fixtureId: { gameweekId: gameweek.id, fixtureId: fixture.fixtureId } },
      create: { gameweekId: gameweek.id, ...fixture },
      update: { kickoffAt: fixture.kickoffAt, homeTeamName: fixture.homeTeamName, awayTeamName: fixture.awayTeamName },
    });
  }
}

/**
 * Score one stored fixture if it has finished. Insert-only and idempotent: the
 * fixture row is stamped `processedAt` in the same transaction that writes its
 * performances, and duplicates are skipped by the unique key.
 */
export async function processTsfFixture(
  gameweek: TopScorersFiveGameweek,
  fixture: TopScorersFiveFixture,
  deps: TsfProcessingDeps = defaultDeps,
): Promise<{ outcome: TsfFixtureOutcome; rows?: number }> {
  if (fixture.processedAt) return { outcome: 'already_processed' };
  const now = deps.now();
  if (fixture.kickoffAt > now) return { outcome: 'not_started' };

  if (isTsfVoidStatus(fixture.status)) {
    await prisma.topScorersFiveFixture.update({ where: { id: fixture.id }, data: { processedAt: now } });
    return { outcome: 'voided' };
  }

  const cachedFinished = isTsfFinishedStatus(fixture.status);
  const dueForCheck = now.getTime() - fixture.kickoffAt.getTime() >= EXPECTED_DURATION_MS;
  if (!cachedFinished && !dueForCheck) return { outcome: 'in_progress' };

  const missingData = async (reason: string): Promise<{ outcome: TsfFixtureOutcome }> => {
    const givingUp = now.getTime() - fixture.kickoffAt.getTime() >= GIVE_UP_AFTER_MS;
    logger.warn(`[TopScorersFive] fixture ${fixture.fixtureId}: ${reason}${givingUp ? ' — closed without points' : ''}`);
    await prisma.topScorersFiveFixture.update({
      where: { id: fixture.id },
      data: { lastError: reason, ...(givingUp ? { processedAt: now, status: 'NO_DATA' } : {}) },
    });
    return { outcome: 'missing_data' };
  };

  if (!isNative365FixtureId(fixture.fixtureId)) return missingData('not a 365Scores game id');

  const game = await deps.fetchGame(fixture.fixtureId);
  if (!game) return missingData('no game data from 365Scores');

  const status = deps.classifyStatus(game);
  if (status !== fixture.status) {
    await prisma.topScorersFiveFixture.update({ where: { id: fixture.id }, data: { status } });
  }
  if (isTsfVoidStatus(status)) {
    await prisma.topScorersFiveFixture.update({ where: { id: fixture.id }, data: { processedAt: now } });
    return { outcome: 'voided' };
  }
  if (isTsfPostponedStatus(status)) return { outcome: 'postponed' };
  if (!isTsfFinishedStatus(status)) return { outcome: 'in_progress' };

  const scorable = game as unknown as TsfScorableGame;
  const stats = extractTsfStatsFrom365Game(scorable);
  const athletes = tsfGameAthleteIds(scorable);
  const pool = await prisma.topScorersFivePlayer.findMany({
    where: {
      leagueKey: gameweek.leagueKey,
      externalPlayerId: { not: null },
      OR: [
        { externalPlayerId: { in: [...athletes] } },
        { teamId: { in: [fixture.homeTeamId, fixture.awayTeamId] } },
      ],
    },
    select: { id: true, externalPlayerId: true },
  });

  const rows = pool.map((player) => {
    const line = stats.get(player.externalPlayerId as number) ?? { goals: 0, assists: 0 };
    return {
      gameweekId: gameweek.id,
      playerId: player.id,
      fixtureId: fixture.fixtureId,
      goals: line.goals,
      assists: line.assists,
      points: computeTsfPoints(line),
      status: 'FINISHED',
      fixtureDate: fixture.kickoffAt,
    };
  });

  const [{ count }] = await prisma.$transaction([
    prisma.topScorersFivePerformance.createMany({ data: rows, skipDuplicates: true }),
    prisma.topScorersFiveFixture.update({
      where: { id: fixture.id },
      data: { processedAt: now, status, lastError: null },
    }),
  ]);
  return { outcome: 'scored', rows: count };
}

/** One full pass over a gameweek: discover, score what finished, advance status. */
export async function processTsfGameweek(
  gameweek: TopScorersFiveGameweek,
  deps: TsfProcessingDeps = defaultDeps,
): Promise<TsfProcessReport> {
  const cfg = getTsfLeagueConfig(gameweek.leagueKey);
  const report: TsfProcessReport = {
    leagueKey: gameweek.leagueKey,
    gameweekId: gameweek.id,
    weekKey: gameweek.weekKey,
    status: gameweek.status,
    selectedPlayers: 0,
    fixtures: [],
  };
  if (!cfg || gameweek.status === 'COMPLETED') return report;
  const now = deps.now();

  let current = gameweek;
  if (current.status === 'OPEN' && now < current.lockAt) {
    const lockAt = await computeTsfLockAt(cfg, current);
    if (lockAt.getTime() !== current.lockAt.getTime()) {
      current = await prisma.topScorersFiveGameweek.update({ where: { id: current.id }, data: { lockAt } });
    }
  }

  const selected = await prisma.topScorersFiveSelection.findMany({
    where: { gameweekId: current.id },
    distinct: ['playerId'],
    select: { player: { select: { teamId: true } } },
  });
  report.selectedPlayers = selected.length;
  const teamIds = [...new Set(selected.map((s) => s.player.teamId).filter((id): id is number => id != null))];

  if (teamIds.length > 0 && now >= current.startAt) {
    try {
      await storeFixtures(current, await discoverFixtures(cfg, current, teamIds, deps));
    } catch (error) {
      logger.error(`[TopScorersFive] fixture discovery failed for ${current.leagueKey} ${current.weekKey}:`, error);
    }
  }

  const fixtures = await prisma.topScorersFiveFixture.findMany({
    where: { gameweekId: current.id },
    orderBy: { kickoffAt: 'asc' },
  });
  for (const fixture of fixtures) {
    try {
      const result = await processTsfFixture(current, fixture, deps);
      report.fixtures.push({ fixtureId: fixture.fixtureId, ...result });
    } catch (error) {
      const message = (error as Error)?.message ?? 'unknown';
      logger.error(`[TopScorersFive] fixture ${fixture.fixtureId} failed:`, error);
      await prisma.topScorersFiveFixture
        .update({ where: { id: fixture.id }, data: { failureCount: { increment: 1 }, lastError: message.slice(0, 500) } })
        .catch(() => undefined);
      report.fixtures.push({ fixtureId: fixture.fixtureId, outcome: 'error', error: message });
    }
  }

  const refreshed = await prisma.topScorersFiveFixture.findMany({
    where: { gameweekId: current.id },
    select: { kickoffAt: true, processedAt: true, status: true },
  });
  const anyStarted = refreshed.some((f) => f.kickoffAt <= now && !isTsfPostponedStatus(f.status));
  // Past the window, a still-postponed fixture belongs to a later week.
  const allSettled = refreshed.every((f) => f.processedAt != null || isTsfPostponedStatus(f.status));
  let status = nextTsfGameweekStatus(current.status, {
    now,
    lockAt: current.lockAt,
    endAt: current.endAt,
    anyStarted,
    allSettled,
  });
  const data: { status: typeof status; completedAt?: Date } = { status };
  if (status === 'CALCULATING') {
    status = 'COMPLETED';
    data.status = status;
    data.completedAt = now;
  }
  if (tsfStatusRank(status) > tsfStatusRank(current.status)) {
    await prisma.topScorersFiveGameweek.update({ where: { id: current.id }, data });
  }
  report.status = status;
  return report;
}

/**
 * F. Process every enabled league: the current gameweek plus any earlier one
 * that has not completed (late finals, retries after failures).
 */
export async function processTopScorersFive(
  options: { leagueKey?: string } = {},
  deps: TsfProcessingDeps = defaultDeps,
): Promise<TsfProcessReport[]> {
  const leagues = enabledTsfLeagues().filter((cfg) => !options.leagueKey || cfg.key === options.leagueKey);
  const reports: TsfProcessReport[] = [];
  for (const cfg of leagues) {
    try {
      const current = await ensureTsfGameweek(cfg.key, deps.now());
      const pending = await prisma.topScorersFiveGameweek.findMany({
        where: { leagueKey: cfg.key, status: { not: 'COMPLETED' }, startAt: { lte: current.startAt } },
        orderBy: { startAt: 'asc' },
      });
      for (const gameweek of pending) {
        reports.push(await processTsfGameweek(gameweek, deps));
      }
    } catch (error) {
      logger.error(`[TopScorersFive] processing failed for ${cfg.key}:`, error);
    }
  }
  return reports;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startTopScorersFiveProcessor(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    processTopScorersFive()
      .then((reports) => {
        const scored = reports.flatMap((r) => r.fixtures).filter((f) => f.outcome === 'scored').length;
        if (scored > 0) logger.info(`[TopScorersFive] scored ${scored} fixture(s)`);
      })
      .catch((error) => logger.error('[TopScorersFive] processor tick failed:', error))
      .finally(() => {
        running = false;
      });
  };
  tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  logger.info('✅ Top Scorers Five processor scheduled (every 10m)');
}
