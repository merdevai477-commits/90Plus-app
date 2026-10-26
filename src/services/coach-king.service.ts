/**
 * King of Coaches — wallet, weekly squad, and the points leaderboard.
 * Scoring reads stored performances only. The pool and the match job live
 * next to this file.
 */

import fs from 'fs';
import path from 'path';
import { Prisma, type CoachKingGameweek } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  CK_START_BALANCE_MILLI,
  coachKingRemainingMilli,
  coachKingSlot,
  formatCoachKingMoney,
  inspectCoachKingSquad,
  type CkLine,
  type CkSquadIssue,
} from './coach-king-scoring';
import {
  TSF_EUROPE_LEAGUE_KEYS,
  TSF_LEAGUES,
  isTsfFixtureNotStarted,
  tsfGameweekWindow,
  tsfPortraitUrl,
} from './top-scorers-five-scoring';
import { ensureCoachKingPool } from './coach-king-pool.service';

export type CkErrorCode = CkSquadIssue | 'USER_NOT_FOUND' | 'SQUAD_LOCKED' | 'PLAYER_NOT_FOUND' | 'COACH_NOT_FOUND';

export class CoachKingError extends Error {
  constructor(public readonly code: CkErrorCode, message: string) {
    super(message);
    this.name = 'CoachKingError';
  }
}

export type CkLanguage = 'ar' | 'en';

const LOGO = (teamId: number) =>
  `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v3/Competitors/${teamId}`;

const MIGRATION_FILE = path.join(process.cwd(), 'prisma/migrations/20261026030000_coach_king/migration.sql');

function migrationStatements(sql: string): string[] {
  const body = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return body
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((statement) => {
      if (statement.startsWith('CREATE TYPE ')) {
        return `DO $$ BEGIN ${statement}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
      }
      if (statement.startsWith('CREATE TABLE ')) {
        return statement.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ');
      }
      if (statement.startsWith('CREATE UNIQUE INDEX ')) {
        return statement.replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ');
      }
      if (statement.startsWith('CREATE INDEX ')) {
        return statement.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ');
      }
      if (statement.startsWith('ALTER TABLE ')) {
        return `DO $$ BEGIN ${statement}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
      }
      return statement;
    });
}

let schemaReady: Promise<void> | null = null;

/** Create the fantasy tables when this deploy's migration did not land. */
export function ensureCoachKingSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const rows = await prisma.$queryRawUnsafe<Array<{ reg: string | null }>>(
        `SELECT to_regclass('public.coach_king_players')::text AS reg`,
      );
      if (rows[0]?.reg) return;
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
      for (const statement of migrationStatements(sql)) {
        await prisma.$executeRawUnsafe(statement);
      }
      logger.info('[CoachKing] created missing fantasy tables');
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function warmCoachKingPool(): void {
  void ensureCoachKingPool().catch((error) => {
    logger.warn(`[CoachKing] pool sync failed: ${(error as Error)?.message}`);
  });
}

function europeLeagueIds(): number[] {
  return TSF_EUROPE_LEAGUE_KEYS.map((key) => TSF_LEAGUES[key]!.competitionLeagueId);
}

async function requireUser(clerkUserId: string) {
  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    select: { id: true, displayName: true, username: true, avatar: true, level: true },
  });
  if (!user) throw new CoachKingError('USER_NOT_FOUND', 'User not found');
  return user;
}

async function ensureWallet(userId: string) {
  return prisma.coachKingWallet.upsert({
    where: { userId },
    create: { userId, balanceMilli: CK_START_BALANCE_MILLI },
    update: {},
  });
}

export async function ensureCoachKingGameweek(now: Date = new Date()): Promise<CoachKingGameweek> {
  const window = tsfGameweekWindow(now);
  const existing = await prisma.coachKingGameweek.findUnique({ where: { weekKey: window.weekKey } });
  if (existing) return existing;

  const first = await prisma.cachedFixture.findFirst({
    where: {
      leagueId: { in: europeLeagueIds() },
      matchDate: { gte: window.startAt, lt: window.endAt },
      status: { notIn: ['PST', 'CANC', 'ABD', 'AWD', 'WO', 'TBD'] },
    },
    orderBy: { matchDate: 'asc' },
    select: { matchDate: true },
  });
  const lockAt = first?.matchDate ?? window.endAt;
  try {
    return await prisma.coachKingGameweek.create({
      data: { weekKey: window.weekKey, startAt: window.startAt, endAt: window.endAt, lockAt },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.coachKingGameweek.findUniqueOrThrow({ where: { weekKey: window.weekKey } });
    }
    throw error;
  }
}

function pickingOpen(gameweek: CoachKingGameweek, now: Date): boolean {
  if (now >= gameweek.endAt) return false;
  return gameweek.status !== 'CALCULATING' && gameweek.status !== 'COMPLETED';
}

async function startedTeamIds(teamIds: number[], gameweek: CoachKingGameweek, now: Date): Promise<Set<number>> {
  const ids = [...new Set(teamIds)];
  if (ids.length === 0) return new Set();
  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: { in: europeLeagueIds() },
      matchDate: { gte: gameweek.startAt, lt: gameweek.endAt },
      OR: [{ homeTeamId: { in: ids } }, { awayTeamId: { in: ids } }],
    },
    select: { homeTeamId: true, awayTeamId: true, matchDate: true, status: true },
  });
  const wanted = new Set(ids);
  const started = new Set<number>();
  for (const row of rows) {
    if (isTsfFixtureNotStarted({ kickoffAt: row.matchDate, status: row.status }, now)) continue;
    if (wanted.has(row.homeTeamId)) started.add(row.homeTeamId);
    if (wanted.has(row.awayTeamId)) started.add(row.awayTeamId);
  }
  return started;
}

function displayName(row: { nameAr: string; nameEn: string | null }, lang: CkLanguage): string {
  return lang === 'en' && row.nameEn ? row.nameEn : row.nameAr;
}

function clubName(row: { clubNameAr: string; clubNameEn: string | null }, lang: CkLanguage): string {
  return lang === 'en' && row.clubNameEn ? row.clubNameEn : row.clubNameAr;
}

type PlayerRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  clubNameAr: string;
  clubNameEn: string | null;
  teamId: number;
  photoUrl: string | null;
  position: string | null;
  line: CkLine;
  shirtNumber: number | null;
  priceMilli: number;
  externalPlayerId: number;
};

function playerDto(row: PlayerRow, lang: CkLanguage) {
  return {
    id: row.id,
    name: displayName(row, lang),
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    club: clubName(row, lang),
    teamId: row.teamId,
    teamLogo: LOGO(row.teamId),
    photo: row.photoUrl || tsfPortraitUrl(row.externalPlayerId),
    position: row.position,
    line: row.line,
    shirtNumber: row.shirtNumber,
    priceMilli: row.priceMilli,
    priceLabel: formatCoachKingMoney(row.priceMilli),
    externalPlayerId: row.externalPlayerId,
  };
}

function coachDto(row: {
  id: string;
  nameAr: string;
  nameEn: string | null;
  clubNameAr: string;
  clubNameEn: string | null;
  teamId: number;
  photoUrl: string | null;
  priceMilli: number;
}, lang: CkLanguage) {
  return {
    id: row.id,
    name: displayName(row, lang),
    club: clubName(row, lang),
    teamId: row.teamId,
    teamLogo: LOGO(row.teamId),
    photo: row.photoUrl,
    priceMilli: row.priceMilli,
    priceLabel: formatCoachKingMoney(row.priceMilli),
  };
}

async function pointsFor(gameweekId: string, playerIds: string[], coachId: string | null): Promise<number> {
  const [players, coach] = await Promise.all([
    playerIds.length
      ? prisma.coachKingPerformance.aggregate({
        where: { gameweekId, playerId: { in: playerIds } },
        _sum: { points: true },
      })
      : Promise.resolve({ _sum: { points: 0 } }),
    coachId
      ? prisma.coachKingCoachScore.aggregate({
        where: { gameweekId, coachId },
        _sum: { points: true },
      })
      : Promise.resolve({ _sum: { points: 0 } }),
  ]);
  return (players._sum.points ?? 0) + (coach._sum.points ?? 0);
}

export async function listCoachKingPlayers(line: string, lang: CkLanguage, query: string) {
  await ensureCoachKingSchema();
  const wanted = line.toUpperCase();
  if (!['GK', 'DEF', 'MID', 'FWD'].includes(wanted)) {
    throw new CoachKingError('BAD_SLOT', 'Line is not available');
  }
  if (await prisma.coachKingPlayer.count({ where: { line: wanted as CkLine, active: true } }) === 0) {
    await ensureCoachKingPool().catch((error) => {
      logger.warn(`[CoachKing] pool sync failed: ${(error as Error)?.message}`);
    });
  }
  const q = query.trim();
  const rows = await prisma.coachKingPlayer.findMany({
    where: {
      active: true,
      line: wanted as CkLine,
      ...(q
        ? { OR: [{ nameAr: { contains: q, mode: 'insensitive' } }, { nameEn: { contains: q, mode: 'insensitive' } }, { clubNameEn: { contains: q, mode: 'insensitive' } }, { clubNameAr: { contains: q, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: [{ priceMilli: 'desc' }, { nameAr: 'asc' }],
    take: 80,
  });
  return rows.map((row) => playerDto(row, lang));
}

export async function listCoachKingCoaches(lang: CkLanguage, query: string) {
  await ensureCoachKingSchema();
  if (await prisma.coachKingCoach.count({ where: { active: true } }) === 0) {
    await ensureCoachKingPool().catch((error) => {
      logger.warn(`[CoachKing] pool sync failed: ${(error as Error)?.message}`);
    });
  }
  const q = query.trim();
  const rows = await prisma.coachKingCoach.findMany({
    where: {
      active: true,
      ...(q
        ? { OR: [{ nameAr: { contains: q, mode: 'insensitive' } }, { nameEn: { contains: q, mode: 'insensitive' } }, { clubNameAr: { contains: q, mode: 'insensitive' } }, { clubNameEn: { contains: q, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: [{ priceMilli: 'desc' }, { nameAr: 'asc' }],
    take: 80,
  });
  return rows.map((row) => coachDto(row, lang));
}

async function loadSquad(userId: string, gameweekId: string) {
  return prisma.coachKingSquad.findUnique({
    where: { userId_gameweekId: { userId, gameweekId } },
    include: { coach: true, slots: { include: { player: true } } },
  });
}

export async function getCoachKingHome(clerkUserId: string, lang: CkLanguage, now: Date = new Date()) {
  await ensureCoachKingSchema();
  warmCoachKingPool();
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([
    ensureWallet(user.id),
    ensureCoachKingGameweek(now),
  ]);
  const squad = await loadSquad(user.id, gameweek.id);
  const spent = squad?.slots.reduce((sum, slot) => sum + slot.player.priceMilli, 0) ?? 0;
  const coachCost = squad?.coach?.priceMilli ?? 0;
  const reserved = squad?.confirmedAt ? squad.spentMilli : spent + coachCost;
  const playerIds = squad?.slots.map((slot) => slot.playerId) ?? [];
  const points = squad?.confirmedAt ? await pointsFor(gameweek.id, playerIds, squad.coachId) : 0;
  let rank: number | null = null;
  try {
    const board = await coachKingLeaderboard('all', 200);
    rank = board.find((row) => row.userId === user.id)?.rank ?? null;
  } catch (error) {
    logger.warn(`[CoachKing] rank skipped: ${(error as Error)?.message}`);
  }

  return {
    user: {
      displayName: user.displayName || user.username,
      avatar: user.avatar,
      level: user.level,
      rank,
    },
    wallet: {
      balanceMilli: wallet.balanceMilli,
      remainingMilli: coachKingRemainingMilli(wallet.balanceMilli, reserved),
      balanceLabel: formatCoachKingMoney(wallet.balanceMilli),
      remainingLabel: formatCoachKingMoney(coachKingRemainingMilli(wallet.balanceMilli, reserved)),
    },
    gameweek: {
      id: gameweek.id,
      weekKey: gameweek.weekKey,
      startAt: gameweek.startAt.toISOString(),
      endAt: gameweek.endAt.toISOString(),
      status: gameweek.status,
      locked: !pickingOpen(gameweek, now),
    },
    squad: {
      confirmed: squad?.confirmedAt != null,
      spentMilli: reserved,
      points,
      coach: squad?.coach ? coachDto(squad.coach, lang) : null,
      slots: (squad?.slots ?? []).map((slot) => ({
        slotKey: slot.slotKey,
        label: coachKingSlot(slot.slotKey)?.label ?? slot.slotKey,
        player: playerDto(slot.player, lang),
      })),
    },
  };
}

type DraftInput = { coachId: string | null; slots: Array<{ slotKey: string; playerId: string }> };

async function buildDraft(input: DraftInput, lang: CkLanguage) {
  const playerIds = [...new Set(input.slots.map((slot) => slot.playerId))];
  const players = playerIds.length
    ? await prisma.coachKingPlayer.findMany({ where: { id: { in: playerIds }, active: true } })
    : [];
  const byId = new Map(players.map((player) => [player.id, player]));
  const slots = input.slots.map((slot) => {
    const player = byId.get(slot.playerId);
    if (!player) throw new CoachKingError('PLAYER_NOT_FOUND', 'Player is not in the pool');
    return {
      slotKey: slot.slotKey,
      playerId: player.id,
      line: player.line,
      teamId: player.teamId,
      priceMilli: player.priceMilli,
      player,
    };
  });
  const coach = input.coachId
    ? await prisma.coachKingCoach.findFirst({ where: { id: input.coachId, active: true } })
    : null;
  if (input.coachId && !coach) throw new CoachKingError('COACH_NOT_FOUND', 'Coach is not in the pool');
  return { slots, coach, lang };
}

export async function saveCoachKingDraft(clerkUserId: string, input: DraftInput, lang: CkLanguage, now: Date = new Date()) {
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([ensureWallet(user.id), ensureCoachKingGameweek(now)]);
  if (!pickingOpen(gameweek, now)) throw new CoachKingError('SQUAD_LOCKED', 'This week is closed');
  const current = await loadSquad(user.id, gameweek.id);
  if (current?.confirmedAt) throw new CoachKingError('SQUAD_LOCKED', 'The lineup is already confirmed');

  const draft = await buildDraft(input, lang);
  const started = await startedTeamIds(
    [...draft.slots.map((slot) => slot.teamId), ...(draft.coach ? [draft.coach.teamId] : [])],
    gameweek,
    now,
  );
  const check = inspectCoachKingSquad({
    slots: draft.slots,
    coachPriceMilli: draft.coach?.priceMilli ?? null,
    coachTeamId: draft.coach?.teamId ?? null,
    balanceMilli: wallet.balanceMilli,
    startedTeamIds: started,
    requireComplete: false,
  });
  if (!check.ok) throw new CoachKingError(check.code, 'Lineup was rejected');

  await prisma.$transaction(async (tx) => {
    const squad = await tx.coachKingSquad.upsert({
      where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
      create: { userId: user.id, gameweekId: gameweek.id, coachId: draft.coach?.id ?? null, spentMilli: check.spentMilli },
      update: { coachId: draft.coach?.id ?? null, spentMilli: check.spentMilli },
    });
    await tx.coachKingSquadSlot.deleteMany({ where: { squadId: squad.id } });
    if (draft.slots.length) {
      await tx.coachKingSquadSlot.createMany({
        data: draft.slots.map((slot) => ({ squadId: squad.id, slotKey: slot.slotKey, playerId: slot.playerId })),
      });
    }
  });
  return getCoachKingHome(clerkUserId, lang, now);
}

export async function confirmCoachKingSquad(clerkUserId: string, lang: CkLanguage, now: Date = new Date()) {
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([ensureWallet(user.id), ensureCoachKingGameweek(now)]);
  if (!pickingOpen(gameweek, now)) throw new CoachKingError('SQUAD_LOCKED', 'This week is closed');
  const current = await loadSquad(user.id, gameweek.id);
  if (!current) throw new CoachKingError('INCOMPLETE', 'Pick the lineup first');
  if (current.confirmedAt) throw new CoachKingError('SQUAD_LOCKED', 'The lineup is already confirmed');

  const started = await startedTeamIds(
    [...current.slots.map((slot) => slot.player.teamId), ...(current.coach ? [current.coach.teamId] : [])],
    gameweek,
    now,
  );
  const check = inspectCoachKingSquad({
    slots: current.slots.map((slot) => ({
      slotKey: slot.slotKey,
      playerId: slot.playerId,
      line: slot.player.line,
      teamId: slot.player.teamId,
      priceMilli: slot.player.priceMilli,
    })),
    coachPriceMilli: current.coach?.priceMilli ?? null,
    coachTeamId: current.coach?.teamId ?? null,
    balanceMilli: wallet.balanceMilli,
    startedTeamIds: started,
    requireComplete: true,
  });
  if (!check.ok) throw new CoachKingError(check.code, 'Lineup was rejected');

  await prisma.coachKingSquad.update({
    where: { id: current.id },
    data: { confirmedAt: now, spentMilli: check.spentMilli },
  });
  return getCoachKingHome(clerkUserId, lang, now);
}

export async function listCoachKingFixtures(clerkUserId: string, _lang: CkLanguage, now: Date = new Date()) {
  const user = await requireUser(clerkUserId);
  const gameweek = await ensureCoachKingGameweek(now);
  const squad = await loadSquad(user.id, gameweek.id);
  const teamIds = [...new Set([
    ...(squad?.slots.map((slot) => slot.player.teamId) ?? []),
    ...(squad?.coach ? [squad.coach.teamId] : []),
  ])];
  if (teamIds.length === 0) return [];

  const rows = await prisma.cachedFixture.findMany({
    where: {
      leagueId: { in: europeLeagueIds() },
      matchDate: { gte: gameweek.startAt, lt: gameweek.endAt },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    orderBy: { matchDate: 'asc' },
    take: 40,
  });
  const scored = await prisma.coachKingFixture.findMany({
    where: { gameweekId: gameweek.id, fixtureId: { in: rows.map((row) => row.fixtureId) } },
  });
  const scoredById = new Map(scored.map((row) => [row.fixtureId, row]));

  return rows.map((row) => {
    const done = scoredById.get(row.fixtureId);
    return {
      fixtureId: row.fixtureId,
      kickoffAt: row.matchDate.toISOString(),
      status: done?.status ?? row.status,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeName: done?.homeTeamName || row.homeTeamName,
      awayName: done?.awayTeamName || row.awayTeamName,
      homeLogo: LOGO(row.homeTeamId),
      awayLogo: LOGO(row.awayTeamId),
      homeScore: done?.homeScore ?? null,
      awayScore: done?.awayScore ?? null,
    };
  });
}

type BoardRow = {
  userId: string;
  name: string;
  avatar: string | null;
  points: number;
  confirmedAt: Date;
};

export async function coachKingLeaderboard(period: 'week' | 'all', limit = 50, now: Date = new Date()) {
  const gameweek = period === 'week' ? await ensureCoachKingGameweek(now) : null;
  const squads = await prisma.coachKingSquad.findMany({
    where: {
      confirmedAt: { not: null },
      ...(gameweek ? { gameweekId: gameweek.id } : {}),
    },
    include: {
      slots: { select: { playerId: true } },
      user: { select: { id: true, displayName: true, username: true, avatar: true } },
    },
  });
  if (squads.length === 0) return [];

  const gameweekIds = [...new Set(squads.map((squad) => squad.gameweekId))];
  const [performances, coachScores] = await Promise.all([
    prisma.coachKingPerformance.groupBy({
      by: ['gameweekId', 'playerId'],
      where: { gameweekId: { in: gameweekIds } },
      _sum: { points: true },
    }),
    prisma.coachKingCoachScore.groupBy({
      by: ['gameweekId', 'coachId'],
      where: { gameweekId: { in: gameweekIds } },
      _sum: { points: true },
    }),
  ]);
  const playerPoints = new Map(performances.map((row) => [`${row.gameweekId}:${row.playerId}`, row._sum.points ?? 0]));
  const coachPoints = new Map(coachScores.map((row) => [`${row.gameweekId}:${row.coachId}`, row._sum.points ?? 0]));

  const byUser = new Map<string, BoardRow>();
  for (const squad of squads) {
    let points = squad.coachId ? coachPoints.get(`${squad.gameweekId}:${squad.coachId}`) ?? 0 : 0;
    for (const slot of squad.slots) points += playerPoints.get(`${squad.gameweekId}:${slot.playerId}`) ?? 0;
    const prev = byUser.get(squad.userId);
    const confirmedAt = squad.confirmedAt ?? squad.createdAt;
    if (!prev) {
      byUser.set(squad.userId, {
        userId: squad.userId,
        name: squad.user.displayName || squad.user.username,
        avatar: squad.user.avatar,
        points,
        confirmedAt,
      });
    } else {
      prev.points += points;
      if (confirmedAt < prev.confirmedAt) prev.confirmedAt = confirmedAt;
    }
  }

  return [...byUser.values()]
    .sort((a, b) => b.points - a.points || a.confirmedAt.getTime() - b.confirmedAt.getTime())
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, userId: row.userId, name: row.name, avatar: row.avatar, points: row.points }));
}

/** Credit 0.1M per fantasy point once, after the week is completed. */
export async function settleCoachKingGameweek(gameweekId: string, now: Date = new Date()): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const gameweek = await tx.coachKingGameweek.findUnique({ where: { id: gameweekId } });
    if (!gameweek || gameweek.status !== 'COMPLETED' || gameweek.settledAt) return 0;

    const squads = await tx.coachKingSquad.findMany({
      where: { gameweekId, confirmedAt: { not: null }, refundedAt: null },
      include: { slots: { select: { playerId: true } } },
    });
    const playerIds = [...new Set(squads.flatMap((squad) => squad.slots.map((slot) => slot.playerId)))];
    const coachIds = [...new Set(squads.map((squad) => squad.coachId).filter((id): id is string => id != null))];
    const [performances, coachScores] = await Promise.all([
      playerIds.length
        ? tx.coachKingPerformance.findMany({
          where: { gameweekId, playerId: { in: playerIds } },
          select: { playerId: true, points: true },
        })
        : Promise.resolve([]),
      coachIds.length
        ? tx.coachKingCoachScore.findMany({
          where: { gameweekId, coachId: { in: coachIds } },
          select: { coachId: true, points: true },
        })
        : Promise.resolve([]),
    ]);
    const playerPoints = new Map<string, number>();
    for (const row of performances) playerPoints.set(row.playerId, (playerPoints.get(row.playerId) ?? 0) + row.points);
    const coachPoints = new Map<string, number>();
    for (const row of coachScores) coachPoints.set(row.coachId, (coachPoints.get(row.coachId) ?? 0) + row.points);

    for (const squad of squads) {
      let points = squad.coachId ? coachPoints.get(squad.coachId) ?? 0 : 0;
      for (const slot of squad.slots) points += playerPoints.get(slot.playerId) ?? 0;
      await tx.coachKingWallet.upsert({
        where: { userId: squad.userId },
        create: { userId: squad.userId, balanceMilli: CK_START_BALANCE_MILLI + points },
        update: { balanceMilli: { increment: points } },
      });
      await tx.coachKingSquad.update({
        where: { id: squad.id },
        data: { payoutMilli: points, refundedAt: now },
      });
    }
    await tx.coachKingGameweek.update({ where: { id: gameweekId }, data: { settledAt: now } });
    return squads.length;
  });
}
