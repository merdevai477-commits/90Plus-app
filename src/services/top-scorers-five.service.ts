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
  enabledTsfLeagues,
  getTsfLeagueConfig,
  isTsfGameweekOpen,
  sumTsfPerformances,
  tsfGameweekWindow,
  type TsfLeagueConfig,
} from './top-scorers-five-scoring';

export type TsfErrorCode =
  | 'USER_NOT_FOUND'
  | 'LEAGUE_NOT_SUPPORTED'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ELIGIBLE'
  | 'PLAYER_UNRESOLVED'
  | 'GAMEWEEK_LOCKED';

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
 * user's pick from the league's previous week, so a pick stands until changed.
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
};

function playerDto(
  player: TopScorersFivePlayer,
  language: TsfLanguage,
  totals: { goals: number; assists: number; points: number } = { goals: 0, assists: 0, points: 0 },
): TsfPlayerDto {
  return {
    id: player.id,
    name: language === 'en' ? (player.nameEn ?? player.nameAr) : player.nameAr,
    nameAr: player.nameAr,
    nameEn: player.nameEn,
    club: language === 'en' ? (player.clubNameEn ?? player.clubNameAr) : player.clubNameAr,
    teamId: player.teamId,
    teamLogo: player.teamId ? COMPETITOR_LOGO(player.teamId) : null,
    photo: player.photoUrl,
    position: player.position,
    externalPlayerId: player.externalPlayerId,
    ...totals,
  };
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
  const totals = await playerTotals(players.map((p) => p.id));
  return players.map((player) => playerDto(player, language, totals.get(player.id)));
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
  selection: null | {
    player: TsfPlayerDto;
    /** D. The pick's score this gameweek, from finished fixtures only. */
    score: { goals: number; assists: number; points: number; fixtures: TsfFixtureScoreDto[] };
    updatedAt: string;
  };
};

async function selectionDto(
  gameweek: TopScorersFiveGameweek,
  selection: { playerId: string; updatedAt: Date; player: TopScorersFivePlayer } | null,
  language: TsfLanguage,
): Promise<TsfSelectionDto> {
  if (!selection) return { leagueKey: gameweek.leagueKey, gameweek: gameweekDto(gameweek), selection: null };

  const performances = await prisma.topScorersFivePerformance.findMany({
    where: { gameweekId: gameweek.id, playerId: selection.playerId },
    orderBy: { fixtureDate: 'asc' },
    select: { fixtureId: true, fixtureDate: true, goals: true, assists: true, points: true },
  });
  const totals = await playerTotals([selection.playerId]);
  return {
    leagueKey: gameweek.leagueKey,
    gameweek: gameweekDto(gameweek),
    selection: {
      player: playerDto(selection.player, language, totals.get(selection.playerId)),
      score: {
        ...sumTsfPerformances(performances),
        fixtures: performances.map((row) => ({ ...row, fixtureDate: row.fixtureDate.toISOString() })),
      },
      updatedAt: selection.updatedAt.toISOString(),
    },
  };
}

/** B + D. The signed-in user's pick for the league's current gameweek. */
export async function getTsfSelection(clerkUserId: string, leagueKey: string, language: TsfLanguage): Promise<TsfSelectionDto> {
  const userId = await requireUserId(clerkUserId);
  const gameweek = await ensureTsfGameweek(leagueKey);
  const selection = await prisma.topScorersFiveSelection.findUnique({
    where: { userId_gameweekId_leagueKey: { userId, gameweekId: gameweek.id, leagueKey: gameweek.leagueKey } },
    include: { player: true },
  });
  return selectionDto(gameweek, selection, language);
}

/** C. Pick or change the league's player while the gameweek is open. */
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
  if (!isTsfGameweekOpen(gameweek, now)) {
    throw new TopScorersFiveError('GAMEWEEK_LOCKED', 'Picks are locked for this gameweek');
  }

  const selection = await prisma.topScorersFiveSelection.upsert({
    where: { userId_gameweekId_leagueKey: { userId, gameweekId: gameweek.id, leagueKey: cfg.key } },
    create: { userId, gameweekId: gameweek.id, leagueKey: cfg.key, playerId: player.id },
    update: { playerId: player.id },
    include: { player: true },
  });
  return selectionDto(gameweek, selection, language);
}

/** Drop the league's pick while the gameweek is open (the pitch card's ✕). */
export async function clearTsfSelection(clerkUserId: string, leagueKey: string, now: Date = new Date()): Promise<void> {
  const userId = await requireUserId(clerkUserId);
  const gameweek = await ensureTsfGameweek(leagueKey, now);
  if (!isTsfGameweekOpen(gameweek, now)) {
    throw new TopScorersFiveError('GAMEWEEK_LOCKED', 'Picks are locked for this gameweek');
  }
  await prisma.topScorersFiveSelection.deleteMany({
    where: { userId, gameweekId: gameweek.id, leagueKey: gameweek.leagueKey },
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
  week: number;
  leagues: Array<{ leagueKey: string; total: number; week: number }>;
};

/** E. The user's competition score: all leagues, all gameweeks (and this week). */
export async function getTsfUserScore(clerkUserId: string): Promise<TsfUserScoreDto> {
  const userId = await requireUserId(clerkUserId);
  const currentIds = new Set(
    (await Promise.all(enabledTsfLeagues().map((cfg) => ensureTsfGameweek(cfg.key)))).map((gw) => gw.id),
  );
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
  const list = [...leagues.entries()].map(([leagueKey, v]) => ({ leagueKey, ...v }));
  return {
    total: list.reduce((sum, l) => sum + l.total, 0),
    week: list.reduce((sum, l) => sum + l.week, 0),
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

export type TsfUpcomingFixtureDto = {
  fixtureId: number;
  kickoff: string;
  status: string;
  home: { id: number; name: string; logo: string | null };
  away: { id: number; name: string; logo: string | null };
};

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
