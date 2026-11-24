/**
 * Top Scorers Five ("خماسي الهدافين") — gameweeks, the eligible pool, user
 * picks, scores and the leaderboard. Everything is keyed by league so adding a
 * league is a config + pool entry, not new code.
 *
 * Scoring reads only stored per-fixture performances; nothing here calls an
 * upstream API.
 */

import { Prisma, type TopScorersFiveGameweek, type TopScorersFivePlayer } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  combineTsfPickStates,
  enabledTsfCompetitions,
  enabledTsfGameweekConfigs,
  getTsfLeagueConfig,
  isTsfFinishedStatus,
  isTsfFixtureNotStarted,
  isTsfLeaguePickingOpen,
  isTsfSelectionLocked,
  isTsfVoidStatus,
  sumTsfPerformances,
  tsfCompetitionKey,
  tsfGameweekLeagueKey,
  tsfGameweekWindow,
  tsfIsSlotKey,
  tsfLegacySlotAlias,
  tsfPickState,
  tsfPoolKey,
  tsfPortraitUrl,
  tsfRoundNumber,
  tsfRoundReopenAt,
  tsfSlotKeys,
  tsfUpcomingWindow,
  type TsfLeagueConfig,
  type TsfPickState,
  type TsfTournament,
} from './top-scorers-five-scoring';
import { threeSixFiveScoresService } from './threeSixFiveScores.service';
import {
  fixtureAvailabilityLabel,
  isMemberEditLocked,
  isSquadEditLocked,
  memberLockedUntil,
  membershipCoversKickoff,
  nearestFixture,
  type FixtureAvailabilityLabel,
} from './squad-lock';

export type TsfErrorCode =
  | 'USER_NOT_FOUND'
  | 'LEAGUE_NOT_SUPPORTED'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ELIGIBLE'
  | 'PLAYER_UNRESOLVED'
  | 'PLAYER_ALREADY_PICKED'
  | 'GAMEWEEK_LOCKED'
  | 'GAMEWEEK_PICK_LOCKED';

export class TopScorersFiveError extends Error {
  constructor(public readonly code: TsfErrorCode, message: string) {
    super(message);
    this.name = 'TopScorersFiveError';
  }
}

export type TsfLanguage = 'ar' | 'en';

const COMPETITOR_LOGO = (teamId: number) =>
  `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v3/Competitors/${teamId}`;

function requireLeague(leagueKey: string): TsfLeagueConfig {
  const cfg = getTsfLeagueConfig(leagueKey);
  if (!cfg) throw new TopScorersFiveError('LEAGUE_NOT_SUPPORTED', `League ${leagueKey} is not available yet`);
  return cfg;
}

async function requireUserId(clerkUserId: string): Promise<string> {
  const user = await prisma.user.findFirst({ where: { clerkUserId }, select: { id: true } });
  if (!user) throw new TopScorersFiveError('USER_NOT_FOUND', 'User not found');
  return user.id;
}

// ─── Gameweeks ──────────────────────────────────────────────────────────────

/** First kickoff of the competition inside the window, or the window end. */
export async function computeTsfLockAt(
  cfg: TsfLeagueConfig,
  window: { startAt: Date; endAt: Date },
): Promise<Date> {
  const first = await prisma.cachedFixture.findFirst({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: window.startAt, lt: window.endAt },
      status: { notIn: ['PST', 'CANC', 'ABD', 'AWD', 'WO', 'TBD'] },
    },
    orderBy: { matchDate: 'asc' },
    select: { matchDate: true },
  });
  return first?.matchDate ?? window.endAt;
}

/**
 * The gameweek `at` falls in, created on first use. Until its first kickoff
 * each user's lineup is carried into it, so a picked player stays on the pitch
 * until the user replaces or removes him. `now` is the real clock; `at` only
 * chooses the window.
 */
export async function ensureTsfGameweek(
  leagueKey: string,
  now: Date = new Date(),
  at: Date = now,
): Promise<TopScorersFiveGameweek> {
  const cfg = requireLeague(leagueKey);
  const gwLeagueKey = tsfGameweekLeagueKey(cfg);
  const window = tsfGameweekWindow(at);
  const where = { leagueKey_weekKey: { leagueKey: gwLeagueKey, weekKey: window.weekKey } };
  let gameweek = await prisma.topScorersFiveGameweek.findUnique({ where });
  if (!gameweek) {
    const lockAt = await computeTsfLockAt(cfg, window);
    try {
      gameweek = await prisma.topScorersFiveGameweek.create({
        data: { leagueKey: gwLeagueKey, weekKey: window.weekKey, startAt: window.startAt, endAt: window.endAt, lockAt },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      gameweek = await prisma.topScorersFiveGameweek.findUniqueOrThrow({ where });
    }
  }
  if (gameweek.lineupCarriedAt == null && now < gameweek.lockAt) {
    gameweek = await carryOverTsfLineups(cfg, gameweek, now);
  }
  return gameweek;
}

/**
 * Weekly copies are retired. The live lineup lives on `TopScorersFiveSquad`.
 * Stamp the week so the old carry path does not keep retrying.
 */
async function carryOverTsfLineups(
  _cfg: TsfLeagueConfig,
  gameweek: TopScorersFiveGameweek,
  now: Date,
): Promise<TopScorersFiveGameweek> {
  await prisma.topScorersFiveGameweek.updateMany({
    where: { id: gameweek.id, lineupCarriedAt: null },
    data: { lineupCarriedAt: now },
  });
  return { ...gameweek, lineupCarriedAt: gameweek.lineupCarriedAt ?? now };
}

/**
 * Legacy week roller. Nothing in the pick or scoring path calls it: a finished
 * Tuesday window must not move a fixture onto the next week. Picks use
 * `ensureTsfGameweek`.
 */
export async function resolveTsfPickGameweek(
  leagueKey: string,
  now: Date = new Date(),
): Promise<TopScorersFiveGameweek> {
  const cfg = requireLeague(leagueKey);
  const current = await ensureTsfGameweek(leagueKey, now);
  const pickable = await tsfPickableTeamIds(cfg, current, now);
  // null = no fixtures yet → keep current (soft-open). Empty set = all done → next week.
  if (!pickable || pickable.size > 0) return current;
  const next = await ensureTsfGameweek(leagueKey, now, new Date(current.endAt.getTime() + 60_000));
  return next.id === current.id ? current : next;
}

export type TsfGameweekDto = {
  id: string;
  weekKey: string;
  /** ISO week number for the Tuesday window — shown as "الجولة N". */
  round: number;
  startAt: string;
  endAt: string;
  /** One hour after `endAt` — when the formation reopens for the next window. */
  reopenAt: string;
  lockAt: string;
  status: TopScorersFiveGameweek['status'];
  locked: boolean;
};

function gameweekDto(gameweek: TopScorersFiveGameweek, now: Date = new Date(), pickingOpen = true): TsfGameweekDto {
  return {
    id: gameweek.id,
    weekKey: gameweek.weekKey,
    round: tsfRoundNumber(gameweek.weekKey),
    startAt: gameweek.startAt.toISOString(),
    endAt: gameweek.endAt.toISOString(),
    reopenAt: tsfRoundReopenAt(gameweek.endAt).toISOString(),
    lockAt: gameweek.lockAt.toISOString(),
    status: gameweek.status,
    /** True when nobody left in this league can still be picked. */
    locked: !pickingOpen,
  };
}

const tsfFixtureHydrateAt = new Map<string, number>();
const tsfFixtureHydrateInflight = new Map<string, Promise<void>>();
const TSF_FIXTURE_HYDRATE_TTL_MS = 15 * 60_000;

/**
 * Egyptian (and other) TSF competitions are often missing from the daily
 * allscores cache. Pull the competition's fixtures from 365 once per window
 * so empty slots are not falsely locked.
 */
async function hydrateTsfCompetitionFixtures(
  cfg: TsfLeagueConfig,
  gameweek: TopScorersFiveGameweek,
): Promise<void> {
  const key = `${cfg.competitionLeagueId}:${gameweek.weekKey}`;
  const last = tsfFixtureHydrateAt.get(key) ?? 0;
  if (Date.now() - last < TSF_FIXTURE_HYDRATE_TTL_MS) return;

  const existing = await prisma.cachedFixture.count({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: gameweek.startAt, lt: gameweek.endAt },
    },
  });
  if (existing > 0) {
    tsfFixtureHydrateAt.set(key, Date.now());
    return;
  }

  const inflight = tsfFixtureHydrateInflight.get(key);
  if (inflight) {
    await inflight;
    return;
  }

  const run = (async () => {
    try {
      const n = await threeSixFiveScoresService.syncCompetitionFixtures(cfg.scores365CompetitionId);
      if (n > 0) {
        logger.info(
          `[TopScorersFive] hydrated ${n} fixture(s) for competition ${cfg.scores365CompetitionId} (${cfg.key})`,
        );
      }
    } catch (error) {
      logger.warn(
        `[TopScorersFive] fixture hydrate failed for ${cfg.key}: ${(error as Error)?.message}`,
      );
    } finally {
      tsfFixtureHydrateAt.set(key, Date.now());
      tsfFixtureHydrateInflight.delete(key);
    }
  })();
  tsfFixtureHydrateInflight.set(key, run);
  await run;
}

async function tsfAnyFixturesInWindow(
  cfg: TsfLeagueConfig,
  gameweek: TopScorersFiveGameweek,
): Promise<boolean> {
  const n = await prisma.cachedFixture.count({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: gameweek.startAt, lt: gameweek.endAt },
    },
  });
  return n > 0;
}

/**
 * Clubs that still have a not-started league fixture inside the gameweek
 * window — those are the only teams whose players remain selectable.
 * Returns `null` when the window has no fixtures yet (cache cold / midweek
 * break): callers then treat every active pool player as selectable.
 */
export async function tsfPickableTeamIds(
  cfg: TsfLeagueConfig,
  gameweek: TopScorersFiveGameweek,
  now: Date = new Date(),
): Promise<Set<number> | null> {
  if (!isTsfLeaguePickingOpen(gameweek, now)) return new Set();
  await hydrateTsfCompetitionFixtures(cfg, gameweek);

  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: gameweek.startAt, lt: gameweek.endAt, gt: now },
      status: { notIn: ['PST', 'CANC', 'ABD', 'AWD', 'WO', 'TBD', 'FT', 'AET', 'PEN', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'] },
    },
    select: { homeTeamId: true, awayTeamId: true, matchDate: true, status: true },
  });
  const ids = new Set<number>();
  for (const row of rows) {
    if (!isTsfFixtureNotStarted({ kickoffAt: row.matchDate, status: row.status }, now)) continue;
    ids.add(row.homeTeamId);
    ids.add(row.awayTeamId);
  }
  if (ids.size === 0 && !(await tsfAnyFixturesInWindow(cfg, gameweek))) return null;
  return ids;
}

async function leaguePickingOpen(
  cfg: TsfLeagueConfig,
  gameweek: TopScorersFiveGameweek,
  now: Date,
): Promise<boolean> {
  if (!isTsfLeaguePickingOpen(gameweek, now)) return false;
  const teams = await tsfPickableTeamIds(cfg, gameweek, now);
  // null = no fixtures in the window yet → keep picking open.
  if (teams == null) return true;
  return teams.size > 0;
}

// ─── Players ────────────────────────────────────────────────────────────────

export type TsfPlayerDto = {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string | null;
  club: string;
  teamId: number | null;
  teamLogo: string | null;
  photo: string | null;
  position: string | null;
  externalPlayerId: number | null;
  /** Tallies from fixtures this competition has scored (all gameweeks). */
  goals: number;
  assists: number;
  points: number;
  /** The player's league season so far, from 365Scores' leaderboards. */
  seasonGoals: number;
  seasonAssists: number;
  /** Nearest club fixture. Informational — it does not affect selection. */
  fixtureStatus: FixtureAvailabilityLabel | null;
};

type TsfSeasonLine = { goals: number; assists: number };

function playerDto(
  player: TopScorersFivePlayer,
  language: TsfLanguage,
  totals: { goals: number; assists: number; points: number } = { goals: 0, assists: 0, points: 0 },
  season: Map<number, TsfSeasonLine> = new Map(),
): TsfPlayerDto {
  const seasonLine = player.externalPlayerId != null ? season.get(player.externalPlayerId) : undefined;
  return {
    id: player.id,
    name: language === 'en' ? (player.nameEn ?? player.nameAr) : player.nameAr,
    nameAr: player.nameAr,
    nameEn: player.nameEn,
    club: language === 'en' ? (player.clubNameEn ?? player.clubNameAr) : player.clubNameAr,
    teamId: player.teamId,
    teamLogo: player.teamId ? COMPETITOR_LOGO(player.teamId) : null,
    photo: player.externalPlayerId != null ? tsfPortraitUrl(player.externalPlayerId) : player.photoUrl,
    position: player.position,
    externalPlayerId: player.externalPlayerId,
    ...totals,
    seasonGoals: seasonLine?.goals ?? 0,
    seasonAssists: seasonLine?.assists ?? 0,
    fixtureStatus: null,
  };
}

/** 365Scores leaderboard ids on `/web/stats/`. */
const SEASON_BOARD = { goals: 1, assists: 3 } as const;
const SEASON_STATS_TTL_MS = 10 * 60 * 1000;
const seasonStatsMemo = new Map<string, { at: number; stats: Map<number, TsfSeasonLine> }>();

/**
 * League-season goals and assists per athlete, one cached 365Scores call per
 * club rather than per player. Failures leave that club's players at zero.
 */
async function tsfSeasonStats(cfg: TsfLeagueConfig, teamIds: number[]): Promise<Map<number, TsfSeasonLine>> {
  const clubs = [...new Set(teamIds)].sort((a, b) => a - b);
  const memoKey = `${cfg.key}:${clubs.join(',')}`;
  const memo = seasonStatsMemo.get(memoKey);
  if (memo && Date.now() - memo.at < SEASON_STATS_TTL_MS) return memo.stats;

  const stats = new Map<number, TsfSeasonLine>();
  const results = await Promise.all(
    clubs.map((teamId) =>
      threeSixFiveScoresService
        .getCompetitorStats(teamId, cfg.scores365CompetitionId, 'en', { roster: true })
        .catch(() => ({ data: null })),
    ),
  );
  for (const result of results) {
    for (const board of result.data?.leaderboards ?? []) {
      const field = board.key === SEASON_BOARD.goals ? 'goals' : board.key === SEASON_BOARD.assists ? 'assists' : null;
      if (!field) continue;
      for (const row of board.rows) {
        const value = Number.parseInt(String(row.value), 10);
        if (!Number.isFinite(value)) continue;
        const line = stats.get(row.athleteId) ?? { goals: 0, assists: 0 };
        line[field] = value;
        stats.set(row.athleteId, line);
      }
    }
  }
  seasonStatsMemo.set(memoKey, { at: Date.now(), stats });
  return stats;
}

function teamIdsOf(players: TopScorersFivePlayer[]): number[] {
  return players.map((p) => p.teamId).filter((id): id is number => id != null);
}

async function playerTotals(playerIds: string[]): Promise<Map<string, { goals: number; assists: number; points: number }>> {
  if (playerIds.length === 0) return new Map();
  const rows = await prisma.topScorersFivePerformance.groupBy({
    by: ['playerId'],
    where: { playerId: { in: playerIds } },
    _sum: { goals: true, assists: true, points: true },
  });
  return new Map(
    rows.map((row) => [
      row.playerId,
      { goals: row._sum.goals ?? 0, assists: row._sum.assists ?? 0, points: row._sum.points ?? 0 },
    ]),
  );
}

let egyptPoolSync: Promise<void> | null = null;

/** First Egypt request fills the shared attackers pool from 365Scores squads. */
async function ensureEgyptAttackersPool(): Promise<void> {
  const count = await prisma.topScorersFivePlayer.count({
    where: { leagueKey: tsfPoolKey(requireLeague('egypt1')), active: true },
  });
  if (count > 0) return;
  if (!egyptPoolSync) {
    egyptPoolSync = (async () => {
      const { syncEgyptAttackersPool } = await import('./top-scorers-five-pool.service');
      await syncEgyptAttackersPool();
    })()
      .catch((error) => {
        logger.warn(`[TopScorersFive] egypt pool auto-sync failed: ${(error as Error)?.message}`);
      })
      .finally(() => {
        egyptPoolSync = null;
      });
  }
  await egyptPoolSync;
}

/** Label each club's nearest fixture. Missing fixtures leave the label null. */
async function fixtureLabelsByTeam(
  cfg: TsfLeagueConfig,
  teamIds: number[],
  now: Date,
): Promise<Map<number, FixtureAvailabilityLabel>> {
  const labels = new Map<number, FixtureAvailabilityLabel>();
  if (teamIds.length === 0) return labels;
  const from = new Date(now.getTime() - 21 * 86_400_000);
  const to = new Date(now.getTime() + 21 * 86_400_000);
  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: from, lt: to },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: { homeTeamId: true, awayTeamId: true, matchDate: true, status: true },
  });
  const byTeam = new Map<number, Array<{ kickoffAt: Date; status: string }>>();
  for (const row of rows) {
    for (const teamId of [row.homeTeamId, row.awayTeamId]) {
      if (!teamIds.includes(teamId)) continue;
      const list = byTeam.get(teamId) ?? [];
      list.push({ kickoffAt: row.matchDate, status: row.status });
      byTeam.set(teamId, list);
    }
  }
  for (const [teamId, fixtures] of byTeam) {
    const nearest = nearestFixture(fixtures, now);
    if (nearest) labels.set(teamId, fixtureAvailabilityLabel(nearest.status, nearest.kickoffAt, now));
  }
  return labels;
}

/** A. Every resolved, active player. Fixture status is a label, not a filter. */
export async function listTsfEligiblePlayers(
  leagueKey: string,
  language: TsfLanguage,
  now: Date = new Date(),
): Promise<TsfPlayerDto[]> {
  const cfg = requireLeague(leagueKey);
  if (cfg.tournament === 'egypt') await ensureEgyptAttackersPool();
  const players = await prisma.topScorersFivePlayer.findMany({
    where: {
      leagueKey: tsfPoolKey(cfg),
      active: true,
      externalPlayerId: { not: null },
    },
    orderBy: { sortOrder: 'asc' },
  });
  const [totals, season, labels] = await Promise.all([
    playerTotals(players.map((p) => p.id)),
    tsfSeasonStats(cfg, teamIdsOf(players)),
    fixtureLabelsByTeam(cfg, teamIdsOf(players), now),
  ]);
  return players.map((player) => ({
    ...playerDto(player, language, totals.get(player.id), season),
    fixtureStatus: player.teamId != null ? labels.get(player.teamId) ?? null : null,
  }));
}

// ─── Selection ──────────────────────────────────────────────────────────────

export type TsfFixtureScoreDto = {
  fixtureId: number;
  fixtureDate: string;
  goals: number;
  assists: number;
  points: number;
};

export type TsfSquadLockDto = {
  scopeKey: string;
  locked: boolean;
  unlocksAt: string | null;
  confirmedAt: string | null;
  dirty: boolean;
  /** The lock has expired, or this squad has never been confirmed. */
  readyToEdit: boolean;
};

export type TsfSelectionDto = {
  leagueKey: string;
  gameweek: TsfGameweekDto;
  /** Where this league's pick stands (see `tsfPickState`). */
  state: TsfPickState;
  squad: TsfSquadLockDto;
  selection: null | {
    player: TsfPlayerDto;
    /** D. The pick's score this gameweek, from finished fixtures only. */
    score: { goals: number; assists: number; points: number; fixtures: TsfFixtureScoreDto[] };
    /** The user confirmed this pick; it is final for the gameweek. */
    confirmed: boolean;
    confirmedAt: string | null;
    /** Cannot be changed or removed any more (confirmed, its match kicked off, or the gameweek is closed). */
    locked: boolean;
    updatedAt: string;
  };
};

type SelectionWithPlayer = { playerId: string; confirmedAt: Date | null; updatedAt: Date; player: TopScorersFivePlayer };

async function selectionDto(
  gameweek: TopScorersFiveGameweek,
  selection: SelectionWithPlayer | null,
  language: TsfLanguage,
  now: Date = new Date(),
  /** Pitch slot / Europe league key — may differ from `gameweek.leagueKey` for Egypt. */
  leagueKey: string = gameweek.leagueKey,
): Promise<TsfSelectionDto> {
  const cfg = getTsfLeagueConfig(leagueKey) ?? getTsfLeagueConfig(gameweek.leagueKey);
  const pickingOpen = cfg ? await leaguePickingOpen(cfg, gameweek, now) : false;
  if (!selection) {
    return {
      leagueKey,
      gameweek: gameweekDto(gameweek, now, pickingOpen),
      state: 'PICKING',
      squad: { scopeKey: leagueKey, locked: false, unlocksAt: null, confirmedAt: null, dirty: false, readyToEdit: true },
      selection: null,
    };
  }

  const [performances, totals, season, fixtures] = await Promise.all([
    prisma.topScorersFivePerformance.findMany({
      where: { gameweekId: gameweek.id, playerId: selection.playerId },
      orderBy: { fixtureDate: 'asc' },
      select: { fixtureId: true, fixtureDate: true, goals: true, assists: true, points: true },
    }),
    playerTotals([selection.playerId]),
    cfg ? tsfSeasonStats(cfg, teamIdsOf([selection.player])) : Promise.resolve(new Map<number, TsfSeasonLine>()),
    cfg ? tsfRelevantFixtures(cfg, gameweek, teamIdsOf([selection.player])) : Promise.resolve([]),
  ]);
  const locked = isTsfSelectionLocked(selection, gameweek, now, fixtures);
  return {
    leagueKey,
    gameweek: gameweekDto(gameweek, now, pickingOpen),
    squad: {
      scopeKey: leagueKey,
      locked,
      unlocksAt: null,
      confirmedAt: selection.confirmedAt?.toISOString() ?? null,
      dirty: false,
      readyToEdit: !locked,
    },
    state: tsfPickState({ picked: true, locked, now, windowEnd: gameweek.endAt, fixtures }),
    selection: {
      player: playerDto(selection.player, language, totals.get(selection.playerId), season),
      score: {
        ...sumTsfPerformances(performances),
        fixtures: performances.map((row) => ({ ...row, fixtureDate: row.fixtureDate.toISOString() })),
      },
      confirmed: selection.confirmedAt != null,
      confirmedAt: selection.confirmedAt?.toISOString() ?? null,
      locked,
      updatedAt: selection.updatedAt.toISOString(),
    },
  };
}

function tsfScopeKey(cfg: TsfLeagueConfig): string {
  return tsfPoolKey(cfg);
}

/** `laliga` still means the first slot, so older clients keep a place to save. */
function resolveSlotKey(raw: string): string {
  if (tsfIsSlotKey(raw)) return raw;
  const competition = tsfCompetitionKey(raw);
  return competition ? `${competition}1` : raw;
}

function memberForSlot(members: TsfMemberRow[], slotKey: string): TsfMemberRow | null {
  const direct = members.find((row) => row.slotKey === slotKey) ?? null;
  if (direct) return direct;
  const legacy = tsfLegacySlotAlias(slotKey);
  if (!legacy) return null;
  return members.find((row) => row.slotKey === legacy) ?? null;
}

type TsfSquadRow = {
  id: string;
  userId: string;
  scopeKey: string;
  confirmedAt: Date | null;
  unlocksAt: Date | null;
  version: number;
};

type TsfMemberRow = {
  id: string;
  slotKey: string;
  playerId: string;
  selectedAt: Date;
  removedAt: Date | null;
  lockedUntil: Date | null;
  legacyThrough: Date | null;
};

type TsfDraftRow = { slotKey: string; playerId: string | null };

function squadLockDto(squad: TsfSquadRow, dirty: boolean, now: Date): TsfSquadLockDto {
  const locked = isSquadEditLocked(squad.unlocksAt, now);
  return {
    scopeKey: squad.scopeKey,
    locked,
    unlocksAt: squad.unlocksAt?.toISOString() ?? null,
    confirmedAt: squad.confirmedAt?.toISOString() ?? null,
    dirty,
    readyToEdit: !locked,
  };
}

async function ensureTsfSquad(userId: string, scopeKey: string): Promise<TsfSquadRow> {
  const where = { userId_scopeKey: { userId, scopeKey } };
  const existing = await prisma.topScorersFiveSquad.findUnique({ where });
  if (existing) return existing;
  try {
    return await prisma.topScorersFiveSquad.create({ data: { userId, scopeKey } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.topScorersFiveSquad.findUniqueOrThrow({ where });
    }
    throw error;
  }
}

async function openMembers(squadId: string): Promise<TsfMemberRow[]> {
  return prisma.topScorersFiveSquadMember.findMany({
    where: { squadId, removedAt: null },
    select: { id: true, slotKey: true, playerId: true, selectedAt: true, removedAt: true, lockedUntil: true, legacyThrough: true },
  });
}

async function slotDrafts(squadId: string): Promise<TsfDraftRow[]> {
  return prisma.topScorersFiveSquadDraft.findMany({
    where: { squadId },
    select: { slotKey: true, playerId: true },
  });
}

function assertSquadEditable(squad: TsfSquadRow, now: Date): void {
  if (isSquadEditLocked(squad.unlocksAt, now)) {
    throw new TopScorersFiveError('GAMEWEEK_PICK_LOCKED', 'Your squad is locked');
  }
}

function desiredLineup(members: TsfMemberRow[], drafts: TsfDraftRow[]): Array<{ slotKey: string; playerId: string }> {
  const lineup = new Map(members.map((member) => [member.slotKey, member.playerId]));
  for (const draft of drafts) {
    if (draft.playerId == null) lineup.delete(draft.slotKey);
    else lineup.set(draft.slotKey, draft.playerId);
  }
  return [...lineup.entries()].map(([slotKey, playerId]) => ({ slotKey, playerId }));
}

function slotLockDto(squad: TsfSquadRow, member: TsfMemberRow | null, now: Date): TsfSquadLockDto {
  const locked = member != null && isMemberEditLocked(member.lockedUntil, now);
  return {
    scopeKey: squad.scopeKey,
    locked,
    unlocksAt: member?.lockedUntil?.toISOString() ?? null,
    confirmedAt: squad.confirmedAt?.toISOString() ?? null,
    dirty: false,
    readyToEdit: !locked,
  };
}

/** B + D. One pitch slot. Its 7-day lock does not close the other four. */
export async function getTsfSelection(
  clerkUserId: string,
  leagueKey: string,
  language: TsfLanguage,
  now: Date = new Date(),
): Promise<TsfSelectionDto> {
  const userId = await requireUserId(clerkUserId);
  const slotKey = resolveSlotKey(leagueKey);
  const cfg = requireLeague(slotKey);
  const gameweek = await ensureTsfGameweek(cfg.key, now);
  const squad = await ensureTsfSquad(userId, tsfScopeKey(cfg));
  const members = await openMembers(squad.id);
  const member = memberForSlot(members, slotKey);
  const lock = slotLockDto(squad, member, now);
  const base = {
    leagueKey: slotKey,
    gameweek: gameweekDto(gameweek, now, !lock.locked),
    squad: lock,
  };
  if (!member) return { ...base, state: 'PICKING', selection: null };
  const player = await prisma.topScorersFivePlayer.findUnique({ where: { id: member.playerId } });
  if (!player) return { ...base, state: 'PICKING', selection: null };

  const performances = await prisma.topScorersFivePerformance.findMany({
    where: { gameweekId: gameweek.id, playerId: player.id },
    orderBy: { fixtureDate: 'asc' },
    select: { fixtureId: true, fixtureDate: true, goals: true, assists: true, points: true, createdAt: true },
  });
  const covered = performances.filter((row) => {
    const legacy = member.legacyThrough != null && row.createdAt.getTime() <= member.legacyThrough.getTime();
    return legacy || membershipCoversKickoff(member, row.fixtureDate);
  });
  const [totals, season] = await Promise.all([
    playerTotals([player.id]),
    tsfSeasonStats(cfg, teamIdsOf([player])),
  ]);
  return {
    ...base,
    state: lock.locked ? 'CONFIRMED' : 'PICKING',
    selection: {
      player: playerDto(player, language, totals.get(player.id), season),
      score: {
        ...sumTsfPerformances(covered),
        fixtures: covered.map((row) => ({
          fixtureId: row.fixtureId,
          fixtureDate: row.fixtureDate.toISOString(),
          goals: row.goals,
          assists: row.assists,
          points: row.points,
        })),
      },
      confirmed: true,
      confirmedAt: squad.confirmedAt?.toISOString() ?? member.selectedAt.toISOString(),
      locked: lock.locked,
      updatedAt: member.selectedAt.toISOString(),
    },
  };
}

function isSameSlot(storedKey: string, slotKey: string): boolean {
  return storedKey === slotKey || storedKey === tsfLegacySlotAlias(slotKey);
}

async function assertNotDuplicated(
  slotKey: string,
  playerId: string,
  members: TsfMemberRow[],
): Promise<void> {
  if (members.some((slot) => !isSameSlot(slot.slotKey, slotKey) && slot.playerId === playerId)) {
    throw new TopScorersFiveError('PLAYER_ALREADY_PICKED', 'Player is already picked in another slot');
  }
}

/**
 * Confirms one slot immediately and locks only that player for 7 days.
 * Empty slots in the same league stay open. Fixture status never rejects the player.
 */
export async function saveTsfSelection(
  clerkUserId: string,
  leagueKey: string,
  playerId: string,
  language: TsfLanguage,
  now: Date = new Date(),
): Promise<TsfSelectionDto> {
  const userId = await requireUserId(clerkUserId);
  const slotKey = resolveSlotKey(leagueKey);
  const cfg = requireLeague(slotKey);
  const player = await prisma.topScorersFivePlayer.findUnique({ where: { id: playerId } });
  if (!player) throw new TopScorersFiveError('PLAYER_NOT_FOUND', 'Player not found');
  if (player.leagueKey !== tsfPoolKey(cfg) || !player.active) {
    throw new TopScorersFiveError('PLAYER_NOT_ELIGIBLE', 'Player is not eligible for this league');
  }
  if (player.externalPlayerId == null) {
    throw new TopScorersFiveError('PLAYER_UNRESOLVED', 'Player is not linked to match data yet');
  }

  const squad = await ensureTsfSquad(userId, tsfScopeKey(cfg));
  const version = squad.version;
  const confirmedAt = squad.confirmedAt;
  const members = await openMembers(squad.id);
  const current = memberForSlot(members, slotKey);
  if (current?.playerId === player.id) {
    return getTsfSelection(clerkUserId, slotKey, language, now);
  }
  if (current && isMemberEditLocked(current.lockedUntil, now)) {
    throw new TopScorersFiveError('GAMEWEEK_PICK_LOCKED', 'This player is locked');
  }
  await assertNotDuplicated(slotKey, player.id, members);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.topScorersFiveSquad.updateMany({
      where: { id: squad.id, version },
      data: { version: version + 1, confirmedAt: confirmedAt ?? now },
    });
    if (claimed.count === 0) {
      logger.info(`[fantasy.confirm.conflict] mode=five league=${slotKey}`);
      throw new TopScorersFiveError('GAMEWEEK_PICK_LOCKED', 'Your squad is locked');
    }
    if (current) {
      await tx.topScorersFiveSquadMember.updateMany({
        where: { id: current.id, removedAt: null },
        data: { removedAt: now },
      });
    }
    await tx.topScorersFiveSquadMember.create({
      data: {
        squadId: squad.id,
        slotKey,
        playerId: player.id,
        selectedAt: now,
        lockedUntil: memberLockedUntil(now),
      },
    });
  });
  return getTsfSelection(clerkUserId, slotKey, language, now);
}

/**
 * Lineups confirm per slot. This remains so older clients get the current
 * slot back instead of starting a squad-wide lock.
 */
export async function confirmTsfSquad(
  clerkUserId: string,
  leagueKey: string,
  language: TsfLanguage,
  now: Date = new Date(),
): Promise<TsfSelectionDto> {
  return getTsfSelection(clerkUserId, leagueKey, language, now);
}

export type TsfLineupDto = {
  leagueKey: string;
  gameweek: TsfGameweekDto;
  points: number;
  slots: Array<{
    slotKey: string;
    locked: boolean;
    lockedUntil: string | null;
    player: TsfPlayerDto | null;
    score: { goals: number; assists: number; points: number };
  }>;
};

/** The five slots of one competition, each with its own lock. */
export async function getTsfLineup(
  clerkUserId: string,
  leagueKey: string,
  language: TsfLanguage,
  now: Date = new Date(),
): Promise<TsfLineupDto> {
  const competition = tsfCompetitionKey(leagueKey);
  if (!competition) throw new TopScorersFiveError('LEAGUE_NOT_SUPPORTED', `League ${leagueKey} is not available yet`);
  const slots = await Promise.all(
    tsfSlotKeys(competition).map((slotKey) => getTsfSelection(clerkUserId, slotKey, language, now)),
  );
  return {
    leagueKey: competition,
    gameweek: slots[0]?.gameweek ?? gameweekDto(await ensureTsfGameweek(competition, now), now, true),
    points: slots.reduce((sum, slot) => sum + (slot.selection?.score.points ?? 0), 0),
    slots: slots.map((slot) => ({
      slotKey: slot.leagueKey,
      locked: slot.squad.locked,
      lockedUntil: slot.squad.unlocksAt,
      player: slot.selection?.player ?? null,
      score: {
        goals: slot.selection?.score.goals ?? 0,
        assists: slot.selection?.score.assists ?? 0,
        points: slot.selection?.score.points ?? 0,
      },
    })),
  };
}

/** Drop one slot once its own 7 days are over. The other four stay as they are. */
export async function clearTsfSelection(clerkUserId: string, leagueKey: string, now: Date = new Date()): Promise<void> {
  const userId = await requireUserId(clerkUserId);
  const slotKey = resolveSlotKey(leagueKey);
  const cfg = requireLeague(slotKey);
  const squad = await ensureTsfSquad(userId, tsfScopeKey(cfg));
  const version = squad.version;
  const members = await openMembers(squad.id);
  const current = memberForSlot(members, slotKey);
  if (!current) return;
  if (isMemberEditLocked(current.lockedUntil, now)) {
    throw new TopScorersFiveError('GAMEWEEK_PICK_LOCKED', 'This player is locked');
  }
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.topScorersFiveSquad.updateMany({
      where: { id: squad.id, version },
      data: { version: version + 1 },
    });
    if (claimed.count === 0) throw new TopScorersFiveError('GAMEWEEK_PICK_LOCKED', 'Your squad is locked');
    await tx.topScorersFiveSquadMember.updateMany({
      where: { id: current.id, removedAt: null },
      data: { removedAt: now },
    });
  });
}

// ─── Scores ─────────────────────────────────────────────────────────────────

type PickRow = { userId: string; gameweekId: string; playerId: string; leagueKey: string };

/** Points per (gameweek, player) pair — the unit every user score is summed from. */
async function pointsByGameweekPlayer(picks: PickRow[]): Promise<Map<string, number>> {
  const gameweekIds = [...new Set(picks.map((p) => p.gameweekId))];
  const playerIds = [...new Set(picks.map((p) => p.playerId))];
  if (gameweekIds.length === 0) return new Map();
  const rows = await prisma.topScorersFivePerformance.groupBy({
    by: ['gameweekId', 'playerId'],
    where: { gameweekId: { in: gameweekIds }, playerId: { in: playerIds } },
    _sum: { points: true },
  });
  return new Map(rows.map((row) => [`${row.gameweekId}:${row.playerId}`, row._sum.points ?? 0]));
}

export function scoreTsfPicks(picks: PickRow[], points: Map<string, number>): Map<string, number> {
  const byUser = new Map<string, number>();
  for (const pick of picks) {
    const value = points.get(`${pick.gameweekId}:${pick.playerId}`) ?? 0;
    byUser.set(pick.userId, (byUser.get(pick.userId) ?? 0) + value);
  }
  return byUser;
}

export type TsfUserScoreDto = {
  total: number;
  /** This gameweek: the sum of every picked player's points over all his fixtures. */
  week: number;
  /** COMPLETED only once every picked player's matches this gameweek are stored. */
  state: TsfPickState;
  leagues: Array<{ leagueKey: string; total: number; week: number; state: TsfPickState }>;
};

type AttributedScore = { total: number; week: number; firstAt: number };

const TSF_BOARD_TTL_MS = 30_000;
let tsfBoardCache: { at: number; key: string; value: Map<string, Map<string, AttributedScore>> } | null = null;

/** Drop the ranked page after a fixture's stored line changes. */
export function invalidateTsfBoard(): void {
  tsfBoardCache = null;
}

/**
 * User points from confirmed membership at kickoff.
 * Performances written before `legacyThrough` stay with the old selection row
 * so an open week is not clawed back.
 */
async function attributeTsfPoints(
  scopes: string[],
  weekIds: Set<string>,
): Promise<Map<string, Map<string, AttributedScore>>> {
  if (scopes.length === 0) return new Map();
  const key = `${[...scopes].sort().join(',')}|${[...weekIds].sort().join(',')}`;
  if (tsfBoardCache && tsfBoardCache.key === key && Date.now() - tsfBoardCache.at < TSF_BOARD_TTL_MS) {
    return tsfBoardCache.value;
  }
  const started = Date.now();
  const weekList = [...weekIds];
  const rows = await prisma.$queryRaw<Array<{
    userId: string;
    leagueKey: string;
    total: number | bigint;
    week: number | bigint;
    firstAt: Date;
  }>>`
    WITH credited AS (
      SELECT s."userId" AS "userId",
             CASE
               WHEN s."leagueKey" LIKE 'egypt%' THEN 'egypt'
               WHEN s."leagueKey" ~ '^(ligue1|laliga|bundesliga|seriea|pl)[1-5]$'
                 THEN regexp_replace(s."leagueKey", '[1-5]$', '')
               ELSE s."leagueKey"
             END AS "leagueKey",
             p."gameweekId" AS "gameweekId",
             p."points" AS points,
             s."createdAt" AS "at"
      FROM "top_scorers_five_performances" p
      JOIN "top_scorers_five_selections" s
        ON s."gameweekId" = p."gameweekId"
       AND s."playerId" = p."playerId"
       AND s."legacyThrough" IS NOT NULL
       AND p."createdAt" <= s."legacyThrough"
      WHERE (
        CASE
          WHEN s."leagueKey" LIKE 'egypt%' THEN 'egypt'
          WHEN s."leagueKey" ~ '^(ligue1|laliga|bundesliga|seriea|pl)[1-5]$'
            THEN regexp_replace(s."leagueKey", '[1-5]$', '')
          ELSE s."leagueKey"
        END
      ) IN (${Prisma.join(scopes)})
      UNION ALL
      SELECT sq."userId",
             sq."scopeKey",
             p."gameweekId",
             p."points",
             m."selectedAt"
      FROM "top_scorers_five_performances" p
      JOIN "top_scorers_five_squad_members" m ON m."playerId" = p."playerId"
      JOIN "top_scorers_five_squads" sq ON sq."id" = m."squadId"
      WHERE sq."confirmedAt" IS NOT NULL
        AND sq."scopeKey" IN (${Prisma.join(scopes)})
        AND p."fixtureDate" >= m."selectedAt"
        AND (m."removedAt" IS NULL OR p."fixtureDate" < m."removedAt")
        AND NOT EXISTS (
          SELECT 1 FROM "top_scorers_five_selections" s
          WHERE s."userId" = sq."userId"
            AND s."gameweekId" = p."gameweekId"
            AND s."playerId" = p."playerId"
            AND s."legacyThrough" IS NOT NULL
            AND p."createdAt" <= s."legacyThrough"
        )
    )
    SELECT "userId",
           "leagueKey",
           COALESCE(SUM(points), 0) AS total,
           COALESCE(SUM(points) FILTER (WHERE "gameweekId" IN (${weekList.length ? Prisma.join(weekList) : Prisma.sql`NULL`})), 0) AS week,
           MIN("at") AS "firstAt"
    FROM credited
    GROUP BY "userId", "leagueKey"
  `;
  const byUser = new Map<string, Map<string, AttributedScore>>();
  for (const row of rows) {
    const leagues = byUser.get(row.userId) ?? new Map<string, AttributedScore>();
    leagues.set(row.leagueKey, {
      total: Number(row.total),
      week: Number(row.week),
      firstAt: row.firstAt ? new Date(row.firstAt).getTime() : 0,
    });
    byUser.set(row.userId, leagues);
  }
  tsfBoardCache = { at: Date.now(), key, value: byUser };
  logger.info(`[fantasy.board.ms] mode=five durationMs=${Date.now() - started}`);
  return byUser;
}

/** E. The user's competition score: all leagues, all gameweeks (and this week). */
export async function getTsfUserScore(
  clerkUserId: string,
  tournament: TsfTournament = 'europe',
  leagueKey?: string,
): Promise<TsfUserScoreDto> {
  const userId = await requireUserId(clerkUserId);
  const competition = leagueKey ? tsfCompetitionKey(leagueKey) ?? undefined : undefined;
  const leaguePicks = await tsfLeaguePicks(userId, undefined, tournament, competition);
  const weekIds = new Set(leaguePicks.map((pick) => pick.gameweek.id));
  const stateByLeague = new Map(leaguePicks.map((pick) => [tsfScopeKey(pick.cfg), pick.state]));
  const scopes = competition
    ? [competition]
    : enabledTsfCompetitions(tournament).map((cfg) => tsfScopeKey(cfg));
  const scores = await attributeTsfPoints(scopes, weekIds);
  const mine = scores.get(userId) ?? new Map<string, AttributedScore>();
  const list = [...mine.entries()].map(([leagueKey, value]) => ({
    leagueKey,
    total: value.total,
    week: value.week,
    state: stateByLeague.get(leagueKey) ?? ('PICKING' as TsfPickState),
  }));
  return {
    total: list.reduce((sum, league) => sum + league.total, 0),
    week: list.reduce((sum, league) => sum + league.week, 0),
    state: combineTsfPickStates(leaguePicks.filter((pick) => pick.selection != null).map((pick) => pick.state)),
    leagues: list,
  };
}

export type TsfPeriod = 'week' | 'all';

export type TsfLeaderboardDto = {
  period: TsfPeriod;
  entries: Array<{
    rank: number;
    userId: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    xp: number;
  }>;
  me: { rank: number | null; xp: number; userId: string } | null;
};

/**
 * Users ranked by competition points: this gameweek (every league's current
 * week) or all time. Anyone with a pick in the period is listed; ties go to
 * whoever picked first. Same shape as the King of Predictions board.
 */
export async function getTsfLeaderboard(params: {
  clerkUserId: string;
  period: TsfPeriod;
  limit: number;
  tournament?: TsfTournament;
  leagueKey?: string;
  /** Rank by the sum of every league, Egypt included. */
  allLeagues?: boolean;
}): Promise<TsfLeaderboardDto> {
  const tournament = params.tournament ?? 'europe';
  const competition = params.leagueKey ? tsfCompetitionKey(params.leagueKey) ?? undefined : undefined;
  const me = await prisma.user.findFirst({ where: { clerkUserId: params.clerkUserId }, select: { id: true } });
  const configs = competition
    ? [getTsfLeagueConfig(competition)!]
    : enabledTsfCompetitions(params.allLeagues ? undefined : tournament);
  const scopes = configs.map((cfg) => tsfScopeKey(cfg));
  const gameweekIds =
    params.period === 'week'
      ? (await Promise.all(configs.map((cfg) => ensureTsfGameweek(cfg.key)))).map((gw) => gw.id)
      : null;

  const weekIds = new Set(gameweekIds ?? []);
  const scores = await attributeTsfPoints(scopes, weekIds);
  const byUser = new Map<string, number>();
  const firstPick = new Map<string, number>();
  for (const [userId, leagues] of scores) {
    let xp = 0;
    let first = Number.POSITIVE_INFINITY;
    for (const value of leagues.values()) {
      xp += params.period === 'week' ? value.week : value.total;
      if (value.firstAt < first) first = value.firstAt;
    }
    if (params.period === 'week' && xp <= 0) continue;
    byUser.set(userId, xp);
    firstPick.set(userId, Number.isFinite(first) ? first : 0);
  }

  const ranked = [...byUser.entries()]
    .map(([userId, xp]) => ({ userId, xp }))
    .sort((a, b) => b.xp - a.xp || (firstPick.get(a.userId) ?? 0) - (firstPick.get(b.userId) ?? 0));

  const meXp = me ? (byUser.get(me.id) ?? 0) : 0;
  const meRank = me && byUser.has(me.id) ? ranked.findIndex((row) => row.userId === me.id) + 1 : null;

  const top = ranked.slice(0, params.limit);
  const users = await prisma.user.findMany({
    where: { id: { in: top.map((row) => row.userId) } },
    select: { id: true, username: true, displayName: true, avatar: true, isVerified: true, isDeveloper: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const { identityFor, loadFeaturedBadges } = await import('./elite-badge.service');
  const badges = await loadFeaturedBadges(users.map((user) => user.id));
  const entries = top.flatMap((row, index) => {
    const user = usersById.get(row.userId);
    if (!user) return [];
    return [{
      rank: index + 1,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isVerified: user.isVerified,
      isDeveloper: user.isDeveloper,
      xp: row.xp,
      identity: identityFor(user, badges),
    }];
  });

  return { period: params.period, entries, me: me ? { rank: meRank, xp: meXp, userId: me.id } : null };
}

// ─── Fixtures (matches tab) ─────────────────────────────────────────────────

type TsfTeamRef = { id: number; name: string; logo: string | null };

export type TsfUpcomingFixtureDto = {
  fixtureId: number;
  kickoff: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
  home: TsfTeamRef;
  away: TsfTeamRef;
};

type RelevantFixture = {
  fixtureId: number;
  kickoffAt: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
  /** Stats stored (or the fixture voided) — it will not change any more. */
  processed: boolean;
  home: TsfTeamRef;
  away: TsfTeamRef;
  season: number | null;
};

const FIXTURE_SELECT = {
  fixtureId: true, matchDate: true, status: true, leagueSeason: true,
  homeTeamId: true, homeTeamName: true, homeTeamLogo: true,
  awayTeamId: true, awayTeamName: true, awayTeamLogo: true,
  homeScore: true, awayScore: true, elapsed: true,
} as const;

const LIVE_OR_FINISHED = new Set([
  '1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT', 'FT', 'AET', 'PEN',
]);

/** Prefer a live/finished cache status over a stale stored `NS`. */
function preferFixtureStatus(
  cached: string | null | undefined,
  stored: string | null | undefined,
  processed: boolean,
): string {
  const cache = String(cached ?? '').toUpperCase();
  const store = String(stored ?? '').toUpperCase();
  if (processed && store) return stored!;
  if (LIVE_OR_FINISHED.has(cache) || isTsfFinishedStatus(cache) || isTsfVoidStatus(cache)) {
    return cached!;
  }
  if (LIVE_OR_FINISHED.has(store) || isTsfFinishedStatus(store) || isTsfVoidStatus(store)) {
    return stored!;
  }
  return cached || stored || 'NS';
}

const TEAM_NAMES_UPSTREAM_BUDGET_MS = 2_500;

function resolveAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms).unref());
}

/**
 * Club names in the reader's language. The fixture cache holds a single
 * language, so the pool's bilingual club names come first; clubs outside the
 * pool fall back to the league's fixture list in that language, which sits in
 * the shared Redis cache — one read per league and language, not per user.
 */
async function tsfTeamNames(
  cfg: TsfLeagueConfig,
  teamIds: number[],
  language: TsfLanguage,
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  const ids = [...new Set(teamIds)];
  if (ids.length === 0) return names;

  const clubs = await prisma.topScorersFivePlayer.findMany({
    where: { leagueKey: tsfPoolKey(cfg), teamId: { in: ids } },
    select: { teamId: true, clubNameAr: true, clubNameEn: true },
  });
  for (const club of clubs) {
    if (club.teamId == null || names.has(club.teamId)) continue;
    const name = language === 'en' ? club.clubNameEn : club.clubNameAr;
    if (name) names.set(club.teamId, name);
  }
  if (ids.every((id) => names.has(id))) return names;

  const upstream = await Promise.race([
    threeSixFiveScoresService.getFixtures(cfg.scores365CompetitionId, language).catch(() => null),
    resolveAfter(TEAM_NAMES_UPSTREAM_BUDGET_MS, null),
  ]);
  for (const item of upstream?.data ?? []) {
    for (const side of [item.raw.homeCompetitor, item.raw.awayCompetitor]) {
      if (side?.id != null && side.name && !names.has(side.id)) names.set(side.id, side.name);
    }
  }
  return names;
}

function withTeamNames<T extends { home: TsfTeamRef; away: TsfTeamRef }>(row: T, names: Map<number, string>): T {
  return {
    ...row,
    home: { ...row.home, name: names.get(row.home.id) ?? row.home.name },
    away: { ...row.away, name: names.get(row.away.id) ?? row.away.name },
  };
}

function teamIdsIn(rows: Array<{ home: TsfTeamRef; away: TsfTeamRef }>): number[] {
  return rows.flatMap((row) => [row.home.id, row.away.id]);
}

/**
 * The gameweek's fixtures for these clubs: the shared fixture cache (kept fresh
 * by the live pipeline) merged with the fixtures the scoring job has stored for
 * the week, whose `processedAt` says the stats are in. Nothing upstream is called.
 */
async function tsfRelevantFixtures(
  cfg: TsfLeagueConfig,
  gameweek: TopScorersFiveGameweek,
  teamIds: number[],
): Promise<RelevantFixture[]> {
  if (teamIds.length === 0) return [];
  const clubs = [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }];
  const [cached, stored] = await Promise.all([
    prisma.cachedFixture.findMany({
      where: { leagueId: cfg.competitionLeagueId, matchDate: { gte: gameweek.startAt, lt: gameweek.endAt }, OR: clubs },
      select: FIXTURE_SELECT,
    }),
    prisma.topScorersFiveFixture.findMany({ where: { gameweekId: gameweek.id, OR: clubs } }),
  ]);

  const byId = new Map<number, RelevantFixture>();
  for (const row of cached) {
    byId.set(row.fixtureId, {
      fixtureId: row.fixtureId,
      kickoffAt: row.matchDate,
      status: row.status,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      elapsed: row.elapsed,
      processed: false,
      home: { id: row.homeTeamId, name: row.homeTeamName, logo: row.homeTeamLogo ?? COMPETITOR_LOGO(row.homeTeamId) },
      away: { id: row.awayTeamId, name: row.awayTeamName, logo: row.awayTeamLogo ?? COMPETITOR_LOGO(row.awayTeamId) },
      season: row.leagueSeason ?? null,
    });
  }
  for (const row of stored) {
    const base = byId.get(row.fixtureId);
    const processed = row.processedAt != null;
    byId.set(row.fixtureId, {
      fixtureId: row.fixtureId,
      kickoffAt: row.kickoffAt,
      status: preferFixtureStatus(base?.status, row.status, processed),
      homeScore: base?.homeScore ?? null,
      awayScore: base?.awayScore ?? null,
      elapsed: base?.elapsed ?? null,
      processed,
      home: base?.home ?? { id: row.homeTeamId, name: row.homeTeamName ?? '', logo: COMPETITOR_LOGO(row.homeTeamId) },
      away: base?.away ?? { id: row.awayTeamId, name: row.awayTeamName ?? '', logo: COMPETITOR_LOGO(row.awayTeamId) },
      season: base?.season ?? null,
    });
  }
  return [...byId.values()].sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
}

export type TsfLeagueFixtureDto = TsfUpcomingFixtureDto & {
  league: { key: string; id: number; name: string };
  season: number | null;
};

/**
 * The league's fixtures around the current window: recent results (3 days back)
 * through the next 7 days. Finished and live rows stay so the matches tab can
 * show score + status instead of looking unplayed.
 */
export async function listTsfUpcomingFixtures(
  leagueKey: string,
  language: TsfLanguage = 'ar',
  now: Date = new Date(),
): Promise<{ leagueKey: string; from: string; to: string; fixtures: TsfLeagueFixtureDto[] }> {
  const cfg = requireLeague(leagueKey);
  const { to } = tsfUpcomingWindow(now);
  const from = new Date(now.getTime() - 3 * 86_400_000);
  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: from, lt: to },
      status: { notIn: ['CANC', 'ABD', 'AWD', 'WO'] },
    },
    orderBy: { matchDate: 'asc' },
    select: { ...FIXTURE_SELECT, leagueName: true },
  });
  const fixtures = rows.map((row) => ({
    fixtureId: row.fixtureId,
    kickoff: row.matchDate.toISOString(),
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    elapsed: row.elapsed,
    home: { id: row.homeTeamId, name: row.homeTeamName, logo: row.homeTeamLogo ?? COMPETITOR_LOGO(row.homeTeamId) },
    away: { id: row.awayTeamId, name: row.awayTeamName, logo: row.awayTeamLogo ?? COMPETITOR_LOGO(row.awayTeamId) },
    league: { key: cfg.key, id: cfg.scores365CompetitionId, name: row.leagueName },
    season: row.leagueSeason ?? null,
  }));
  const names = await tsfTeamNames(cfg, teamIdsIn(fixtures), language);
  return {
    leagueKey: cfg.key,
    from: from.toISOString(),
    to: to.toISOString(),
    fixtures: fixtures.map((row) => withTeamNames(row, names)),
  };
}

type LeaguePick = {
  cfg: TsfLeagueConfig;
  gameweek: TopScorersFiveGameweek;
  selection: (SelectionWithPlayer & { id: string }) | null;
  fixtures: RelevantFixture[];
  state: TsfPickState;
  pickingOpen: boolean;
};

/** Every slot of the requested competitions, with the user's player and that slot's fixtures. */
async function tsfLeaguePicks(
  userId: string,
  now: Date = new Date(),
  tournament: TsfTournament = 'europe',
  competition?: string,
): Promise<LeaguePick[]> {
  const competitions = competition
    ? [getTsfLeagueConfig(competition)].filter((cfg): cfg is TsfLeagueConfig => cfg != null)
    : enabledTsfCompetitions(tournament);
  const groups = await Promise.all(competitions.map(async (comp) => {
    const gameweek = await ensureTsfGameweek(comp.key, now);
    const squad = await prisma.topScorersFiveSquad.findUnique({
      where: { userId_scopeKey: { userId, scopeKey: tsfScopeKey(comp) } },
    });
    const members = squad ? await openMembers(squad.id) : [];
    return Promise.all(tsfSlotKeys(tsfScopeKey(comp)).map(async (slotKey) => {
      const cfg = getTsfLeagueConfig(slotKey) ?? comp;
      const member = memberForSlot(members, slotKey);
      const player = member
        ? await prisma.topScorersFivePlayer.findUnique({ where: { id: member.playerId } })
        : null;
      const selection = member && player
        ? { id: member.id, playerId: member.playerId, confirmedAt: squad?.confirmedAt ?? null, updatedAt: member.selectedAt, player }
        : null;
      const fixtures = selection ? await tsfRelevantFixtures(cfg, gameweek, teamIdsOf([selection.player])) : [];
      const locked = member != null && isMemberEditLocked(member.lockedUntil, now);
      const state = tsfPickState({
        picked: selection != null,
        locked,
        now,
        windowEnd: gameweek.endAt,
        fixtures,
      });
      return { cfg, gameweek, selection, fixtures, state, pickingOpen: !locked };
    }));
  }));
  return groups.flat();
}

export type TsfMyFixtureDto = TsfUpcomingFixtureDto & {
  leagueKey: string;
  season: number | null;
  /** The final whistle has gone (or the match was voided). */
  finished: boolean;
  /** Stats are stored; the players' lines below are final. */
  processed: boolean;
  players: Array<{
    playerId: string;
    name: string;
    photo: string | null;
    teamId: number | null;
    /** From the final lineups once processed; null before. */
    participation: string | null;
    goals: number | null;
    assists: number | null;
    points: number | null;
  }>;
};

export type TsfMyFixturesDto = {
  state: TsfPickState;
  leagues: Array<{ leagueKey: string; state: TsfPickState; gameweek: TsfGameweekDto; playerId: string | null }>;
  fixtures: TsfMyFixtureDto[];
};

/**
 * The matches tab: only fixtures of the clubs the user picked, in each pick's
 * current gameweek, each with the picked players in it and — once the scoring
 * job has stored the match — their goals, assists, points and participation.
 */
export async function getTsfMyFixtures(
  clerkUserId: string,
  language: TsfLanguage,
  now: Date = new Date(),
  tournament: TsfTournament = 'europe',
  leagueKey?: string,
): Promise<TsfMyFixturesDto> {
  const userId = await requireUserId(clerkUserId);
  const competition = leagueKey ? tsfCompetitionKey(leagueKey) ?? undefined : undefined;
  const picks = await tsfLeaguePicks(userId, now, tournament, competition);

  const withPick = picks.filter((p): p is LeaguePick & { selection: NonNullable<LeaguePick['selection']> } => p.selection != null);
  const performances = withPick.length
    ? await prisma.topScorersFivePerformance.findMany({
        where: {
          OR: withPick.map((p) => ({ gameweekId: p.gameweek.id, playerId: p.selection.playerId })),
        },
        select: { gameweekId: true, playerId: true, fixtureId: true, goals: true, assists: true, points: true, participation: true },
      })
    : [];
  const perfKey = (gameweekId: string, playerId: string, fixtureId: number) => `${gameweekId}:${playerId}:${fixtureId}`;
  const perfByKey = new Map(performances.map((row) => [perfKey(row.gameweekId, row.playerId, row.fixtureId), row]));

  const namesByLeague = new Map(
    await Promise.all(
      withPick.map(async (pick) => [pick.cfg.key, await tsfTeamNames(pick.cfg, teamIdsIn(pick.fixtures), language)] as const),
    ),
  );

  const fixtures: TsfMyFixtureDto[] = [];
  for (const pick of withPick) {
    const player = pick.selection.player;
    const names = namesByLeague.get(pick.cfg.key) ?? new Map<number, string>();
    for (const rawFixture of pick.fixtures) {
      const fixture = withTeamNames(rawFixture, names);
      if (player.teamId !== fixture.home.id && player.teamId !== fixture.away.id) continue;
      const perf = perfByKey.get(perfKey(pick.gameweek.id, player.id, fixture.fixtureId));
      const final = fixture.processed;
      fixtures.push({
        fixtureId: fixture.fixtureId,
        leagueKey: tsfScopeKey(pick.cfg),
        kickoff: fixture.kickoffAt.toISOString(),
        status: fixture.status,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        elapsed: fixture.elapsed,
        season: fixture.season,
        home: fixture.home,
        away: fixture.away,
        finished: final || isTsfFinishedStatus(fixture.status) || isTsfVoidStatus(fixture.status),
        processed: final,
        players: [
          {
            playerId: player.id,
            name: language === 'en' ? (player.nameEn ?? player.nameAr) : player.nameAr,
            photo: player.externalPlayerId != null ? tsfPortraitUrl(player.externalPlayerId) : player.photoUrl,
            teamId: player.teamId,
            participation: final ? (perf?.participation ?? null) : null,
            goals: final ? (perf?.goals ?? 0) : null,
            assists: final ? (perf?.assists ?? 0) : null,
            points: final ? (perf?.points ?? 0) : null,
          },
        ],
      });
    }
  }

  // Two picks at the same club (or the two clubs of one match) share a row.
  const merged = new Map<number, TsfMyFixtureDto>();
  for (const row of fixtures) {
    const existing = merged.get(row.fixtureId);
    if (existing) existing.players.push(...row.players);
    else merged.set(row.fixtureId, row);
  }

  return {
    state: combineTsfPickStates(withPick.map((p) => p.state)),
    leagues: picks.map((p) => ({
      leagueKey: tsfScopeKey(p.cfg),
      state: p.state,
      gameweek: gameweekDto(p.gameweek, now, p.pickingOpen),
      playerId: p.selection?.playerId ?? null,
    })),
    fixtures: [...merged.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  };
}

/** The player's club's next league fixtures, straight from the fixture cache. */
export async function listTsfPlayerFixtures(
  playerId: string,
  language: TsfLanguage = 'ar',
  limit = 6,
): Promise<TsfUpcomingFixtureDto[]> {
  const player = await prisma.topScorersFivePlayer.findUnique({ where: { id: playerId } });
  if (!player) throw new TopScorersFiveError('PLAYER_NOT_FOUND', 'Player not found');
  const cfg = requireLeague(player.leagueKey);
  if (player.teamId == null) return [];

  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: new Date(Date.now() - 3 * 86_400_000) },
      status: { notIn: ['CANC', 'ABD', 'AWD', 'WO'] },
      OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
    },
    orderBy: { matchDate: 'asc' },
    take: limit,
    select: FIXTURE_SELECT,
  });
  const fixtures = rows.map((row) => ({
    fixtureId: row.fixtureId,
    kickoff: row.matchDate.toISOString(),
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    elapsed: row.elapsed,
    home: { id: row.homeTeamId, name: row.homeTeamName, logo: row.homeTeamLogo ?? null },
    away: { id: row.awayTeamId, name: row.awayTeamName, logo: row.awayTeamLogo ?? null },
  }));
  const names = await tsfTeamNames(cfg, teamIdsIn(fixtures), language);
  return fixtures.map((row) => withTeamNames(row, names));
}
