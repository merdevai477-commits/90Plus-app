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
import { CK_LIST_CACHE_PREFIX, ensureCoachKingPool, refreshCoachKingPoolIfStale } from './coach-king-pool.service';
import { redisCacheService } from './redis-cache.service';

export type CkErrorCode =
  | CkSquadIssue
  | 'USER_NOT_FOUND'
  | 'SQUAD_LOCKED'
  | 'SLOT_LOCKED'
  | 'PLAYER_NOT_FOUND'
  | 'COACH_NOT_FOUND';

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
const SLOT_LOCK_MIGRATION_FILE = path.join(process.cwd(), 'prisma/migrations/20261026160000_coach_king_slot_lock/migration.sql');

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
      if (!rows[0]?.reg) {
        for (const statement of migrationStatements(fs.readFileSync(MIGRATION_FILE, 'utf8'))) {
          await prisma.$executeRawUnsafe(statement);
        }
        logger.info('[CoachKing] created missing fantasy tables');
      }
      for (const statement of migrationStatements(fs.readFileSync(SLOT_LOCK_MIGRATION_FILE, 'utf8'))) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function warmCoachKingPool(): void {
  void ensureCoachKingPool()
    .then(() => refreshCoachKingPoolIfStale())
    .catch((error) => {
      logger.warn(`[CoachKing] pool sync failed: ${(error as Error)?.message}`);
    });
}

function europeLeagueIds(): number[] {
  return TSF_EUROPE_LEAGUE_KEYS.map((key) => TSF_LEAGUES[key]!.competitionLeagueId);
}

const USER_SELECT = { id: true, displayName: true, username: true, avatar: true, level: true } as const;

async function requireUser(clerkUserId: string) {
  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    select: USER_SELECT,
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

const LIST_TTL_MS = 10 * 60_000;
const LIST_LIMIT = 600;

function searchWhere(q: string) {
  return q
    ? {
      OR: [
        { nameAr: { contains: q, mode: 'insensitive' as const } },
        { nameEn: { contains: q, mode: 'insensitive' as const } },
        { clubNameAr: { contains: q, mode: 'insensitive' as const } },
        { clubNameEn: { contains: q, mode: 'insensitive' as const } },
      ],
    }
    : {};
}

async function cachedList<T>(key: string | null, load: () => Promise<T[]>): Promise<T[]> {
  if (!key) return load();
  const hit = await redisCacheService.get<T[]>(key).catch(() => null);
  if (hit?.length) return hit;
  const rows = await load();
  if (rows.length) await redisCacheService.set(key, rows, LIST_TTL_MS).catch(() => undefined);
  return rows;
}

export async function listCoachKingPlayers(line: string, lang: CkLanguage, query: string) {
  await ensureCoachKingSchema();
  const wanted = line.toUpperCase();
  if (!['GK', 'DEF', 'MID', 'FWD'].includes(wanted)) {
    throw new CoachKingError('BAD_SLOT', 'Line is not available');
  }
  const q = query.trim();
  return cachedList(q ? null : `${CK_LIST_CACHE_PREFIX}players:${wanted}:${lang}`, async () => {
    if (await prisma.coachKingPlayer.count({ where: { line: wanted as CkLine, active: true } }) === 0) {
      await ensureCoachKingPool().catch((error) => {
        logger.warn(`[CoachKing] pool sync failed: ${(error as Error)?.message}`);
      });
    }
    const rows = await prisma.coachKingPlayer.findMany({
      where: { active: true, line: wanted as CkLine, ...searchWhere(q) },
      orderBy: [{ priceMilli: 'desc' }, { nameAr: 'asc' }],
      take: LIST_LIMIT,
    });
    return rows.map((row) => playerDto(row, lang));
  });
}

export async function listCoachKingCoaches(lang: CkLanguage, query: string) {
  await ensureCoachKingSchema();
  const q = query.trim();
  return cachedList(q ? null : `${CK_LIST_CACHE_PREFIX}coaches:${lang}`, async () => {
    if (await prisma.coachKingCoach.count({ where: { active: true } }) === 0) {
      await ensureCoachKingPool().catch((error) => {
        logger.warn(`[CoachKing] pool sync failed: ${(error as Error)?.message}`);
      });
    }
    const rows = await prisma.coachKingCoach.findMany({
      where: { active: true, ...searchWhere(q) },
      orderBy: [{ priceMilli: 'desc' }, { nameAr: 'asc' }],
      take: LIST_LIMIT,
    });
    return rows.map((row) => coachDto(row, lang));
  });
}

const SQUAD_INCLUDE = { coach: true, slots: { include: { player: true } } } as const;

type LoadedSquad = Prisma.CoachKingSquadGetPayload<{ include: typeof SQUAD_INCLUDE }>;

function slotCost(slot: { priceMilli: number; player: { priceMilli: number } }): number {
  return slot.priceMilli > 0 ? slot.priceMilli : slot.player.priceMilli;
}

function coachCost(squad: { coachPriceMilli: number; coach: { priceMilli: number } | null }): number {
  if (!squad.coach) return 0;
  return squad.coachPriceMilli > 0 ? squad.coachPriceMilli : squad.coach.priceMilli;
}

function squadCost(squad: LoadedSquad | null): number {
  if (!squad) return 0;
  return squad.slots.reduce((sum, slot) => sum + slotCost(slot), 0) + coachCost(squad);
}

/**
 * A new week starts from last week's lineup with every pick unlocked, so the
 * player can keep it or swap anyone before their match starts.
 */
async function carryOverSquad(userId: string, gameweek: CoachKingGameweek, now: Date): Promise<LoadedSquad | null> {
  const previous = await prisma.coachKingSquad.findFirst({
    where: { userId, confirmedAt: { not: null }, gameweek: { startAt: { lt: gameweek.startAt } } },
    orderBy: { gameweek: { startAt: 'desc' } },
    include: SQUAD_INCLUDE,
  });
  if (!previous) return null;
  const slots = previous.slots.filter((slot) => slot.player.active);
  const coachActive = previous.coach?.active === true;
  try {
    await prisma.coachKingSquad.create({
      data: {
        userId,
        gameweekId: gameweek.id,
        coachId: coachActive ? previous.coachId : null,
        coachPriceMilli: coachActive ? coachCost(previous) : 0,
        confirmedAt: now,
        spentMilli: slots.reduce((sum, slot) => sum + slotCost(slot), 0) + (coachActive ? coachCost(previous) : 0),
        slots: {
          create: slots.map((slot) => ({ slotKey: slot.slotKey, playerId: slot.playerId, priceMilli: slotCost(slot) })),
        },
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
  return prisma.coachKingSquad.findUnique({
    where: { userId_gameweekId: { userId, gameweekId: gameweek.id } },
    include: SQUAD_INCLUDE,
  });
}

async function loadSquad(userId: string, gameweek: CoachKingGameweek, now: Date = new Date()): Promise<LoadedSquad | null> {
  const squad = await prisma.coachKingSquad.findUnique({
    where: { userId_gameweekId: { userId, gameweekId: gameweek.id } },
    include: SQUAD_INCLUDE,
  });
  if (squad) return squad;
  return carryOverSquad(userId, gameweek, now);
}

/** Roll every active lineup into the new week so nobody misses its points. */
export async function carryOverCoachKingSquads(gameweek: CoachKingGameweek, now: Date = new Date()): Promise<number> {
  const owners = await prisma.coachKingSquad.findMany({
    where: {
      confirmedAt: { not: null },
      gameweek: { startAt: { lt: gameweek.startAt } },
      user: { coachKingSquads: { none: { gameweekId: gameweek.id } } },
    },
    distinct: ['userId'],
    select: { userId: true },
  });
  let moved = 0;
  for (const owner of owners) {
    if (await carryOverSquad(owner.userId, gameweek, now)) moved += 1;
  }
  if (moved) invalidateBoard();
  return moved;
}

async function pointsByPlayer(gameweekId: string, playerIds: string[], coachId: string | null) {
  const [players, coach] = await Promise.all([
    playerIds.length
      ? prisma.coachKingPerformance.groupBy({
        by: ['playerId'],
        where: { gameweekId, playerId: { in: playerIds } },
        _sum: { points: true },
      })
      : Promise.resolve([]),
    coachId
      ? prisma.coachKingCoachScore.aggregate({ where: { gameweekId, coachId }, _sum: { points: true } })
      : Promise.resolve({ _sum: { points: 0 } }),
  ]);
  return {
    players: new Map(players.map((row) => [row.playerId, row._sum.points ?? 0])),
    coach: coach._sum.points ?? 0,
  };
}

function squadDto(squad: LoadedSquad | null, gameweek: CoachKingGameweek, lang: CkLanguage, scores: Awaited<ReturnType<typeof pointsByPlayer>>) {
  const lockedUntil = gameweek.endAt.toISOString();
  const playerPoints = (squad?.slots ?? []).reduce((sum, slot) => sum + (scores.players.get(slot.playerId) ?? 0), 0);
  return {
    confirmed: squad?.confirmedAt != null,
    spentMilli: squadCost(squad),
    points: squad?.confirmedAt ? playerPoints + (squad.coachId ? scores.coach : 0) : 0,
    lockedUntil,
    coach: squad?.coach
      ? {
        ...coachDto(squad.coach, lang),
        pricePaidMilli: coachCost(squad),
        locked: squad.coachLockedAt != null,
        points: scores.coach,
      }
      : null,
    slots: (squad?.slots ?? []).map((slot) => ({
      slotKey: slot.slotKey,
      label: coachKingSlot(slot.slotKey)?.label ?? slot.slotKey,
      locked: slot.lockedAt != null,
      pricePaidMilli: slotCost(slot),
      points: scores.players.get(slot.playerId) ?? 0,
      player: playerDto(slot.player, lang),
    })),
  };
}

export async function getCoachKingHome(clerkUserId: string, lang: CkLanguage, now: Date = new Date()) {
  await ensureCoachKingSchema();
  warmCoachKingPool();
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([
    ensureWallet(user.id),
    ensureCoachKingGameweek(now),
  ]);
  const squad = await loadSquad(user.id, gameweek, now);
  const [scores, board] = await Promise.all([
    pointsByPlayer(gameweek.id, squad?.slots.map((slot) => slot.playerId) ?? [], squad?.coachId ?? null),
    cachedBoard(now).catch((error) => {
      logger.warn(`[CoachKing] rank skipped: ${(error as Error)?.message}`);
      return null;
    }),
  ]);
  const reserved = squadCost(squad);
  const remaining = coachKingRemainingMilli(wallet.balanceMilli, reserved);

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar,
      level: user.level,
      rank: board?.all.find((row) => row.userId === user.id)?.rank ?? null,
    },
    wallet: {
      balanceMilli: wallet.balanceMilli,
      remainingMilli: remaining,
      balanceLabel: formatCoachKingMoney(wallet.balanceMilli),
      remainingLabel: formatCoachKingMoney(remaining),
    },
    gameweek: {
      id: gameweek.id,
      weekKey: gameweek.weekKey,
      startAt: gameweek.startAt.toISOString(),
      endAt: gameweek.endAt.toISOString(),
      status: gameweek.status,
      locked: !pickingOpen(gameweek, now),
    },
    squad: squadDto(squad, gameweek, lang, scores),
  };
}

async function openSquad(userId: string, gameweek: CoachKingGameweek, now: Date): Promise<LoadedSquad> {
  const existing = await loadSquad(userId, gameweek, now);
  if (existing) return existing;
  try {
    await prisma.coachKingSquad.create({ data: { userId, gameweekId: gameweek.id } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
  return prisma.coachKingSquad.findUniqueOrThrow({
    where: { userId_gameweekId: { userId, gameweekId: gameweek.id } },
    include: SQUAD_INCLUDE,
  });
}

function draftOf(squad: LoadedSquad) {
  return squad.slots.map((slot) => ({
    slotKey: slot.slotKey,
    playerId: slot.playerId,
    line: slot.player.line as CkLine,
    teamId: slot.player.teamId,
    priceMilli: slotCost(slot),
  }));
}

/** Confirm one pick. It stays locked in its slot until the gameweek ends. */
export async function pickCoachKingSlot(
  clerkUserId: string,
  input: { slotKey: string; playerId: string },
  lang: CkLanguage,
  now: Date = new Date(),
) {
  await ensureCoachKingSchema();
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([ensureWallet(user.id), ensureCoachKingGameweek(now)]);
  if (!pickingOpen(gameweek, now)) throw new CoachKingError('SQUAD_LOCKED', 'This week is closed');
  const spec = coachKingSlot(input.slotKey);
  if (!spec) throw new CoachKingError('BAD_SLOT', 'Unknown slot');

  const player = await prisma.coachKingPlayer.findFirst({ where: { id: input.playerId, active: true } });
  if (!player) throw new CoachKingError('PLAYER_NOT_FOUND', 'Player is not in the pool');
  if (player.line !== spec.line) throw new CoachKingError('WRONG_LINE', 'Player does not fit this slot');

  const squad = await openSquad(user.id, gameweek, now);
  const current = squad.slots.find((slot) => slot.slotKey === spec.key) ?? null;
  if (current?.lockedAt) throw new CoachKingError('SLOT_LOCKED', 'This pick is locked until the week ends');

  const started = await startedTeamIds([player.teamId, ...(current ? [current.player.teamId] : [])], gameweek, now);
  if (started.size) throw new CoachKingError('MATCH_STARTED', 'This club already played this week');

  const keepPrice = current?.playerId === player.id;
  const priceMilli = keepPrice && current ? slotCost(current) : player.priceMilli;
  const next = draftOf(squad).filter((slot) => slot.slotKey !== spec.key);
  next.push({ slotKey: spec.key, playerId: player.id, line: player.line as CkLine, teamId: player.teamId, priceMilli });
  const check = inspectCoachKingSquad({
    slots: next,
    coachPriceMilli: squad.coach ? coachCost(squad) : null,
    coachTeamId: squad.coach?.teamId ?? null,
    balanceMilli: wallet.balanceMilli,
    startedTeamIds: new Set(),
    requireComplete: false,
  });
  if (!check.ok) throw new CoachKingError(check.code, 'Pick was rejected');

  await prisma.$transaction([
    prisma.coachKingSquadSlot.upsert({
      where: { squadId_slotKey: { squadId: squad.id, slotKey: spec.key } },
      create: { squadId: squad.id, slotKey: spec.key, playerId: player.id, priceMilli, lockedAt: now },
      update: { playerId: player.id, priceMilli, lockedAt: now },
    }),
    prisma.coachKingSquad.update({
      where: { id: squad.id },
      data: { spentMilli: check.spentMilli, confirmedAt: squad.confirmedAt ?? now },
    }),
  ]);
  invalidateBoard();
  return getCoachKingHome(clerkUserId, lang, now);
}

/** Confirm the head coach. Same weekly lock as a player pick. */
export async function pickCoachKingCoach(clerkUserId: string, coachId: string, lang: CkLanguage, now: Date = new Date()) {
  await ensureCoachKingSchema();
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([ensureWallet(user.id), ensureCoachKingGameweek(now)]);
  if (!pickingOpen(gameweek, now)) throw new CoachKingError('SQUAD_LOCKED', 'This week is closed');
  const coach = await prisma.coachKingCoach.findFirst({ where: { id: coachId, active: true } });
  if (!coach) throw new CoachKingError('COACH_NOT_FOUND', 'Coach is not in the pool');

  const squad = await openSquad(user.id, gameweek, now);
  if (squad.coachLockedAt) throw new CoachKingError('SLOT_LOCKED', 'The coach is locked until the week ends');
  const started = await startedTeamIds([coach.teamId, ...(squad.coach ? [squad.coach.teamId] : [])], gameweek, now);
  if (started.size) throw new CoachKingError('MATCH_STARTED', 'This club already played this week');

  const priceMilli = squad.coachId === coach.id ? coachCost(squad) : coach.priceMilli;
  const check = inspectCoachKingSquad({
    slots: draftOf(squad),
    coachPriceMilli: priceMilli,
    coachTeamId: coach.teamId,
    balanceMilli: wallet.balanceMilli,
    startedTeamIds: new Set(),
    requireComplete: false,
  });
  if (!check.ok) throw new CoachKingError(check.code, 'Pick was rejected');

  await prisma.coachKingSquad.update({
    where: { id: squad.id },
    data: {
      coachId: coach.id,
      coachPriceMilli: priceMilli,
      coachLockedAt: now,
      spentMilli: check.spentMilli,
      confirmedAt: squad.confirmedAt ?? now,
    },
  });
  invalidateBoard();
  return getCoachKingHome(clerkUserId, lang, now);
}

/** Anyone's lineup for the ranking: this week, or their last confirmed one. */
export async function getCoachKingUserSquad(userId: string, lang: CkLanguage, now: Date = new Date()) {
  await ensureCoachKingSchema();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!user) throw new CoachKingError('USER_NOT_FOUND', 'User not found');
  const gameweek = await ensureCoachKingGameweek(now);
  const squad = await prisma.coachKingSquad.findFirst({
    where: { userId, confirmedAt: { not: null }, gameweek: { startAt: { lte: gameweek.startAt } } },
    orderBy: { gameweek: { startAt: 'desc' } },
    include: { ...SQUAD_INCLUDE, gameweek: true },
  });
  const [scores, board] = await Promise.all([
    squad
      ? pointsByPlayer(squad.gameweekId, squad.slots.map((slot) => slot.playerId), squad.coachId)
      : Promise.resolve({ players: new Map<string, number>(), coach: 0 }),
    cachedBoard(now).catch(() => null),
  ]);
  const overall = board?.all.find((row) => row.userId === user.id) ?? null;
  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar,
      level: user.level,
      rank: overall?.rank ?? null,
      points: overall?.points ?? 0,
      weekPoints: overall?.weekPoints ?? 0,
    },
    gameweek: squad ? { id: squad.gameweek.id, weekKey: squad.gameweek.weekKey, current: squad.gameweekId === gameweek.id } : null,
    squad: squad ? squadDto(squad, squad.gameweek, lang, scores) : null,
  };
}

export async function listCoachKingFixtures(clerkUserId: string, _lang: CkLanguage, now: Date = new Date()) {
  const user = await requireUser(clerkUserId);
  const gameweek = await ensureCoachKingGameweek(now);
  const squad = await loadSquad(user.id, gameweek, now);
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
  username: string;
  name: string;
  avatar: string | null;
  level: number;
  points: number;
  weekPoints: number;
  inWeek: boolean;
  confirmedAt: Date;
};

export type CoachKingBoardEntry = Omit<BoardRow, 'inWeek' | 'confirmedAt'> & { rank: number };

const BOARD_TTL_MS = 60_000;
let boardCache: { at: number; value: Promise<{ all: CoachKingBoardEntry[]; week: CoachKingBoardEntry[] }> } | null = null;

function invalidateBoard(): void {
  boardCache = null;
}

function cachedBoard(now: Date = new Date()) {
  if (!boardCache || Date.now() - boardCache.at > BOARD_TTL_MS) {
    const value = buildBoard(now);
    boardCache = { at: Date.now(), value };
    value.catch(() => {
      if (boardCache?.value === value) boardCache = null;
    });
  }
  return boardCache.value;
}

export async function coachKingLeaderboard(period: 'week' | 'all', limit = 50, now: Date = new Date()) {
  const board = await cachedBoard(now);
  return (period === 'week' ? board.week : board.all).slice(0, limit);
}

async function buildBoard(now: Date): Promise<{ all: CoachKingBoardEntry[]; week: CoachKingBoardEntry[] }> {
  await ensureCoachKingSchema();
  const current = await ensureCoachKingGameweek(now);
  const squads = await prisma.coachKingSquad.findMany({
    where: { confirmedAt: { not: null } },
    include: {
      slots: { select: { playerId: true } },
      user: { select: { id: true, displayName: true, username: true, avatar: true, level: true } },
    },
  });
  if (squads.length === 0) return { all: [], week: [] };

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
    const thisWeek = squad.gameweekId === current.id;
    if (!prev) {
      byUser.set(squad.userId, {
        userId: squad.userId,
        username: squad.user.username,
        name: squad.user.displayName || squad.user.username,
        avatar: squad.user.avatar,
        level: squad.user.level,
        points,
        weekPoints: thisWeek ? points : 0,
        inWeek: thisWeek,
        confirmedAt,
      });
    } else {
      prev.points += points;
      if (thisWeek) {
        prev.weekPoints = points;
        prev.inWeek = true;
      }
      if (confirmedAt < prev.confirmedAt) prev.confirmedAt = confirmedAt;
    }
  }

  const rows = [...byUser.values()];
  const ranked = (list: BoardRow[], score: (row: BoardRow) => number): CoachKingBoardEntry[] => list
    .sort((a, b) => score(b) - score(a) || a.confirmedAt.getTime() - b.confirmedAt.getTime())
    .map(({ inWeek: _inWeek, confirmedAt: _at, ...row }, index) => ({ ...row, rank: index + 1 }));
  return {
    all: ranked([...rows], (row) => row.points),
    week: ranked(rows.filter((row) => row.inWeek), (row) => row.weekPoints),
  };
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
