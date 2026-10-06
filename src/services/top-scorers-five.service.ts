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
  enabledTsfLeagues,
  getTsfLeagueConfig,
  isTsfFinishedStatus,
  isTsfGameweekOpen,
  isTsfSelectionLocked,
  isTsfVoidStatus,
  sumTsfPerformances,
  tsfGameweekWindow,
  tsfPickState,
  tsfPortraitUrl,
  tsfUpcomingWindow,
  type TsfLeagueConfig,
  type TsfPickState,
} from './top-scorers-five-scoring';
import { threeSixFiveScoresService } from './threeSixFiveScores.service';

export type TsfErrorCode =
  | 'USER_NOT_FOUND'
  | 'LEAGUE_NOT_SUPPORTED'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ELIGIBLE'
  | 'PLAYER_UNRESOLVED'
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
 * The gameweek `now` falls in, created on first use. A new week inherits each
 * user's pick from the league's previous week, unconfirmed, so the pick stands
 * until the user confirms it or a new one. Only the pick carries over: points
 * are per (gameweek, player, fixture) and start from zero.
 */
export async function ensureTsfGameweek(leagueKey: string, now: Date = new Date()): Promise<TopScorersFiveGameweek> {
  const cfg = requireLeague(leagueKey);
  const window = tsfGameweekWindow(now);
  const existing = await prisma.topScorersFiveGameweek.findUnique({
    where: { leagueKey_weekKey: { leagueKey: cfg.key, weekKey: window.weekKey } },
  });
  if (existing) return existing;

  const lockAt = await computeTsfLockAt(cfg, window);
  try {
    const created = await prisma.topScorersFiveGameweek.create({
      data: { leagueKey: cfg.key, weekKey: window.weekKey, startAt: window.startAt, endAt: window.endAt, lockAt },
    });
    await carryOverTsfSelections(created);
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.topScorersFiveGameweek.findUniqueOrThrow({
        where: { leagueKey_weekKey: { leagueKey: cfg.key, weekKey: window.weekKey } },
      });
    }
    throw error;
  }
}

async function carryOverTsfSelections(gameweek: TopScorersFiveGameweek): Promise<void> {
  const previous = await prisma.topScorersFiveGameweek.findFirst({
    where: { leagueKey: gameweek.leagueKey, startAt: { lt: gameweek.startAt } },
    orderBy: { startAt: 'desc' },
    select: { id: true },
  });
  if (!previous) return;
  const picks = await prisma.topScorersFiveSelection.findMany({
    where: { gameweekId: previous.id, player: { active: true } },
    select: { userId: true, playerId: true },
  });
  if (picks.length === 0) return;
  const { count } = await prisma.topScorersFiveSelection.createMany({
    data: picks.map((pick) => ({
      userId: pick.userId,
      playerId: pick.playerId,
      gameweekId: gameweek.id,
      leagueKey: gameweek.leagueKey,
    })),
    skipDuplicates: true,
  });
  logger.info(`[TopScorersFive] ${gameweek.leagueKey} ${gameweek.weekKey}: carried over ${count} pick(s)`);
}

export type TsfGameweekDto = {
  id: string;
  weekKey: string;
  startAt: string;
  endAt: string;
  lockAt: string;
  status: TopScorersFiveGameweek['status'];
  locked: boolean;
};

function gameweekDto(gameweek: TopScorersFiveGameweek, now: Date = new Date()): TsfGameweekDto {
  return {
    id: gameweek.id,
    weekKey: gameweek.weekKey,
    startAt: gameweek.startAt.toISOString(),
    endAt: gameweek.endAt.toISOString(),
    lockAt: gameweek.lockAt.toISOString(),
    status: gameweek.status,
    locked: !isTsfGameweekOpen(gameweek, now),
  };
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

/** A. The league's selectable players — resolved, active pool entries only. */
export async function listTsfEligiblePlayers(leagueKey: string, language: TsfLanguage): Promise<TsfPlayerDto[]> {
  const cfg = requireLeague(leagueKey);
  const players = await prisma.topScorersFivePlayer.findMany({
    where: { leagueKey: cfg.key, active: true, externalPlayerId: { not: null } },
    orderBy: { sortOrder: 'asc' },
  });
  const [totals, season] = await Promise.all([
    playerTotals(players.map((p) => p.id)),
    tsfSeasonStats(cfg, teamIdsOf(players)),
  ]);
  return players.map((player) => playerDto(player, language, totals.get(player.id), season));
}

// ─── Selection ──────────────────────────────────────────────────────────────

export type TsfFixtureScoreDto = {
  fixtureId: number;
  fixtureDate: string;
  goals: number;
  assists: number;
  points: number;
};

export type TsfSelectionDto = {
  leagueKey: string;
  gameweek: TsfGameweekDto;
  /** Where this league's pick stands (see `tsfPickState`). */
  state: TsfPickState;
  selection: null | {
    player: TsfPlayerDto;
    /** D. The pick's score this gameweek, from finished fixtures only. */
    score: { goals: number; assists: number; points: number; fixtures: TsfFixtureScoreDto[] };
    /** The user confirmed this pick; it is final for the gameweek. */
    confirmed: boolean;
    confirmedAt: string | null;
    /** Cannot be changed or removed any more (confirmed, or the gameweek is closed). */
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
): Promise<TsfSelectionDto> {
  const cfg = getTsfLeagueConfig(gameweek.leagueKey);
  if (!selection) {
    return { leagueKey: gameweek.leagueKey, gameweek: gameweekDto(gameweek, now), state: 'PICKING', selection: null };
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
  const locked = isTsfSelectionLocked(selection, gameweek, now);
  return {
    leagueKey: gameweek.leagueKey,
    gameweek: gameweekDto(gameweek, now),
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

function selectionKey(userId: string, gameweek: TopScorersFiveGameweek) {
  return { userId_gameweekId_leagueKey: { userId, gameweekId: gameweek.id, leagueKey: gameweek.leagueKey } };
}

/** B + D. The signed-in user's pick for the league's current gameweek. */
export async function getTsfSelection(clerkUserId: string, leagueKey: string, language: TsfLanguage): Promise<TsfSelectionDto> {
  const userId = await requireUserId(clerkUserId);
  const gameweek = await ensureTsfGameweek(leagueKey);
  const selection = await prisma.topScorersFiveSelection.findUnique({
    where: selectionKey(userId, gameweek),
    include: { player: true },
  });
  return selectionDto(gameweek, selection, language);
}

/**
 * C. Confirm the league's player for the current gameweek. Confirming is final:
 * once a pick is confirmed, any other player is refused with
 * GAMEWEEK_PICK_LOCKED until the next gameweek (re-sending the same player is a
 * no-op). A carried-over pick that was never confirmed can be confirmed or
 * replaced once, while the gameweek is open. The confirm itself is a
 * conditional write, so two racing requests cannot both win.
 */
export async function saveTsfSelection(
  clerkUserId: string,
  leagueKey: string,
  playerId: string,
  language: TsfLanguage,
  now: Date = new Date(),
): Promise<TsfSelectionDto> {
  const userId = await requireUserId(clerkUserId);
  const cfg = requireLeague(leagueKey);
  const player = await prisma.topScorersFivePlayer.findUnique({ where: { id: playerId } });
  if (!player) throw new TopScorersFiveError('PLAYER_NOT_FOUND', 'Player not found');
  if (player.leagueKey !== cfg.key || !player.active) {
    throw new TopScorersFiveError('PLAYER_NOT_ELIGIBLE', 'Player is not eligible for this league');
  }
  if (player.externalPlayerId == null) {
    throw new TopScorersFiveError('PLAYER_UNRESOLVED', 'Player is not linked to match data yet');
  }

  const gameweek = await ensureTsfGameweek(cfg.key, now);
  const where = selectionKey(userId, gameweek);
  const settled = async (): Promise<TsfSelectionDto> => {
    const current = await prisma.topScorersFiveSelection.findUnique({ where, include: { player: true } });
    if (current?.confirmedAt && current.playerId === player.id) return selectionDto(gameweek, current, language, now);
    throw new TopScorersFiveError('GAMEWEEK_PICK_LOCKED', 'Your pick is confirmed for this gameweek');
  };

  const existing = await prisma.topScorersFiveSelection.findUnique({ where, include: { player: true } });
  if (existing?.confirmedAt) return settled();
  if (!isTsfGameweekOpen(gameweek, now)) {
    throw new TopScorersFiveError('GAMEWEEK_LOCKED', 'Picks are locked for this gameweek');
  }

  if (existing) {
    const { count } = await prisma.topScorersFiveSelection.updateMany({
      where: { userId, gameweekId: gameweek.id, leagueKey: cfg.key, confirmedAt: null },
      data: { playerId: player.id, confirmedAt: now },
    });
    if (count === 0) return settled();
  } else {
    try {
      await prisma.topScorersFiveSelection.create({
        data: { userId, gameweekId: gameweek.id, leagueKey: cfg.key, playerId: player.id, confirmedAt: now },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return settled();
      throw error;
    }
  }
  return settled();
}

/**
 * Drop the league's pick (the pitch card's ✕). Only an unconfirmed,
 * carried-over pick can be dropped, and only while the gameweek is open.
 */
export async function clearTsfSelection(clerkUserId: string, leagueKey: string, now: Date = new Date()): Promise<void> {
  const userId = await requireUserId(clerkUserId);
  const gameweek = await ensureTsfGameweek(leagueKey, now);
  const existing = await prisma.topScorersFiveSelection.findUnique({ where: selectionKey(userId, gameweek) });
  if (existing?.confirmedAt) {
    throw new TopScorersFiveError('GAMEWEEK_PICK_LOCKED', 'Your pick is confirmed for this gameweek');
  }
  if (!isTsfGameweekOpen(gameweek, now)) {
    throw new TopScorersFiveError('GAMEWEEK_LOCKED', 'Picks are locked for this gameweek');
  }
  await prisma.topScorersFiveSelection.deleteMany({
    where: { userId, gameweekId: gameweek.id, leagueKey: gameweek.leagueKey, confirmedAt: null },
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

/** E. The user's competition score: all leagues, all gameweeks (and this week). */
export async function getTsfUserScore(clerkUserId: string): Promise<TsfUserScoreDto> {
  const userId = await requireUserId(clerkUserId);
  const leaguePicks = await tsfLeaguePicks(userId);
  const currentIds = new Set(leaguePicks.map((p) => p.gameweek.id));
  const stateByLeague = new Map(leaguePicks.map((p) => [p.cfg.key as string, p.state]));
  const picks = await prisma.topScorersFiveSelection.findMany({
    where: { userId },
    select: { userId: true, gameweekId: true, playerId: true, leagueKey: true },
  });
  const points = await pointsByGameweekPlayer(picks);

  const leagues = new Map<string, { total: number; week: number }>();
  for (const pick of picks) {
    const value = points.get(`${pick.gameweekId}:${pick.playerId}`) ?? 0;
    const entry = leagues.get(pick.leagueKey) ?? { total: 0, week: 0 };
    entry.total += value;
    if (currentIds.has(pick.gameweekId)) entry.week += value;
    leagues.set(pick.leagueKey, entry);
  }
  const list = [...leagues.entries()].map(([leagueKey, v]) => ({
    leagueKey,
    ...v,
    state: stateByLeague.get(leagueKey) ?? ('PICKING' as TsfPickState),
  }));
  return {
    total: list.reduce((sum, l) => sum + l.total, 0),
    week: list.reduce((sum, l) => sum + l.week, 0),
    state: combineTsfPickStates(leaguePicks.filter((p) => p.selection != null).map((p) => p.state)),
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
}): Promise<TsfLeaderboardDto> {
  const me = await prisma.user.findFirst({ where: { clerkUserId: params.clerkUserId }, select: { id: true } });
  const gameweekIds =
    params.period === 'week'
      ? (await Promise.all(enabledTsfLeagues().map((cfg) => ensureTsfGameweek(cfg.key)))).map((gw) => gw.id)
      : null;

  const picks = await prisma.topScorersFiveSelection.findMany({
    where: gameweekIds ? { gameweekId: { in: gameweekIds } } : {},
    select: { userId: true, gameweekId: true, playerId: true, leagueKey: true, createdAt: true },
  });
  const firstPick = new Map<string, number>();
  for (const pick of picks) {
    const at = pick.createdAt.getTime();
    if (!firstPick.has(pick.userId) || at < (firstPick.get(pick.userId) ?? at)) firstPick.set(pick.userId, at);
  }
  const byUser = scoreTsfPicks(picks, await pointsByGameweekPlayer(picks));

  const ranked = [...byUser.entries()]
    .map(([userId, xp]) => ({ userId, xp }))
    .sort((a, b) => b.xp - a.xp || (firstPick.get(a.userId) ?? 0) - (firstPick.get(b.userId) ?? 0));

  const meXp = me ? (byUser.get(me.id) ?? 0) : 0;
  const meRank = me && byUser.has(me.id) ? ranked.findIndex((row) => row.userId === me.id) + 1 : null;

  const top = ranked.slice(0, params.limit);
  const users = await prisma.user.findMany({
    where: { id: { in: top.map((row) => row.userId) } },
    select: { id: true, username: true, displayName: true, avatar: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const entries = top.flatMap((row, index) => {
    const user = usersById.get(row.userId);
    if (!user) return [];
    return [{ rank: index + 1, userId: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, xp: row.xp }];
  });

  return { period: params.period, entries, me: me ? { rank: meRank, xp: meXp, userId: me.id } : null };
}

// ─── Fixtures (matches tab) ─────────────────────────────────────────────────

type TsfTeamRef = { id: number; name: string; logo: string | null };

export type TsfUpcomingFixtureDto = {
  fixtureId: number;
  kickoff: string;
  status: string;
  home: TsfTeamRef;
  away: TsfTeamRef;
};

type RelevantFixture = {
  fixtureId: number;
  kickoffAt: Date;
  status: string;
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
} as const;

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
      status: processed ? row.status : (base?.status ?? row.status),
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
 * The league's fixtures kicking off in the next 7 days (now → now + 7 × 24h,
 * UTC instants), from the shared fixture cache.
 */
export async function listTsfUpcomingFixtures(
  leagueKey: string,
  now: Date = new Date(),
): Promise<{ leagueKey: string; from: string; to: string; fixtures: TsfLeagueFixtureDto[] }> {
  const cfg = requireLeague(leagueKey);
  const { from, to } = tsfUpcomingWindow(now);
  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: from, lt: to },
      status: { notIn: ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'] },
    },
    orderBy: { matchDate: 'asc' },
    select: { ...FIXTURE_SELECT, leagueName: true },
  });
  return {
    leagueKey: cfg.key,
    from: from.toISOString(),
    to: to.toISOString(),
    fixtures: rows.map((row) => ({
      fixtureId: row.fixtureId,
      kickoff: row.matchDate.toISOString(),
      status: row.status,
      home: { id: row.homeTeamId, name: row.homeTeamName, logo: row.homeTeamLogo ?? COMPETITOR_LOGO(row.homeTeamId) },
      away: { id: row.awayTeamId, name: row.awayTeamName, logo: row.awayTeamLogo ?? COMPETITOR_LOGO(row.awayTeamId) },
      league: { key: cfg.key, id: cfg.scores365CompetitionId, name: row.leagueName },
      season: row.leagueSeason ?? null,
    })),
  };
}

type LeaguePick = {
  cfg: TsfLeagueConfig;
  gameweek: TopScorersFiveGameweek;
  selection: (SelectionWithPlayer & { id: string }) | null;
  fixtures: RelevantFixture[];
  state: TsfPickState;
};

/** Every enabled league's current gameweek with the user's pick, its fixtures and state. */
async function tsfLeaguePicks(userId: string, now: Date = new Date()): Promise<LeaguePick[]> {
  return Promise.all(
    enabledTsfLeagues().map(async (cfg) => {
      const gameweek = await ensureTsfGameweek(cfg.key, now);
      const selection = await prisma.topScorersFiveSelection.findUnique({
        where: selectionKey(userId, gameweek),
        include: { player: true },
      });
      const fixtures = selection ? await tsfRelevantFixtures(cfg, gameweek, teamIdsOf([selection.player])) : [];
      const state = tsfPickState({
        picked: selection != null,
        locked: isTsfSelectionLocked(selection, gameweek, now),
        now,
        windowEnd: gameweek.endAt,
        fixtures,
      });
      return { cfg, gameweek, selection, fixtures, state };
    }),
  );
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
export async function getTsfMyFixtures(clerkUserId: string, language: TsfLanguage, now: Date = new Date()): Promise<TsfMyFixturesDto> {
  const userId = await requireUserId(clerkUserId);
  const picks = await tsfLeaguePicks(userId, now);

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

  const fixtures: TsfMyFixtureDto[] = [];
  for (const pick of withPick) {
    const player = pick.selection.player;
    for (const fixture of pick.fixtures) {
      if (player.teamId !== fixture.home.id && player.teamId !== fixture.away.id) continue;
      const perf = perfByKey.get(perfKey(pick.gameweek.id, player.id, fixture.fixtureId));
      const final = fixture.processed;
      fixtures.push({
        fixtureId: fixture.fixtureId,
        leagueKey: pick.cfg.key,
        kickoff: fixture.kickoffAt.toISOString(),
        status: fixture.status,
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
      leagueKey: p.cfg.key,
      state: p.state,
      gameweek: gameweekDto(p.gameweek, now),
      playerId: p.selection?.playerId ?? null,
    })),
    fixtures: [...merged.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  };
}

/** The player's club's next league fixtures, straight from the fixture cache. */
export async function listTsfPlayerFixtures(playerId: string, limit = 6): Promise<TsfUpcomingFixtureDto[]> {
  const player = await prisma.topScorersFivePlayer.findUnique({ where: { id: playerId } });
  if (!player) throw new TopScorersFiveError('PLAYER_NOT_FOUND', 'Player not found');
  const cfg = requireLeague(player.leagueKey);
  if (player.teamId == null) return [];

  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: cfg.competitionLeagueId,
      matchDate: { gte: new Date(Date.now() - 3 * 3_600_000) },
      status: { notIn: ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'] },
      OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
    },
    orderBy: { matchDate: 'asc' },
    take: limit,
    select: {
      fixtureId: true, matchDate: true, status: true,
      homeTeamId: true, homeTeamName: true, homeTeamLogo: true,
      awayTeamId: true, awayTeamName: true, awayTeamLogo: true,
    },
  });
  return rows.map((row) => ({
    fixtureId: row.fixtureId,
    kickoff: row.matchDate.toISOString(),
    status: row.status,
    home: { id: row.homeTeamId, name: row.homeTeamName, logo: row.homeTeamLogo ?? null },
    away: { id: row.awayTeamId, name: row.awayTeamName, logo: row.awayTeamLogo ?? null },
  }));
}
