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
import { CK_COACH_PRICE_MILLI } from './coach-king-pricing';
import {
  CK_WEEKLY_BUDGET_MILLI,
  coachKingRemainingMilli,
  coachKingSlot,
  coachKingSlotAccepts,
  formatCoachKingMoney,
  inspectCoachKingSquad,
  type CkLine,
  type CkSquadIssue,
} from './coach-king-scoring';
import {
  TSF_EUROPE_LEAGUE_KEYS,
  TSF_LEAGUES,
  tsfGameweekWindow,
  tsfPortraitUrl,
} from './top-scorers-five-scoring';
import {
  CK_LIST_CACHE_PREFIX,
  ensureCoachKingPool,
  refreshCoachKingPoolIfStale,
  syncCoachKingPool,
} from './coach-king-pool.service';
import { coachKingTimerVisible } from './coach-king-timer';
import { isSquadEditLocked, lineupsDiffer, nextConfirmedLock, performanceCountsForMember } from './squad-lock';
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
const SQUAD_LOCK_MIGRATION_FILE = path.join(process.cwd(), 'prisma/migrations/20261112190000_squad_lock_7_days/migration.sql');

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
/** Skip slot-lock ALTER after a successful presence check (or apply). */
let slotLockColumnsReady = false;

async function ensureSlotLockColumns(): Promise<void> {
  if (slotLockColumnsReady) return;
  const cols = await prisma.$queryRawUnsafe<Array<{ attname: string }>>(
    `SELECT a.attname
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('coach_king_squads', 'coach_king_squad_slots')
       AND a.attname IN ('coachLockedAt', 'coachPriceMilli', 'priceMilli', 'lockedAt')
       AND a.attnum > 0 AND NOT a.attisdropped`,
  );
  const names = new Set(cols.map((row) => row.attname));
  const present =
    names.has('coachLockedAt')
    && names.has('coachPriceMilli')
    && names.has('priceMilli')
    && names.has('lockedAt');
  if (!present) {
    for (const statement of migrationStatements(fs.readFileSync(SLOT_LOCK_MIGRATION_FILE, 'utf8'))) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
  slotLockColumnsReady = true;
}

let squadLockReady = false;

async function ensureSquadLockColumns(): Promise<void> {
  if (squadLockReady) return;
  const cols = await prisma.$queryRawUnsafe<Array<{ attname: string }>>(
    `SELECT a.attname
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'coach_king_squads'
       AND a.attname = 'unlocksAt'
       AND a.attnum > 0 AND NOT a.attisdropped`,
  );
  if (cols.length === 0) {
    for (const statement of migrationStatements(fs.readFileSync(SQUAD_LOCK_MIGRATION_FILE, 'utf8'))) {
      await prisma.$executeRawUnsafe(statement);
    }
    logger.info('[CoachKing] applied squad lock schema');
  }
  squadLockReady = true;
}

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
      await ensureSlotLockColumns();
      await ensureSquadLockColumns();
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

const EUROPE_LEAGUE_KEY_BY_ID = new Map<number, string>(
  TSF_EUROPE_LEAGUE_KEYS.flatMap((key) => {
    const id = TSF_LEAGUES[key]?.competitionLeagueId;
    return id == null ? [] : [[id, key] as const];
  }),
);

function europeLeagueKey(leagueId: number): string | null {
  return EUROPE_LEAGUE_KEY_BY_ID.get(leagueId) ?? null;
}

const USER_SELECT = { id: true, displayName: true, username: true, avatar: true, level: true, isVerified: true, isDeveloper: true } as const;

async function requireUser(clerkUserId: string) {
  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    select: USER_SELECT,
  });
  if (!user) throw new CoachKingError('USER_NOT_FOUND', 'User not found');
  return user;
}

/** Ensure a wallet row exists. Balance is set only on create (weekly budget is applied elsewhere). */
async function ensureWallet(userId: string) {
  return prisma.coachKingWallet.upsert({
    where: { userId },
    create: { userId, balanceMilli: CK_WEEKLY_BUDGET_MILLI },
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

function displayName(row: { nameAr: string; nameEn: string | null }, lang: CkLanguage): string {
  return lang === 'en' && row.nameEn ? row.nameEn : row.nameAr;
}

function clubName(row: { clubNameAr: string; clubNameEn: string | null }, lang: CkLanguage): string {
  return lang === 'en' && row.clubNameEn ? row.clubNameEn : row.clubNameAr;
}

type PlayerRow = {
  id: string;
  leagueKey: string;
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
    leagueKey: row.leagueKey,
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
  leagueKey: string;
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
    leagueKey: row.leagueKey,
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
const LIST_LIMIT = 1000;

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

let coachPricesFlat = false;

/** Head coaches are a flat 5M. Rewrite stored prices once so the picker does not wait for a full pool sync. */
async function flattenCoachKingCoachPrices(): Promise<void> {
  if (coachPricesFlat) return;
  const changed = await prisma.coachKingCoach.updateMany({
    where: { priceMilli: { not: CK_COACH_PRICE_MILLI } },
    data: { priceMilli: CK_COACH_PRICE_MILLI },
  });
  if (changed.count > 0) {
    await redisCacheService.delPattern(`${CK_LIST_CACHE_PREFIX}*`).catch(() => undefined);
  }
  coachPricesFlat = true;
}

export async function listCoachKingCoaches(lang: CkLanguage, query: string) {
  await ensureCoachKingSchema();
  await flattenCoachKingCoachPrices();
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

/** The live squad is the one the user edits. Older week rows stay for history. */
async function loadSquad(userId: string, _gameweek: CoachKingGameweek, _now: Date = new Date()): Promise<LoadedSquad | null> {
  const live = await prisma.coachKingSquad.findFirst({
    where: { userId, isLive: true },
    include: SQUAD_INCLUDE,
  });
  if (live) return live;
  const previous = await prisma.coachKingSquad.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: SQUAD_INCLUDE,
  });
  if (!previous) return null;
  await prisma.coachKingSquad.update({
    where: { id: previous.id },
    data: { isLive: true, unlocksAt: null },
  });
  return prisma.coachKingSquad.findFirst({
    where: { id: previous.id },
    include: SQUAD_INCLUDE,
  });
}

/** Weekly lineup copies are retired. The live squad persists across Tuesdays. */
export async function carryOverCoachKingSquads(_gameweek: CoachKingGameweek, _now: Date = new Date()): Promise<number> {
  return 0;
}

type CkScoreMember = {
  playerId: string | null;
  coachId: string | null;
  selectedAt: Date;
  removedAt: Date | null;
  legacyThrough: Date | null;
};

/** Week points a confirmed membership actually earned. Draft slots score nothing. */
async function pointsByPlayer(gameweekId: string, members: CkScoreMember[]) {
  const playerIds = members.map((member) => member.playerId).filter((id): id is string => id != null);
  const coachIds = members.map((member) => member.coachId).filter((id): id is string => id != null);
  const [playerRows, coachRows] = await Promise.all([
    playerIds.length
      ? prisma.coachKingPerformance.findMany({
        where: { gameweekId, playerId: { in: playerIds } },
        select: { playerId: true, points: true, fixtureDate: true, createdAt: true },
      })
      : Promise.resolve([]),
    coachIds.length
      ? prisma.coachKingCoachScore.findMany({
        where: { gameweekId, coachId: { in: coachIds } },
        select: { coachId: true, points: true, fixtureDate: true, createdAt: true },
      })
      : Promise.resolve([]),
  ]);
  const players = new Map<string, number>();
  for (const row of playerRows) {
    const counted = members.some((member) => member.playerId === row.playerId && performanceCountsForMember(
      { kickoffAt: row.fixtureDate, createdAt: row.createdAt, gameweekId },
      member,
      gameweekId,
    ));
    if (!counted) continue;
    players.set(row.playerId, (players.get(row.playerId) ?? 0) + row.points);
  }
  let coach = 0;
  for (const row of coachRows) {
    const counted = members.some((member) => member.coachId === row.coachId && performanceCountsForMember(
      { kickoffAt: row.fixtureDate, createdAt: row.createdAt, gameweekId },
      member,
      gameweekId,
    ));
    if (counted) coach += row.points;
  }
  return { players, coach };
}

type CkOpenMember = { slotKey: string | null; playerId: string | null; coachId: string | null };

function squadDirty(squad: LoadedSquad, members: CkOpenMember[]): boolean {
  const before = [
    ...members.filter((member) => member.slotKey).map((member) => ({ slotKey: member.slotKey as string, id: member.playerId })),
    { slotKey: 'coach', id: members.find((member) => member.slotKey == null)?.coachId ?? null },
  ];
  const after = [
    ...squad.slots.map((slot) => ({ slotKey: slot.slotKey, id: slot.playerId as string | null })),
    { slotKey: 'coach', id: squad.coachId },
  ];
  return lineupsDiffer(before, after);
}

function squadDto(
  squad: LoadedSquad | null,
  _gameweek: CoachKingGameweek,
  lang: CkLanguage,
  scores: Awaited<ReturnType<typeof pointsByPlayer>>,
  now: Date = new Date(),
  members: CkOpenMember[] = [],
) {
  const locked = squad ? isSquadEditLocked(squad.unlocksAt, now) : false;
  const dirty = squad ? squadDirty(squad, members) : false;
  const scoringPlayers = new Set(members.map((member) => member.playerId).filter((id): id is string => id != null));
  const scoringCoach = members.some((member) => member.slotKey == null && member.coachId != null && member.coachId === squad?.coachId);
  const playerPoints = (squad?.slots ?? []).reduce((sum, slot) => {
    if (!scoringPlayers.has(slot.playerId) && squad?.confirmedAt) return sum;
    return sum + (scores.players.get(slot.playerId) ?? 0);
  }, 0);
  return {
    confirmed: squad?.confirmedAt != null,
    spentMilli: squadCost(squad),
    points: squad?.confirmedAt ? playerPoints + (scoringCoach || !squad?.coachId ? (squad?.coachId ? scores.coach : 0) : 0) : 0,
    lockedUntil: squad?.unlocksAt?.toISOString() ?? null,
    dirty,
    readyToEdit: !locked,
    coach: squad?.coach
      ? {
        ...coachDto(squad.coach, lang),
        pricePaidMilli: coachCost(squad),
        locked,
        points: scores.coach,
      }
      : null,
    slots: (squad?.slots ?? []).map((slot) => ({
      slotKey: slot.slotKey,
      label: coachKingSlot(slot.slotKey)?.label ?? slot.slotKey,
      locked,
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
  const members = squad
    ? await prisma.coachKingMembership.findMany({
      where: { squadId: squad.id, removedAt: null },
      select: { slotKey: true, playerId: true, coachId: true, selectedAt: true, removedAt: true, legacyThrough: true },
    })
    : [];
  const [scores, board] = await Promise.all([
    pointsByPlayer(gameweek.id, members),
    cachedBoard(now).catch((error) => {
      logger.warn(`[CoachKing] rank skipped: ${(error as Error)?.message}`);
      return null;
    }),
  ]);
  const reserved = squadCost(squad);
  const remaining = coachKingRemainingMilli(wallet.balanceMilli, reserved);
  const picksOpen = !isSquadEditLocked(squad?.unlocksAt, now);

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
      locked: !picksOpen,
      showTimer: coachKingTimerVisible(picksOpen),
    },
    squad: squadDto(squad, gameweek, lang, scores, now, members),
  };
}

async function openSquad(userId: string, gameweek: CoachKingGameweek, now: Date): Promise<LoadedSquad> {
  const existing = await loadSquad(userId, gameweek, now);
  if (existing) return existing;
  try {
    await prisma.coachKingSquad.create({ data: { userId, gameweekId: gameweek.id, isLive: true } });
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
  const spec = coachKingSlot(input.slotKey);
  if (!spec) throw new CoachKingError('BAD_SLOT', 'Unknown slot');

  const player = await prisma.coachKingPlayer.findFirst({ where: { id: input.playerId, active: true } });
  if (!player) throw new CoachKingError('PLAYER_NOT_FOUND', 'Player is not in the pool');
  if (player.line !== spec.line || !coachKingSlotAccepts(spec.key, player.position)) {
    throw new CoachKingError('WRONG_LINE', 'Player does not fit this slot');
  }

  const squad = await openSquad(user.id, gameweek, now);
  if (isSquadEditLocked(squad.unlocksAt, now)) throw new CoachKingError('SQUAD_LOCKED', 'Your squad is locked');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "coach_king_squads" WHERE id = ${squad.id} FOR UPDATE`;
    const fresh = await tx.coachKingSquad.findUnique({ where: { id: squad.id }, select: { unlocksAt: true, version: true } });
    if (!fresh || isSquadEditLocked(fresh.unlocksAt, now)) throw new CoachKingError('SQUAD_LOCKED', 'Your squad is locked');
    const lockedRows = await tx.$queryRaw<Array<{
      playerId: string;
      lockedAt: Date | null;
      priceMilli: number;
      teamId: number;
    }>>`
      SELECT s."playerId", s."lockedAt", s."priceMilli", p."teamId"
      FROM "coach_king_squad_slots" s
      JOIN "coach_king_players" p ON p.id = s."playerId"
      WHERE s."squadId" = ${squad.id} AND s."slotKey" = ${spec.key}
      FOR UPDATE OF s
    `;
    const current = lockedRows[0] ?? null;

    const keepPrice = current?.playerId === player.id;
    const priceMilli = keepPrice && current
      ? (current.priceMilli > 0 ? current.priceMilli : player.priceMilli)
      : player.priceMilli;
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

    await tx.coachKingSquadSlot.upsert({
      where: { squadId_slotKey: { squadId: squad.id, slotKey: spec.key } },
      create: { squadId: squad.id, slotKey: spec.key, playerId: player.id, priceMilli, lockedAt: null },
      update: { playerId: player.id, priceMilli, lockedAt: null },
    });
    await tx.coachKingSquad.update({
      where: { id: squad.id },
      data: { spentMilli: check.spentMilli },
    });
  });
  invalidateBoard();
  return getCoachKingHome(clerkUserId, lang, now);
}

/** Confirm the head coach. Same weekly lock as a player pick. */
export async function pickCoachKingCoach(clerkUserId: string, coachId: string, lang: CkLanguage, now: Date = new Date()) {
  await ensureCoachKingSchema();
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([ensureWallet(user.id), ensureCoachKingGameweek(now)]);
  const coach = await prisma.coachKingCoach.findFirst({ where: { id: coachId, active: true } });
  if (!coach) throw new CoachKingError('COACH_NOT_FOUND', 'Coach is not in the pool');

  const squad = await openSquad(user.id, gameweek, now);
  if (isSquadEditLocked(squad.unlocksAt, now)) throw new CoachKingError('SQUAD_LOCKED', 'Your squad is locked');

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
      coachLockedAt: null,
      spentMilli: check.spentMilli,
    },
  });
  invalidateBoard();
  return getCoachKingHome(clerkUserId, lang, now);
}

/** Commit the draft. An identical lineup does not start a new 7-day lock. */
export async function confirmCoachKingSquad(clerkUserId: string, lang: CkLanguage, now: Date = new Date()) {
  await ensureCoachKingSchema();
  const user = await requireUser(clerkUserId);
  const [wallet, gameweek] = await Promise.all([ensureWallet(user.id), ensureCoachKingGameweek(now)]);
  const squad = await openSquad(user.id, gameweek, now);
  const members = await prisma.coachKingMembership.findMany({
    where: { squadId: squad.id, removedAt: null },
    select: { id: true, slotKey: true, playerId: true, coachId: true, priceMilli: true },
  });
  const before = [
    ...members.filter((member) => member.slotKey).map((member) => ({ slotKey: member.slotKey as string, id: member.playerId })),
    { slotKey: 'coach', id: members.find((member) => member.slotKey == null)?.coachId ?? null },
  ];
  const after = [
    ...squad.slots.map((slot) => ({ slotKey: slot.slotKey, id: slot.playerId as string | null })),
    { slotKey: 'coach', id: squad.coachId },
  ];
  const changed = lineupsDiffer(before, after);
  if (!changed) return getCoachKingHome(clerkUserId, lang, now);
  if (isSquadEditLocked(squad.unlocksAt, now)) throw new CoachKingError('SQUAD_LOCKED', 'Your squad is locked');
  const next = nextConfirmedLock(
    { confirmedAt: squad.confirmedAt, unlocksAt: squad.unlocksAt, version: squad.version },
    changed,
    now,
  );
  if (!next.ok) throw new CoachKingError('SQUAD_LOCKED', 'Your squad is locked');
  if (changed) {
    const check = inspectCoachKingSquad({
      slots: draftOf(squad),
      coachPriceMilli: squad.coach ? coachCost(squad) : null,
      coachTeamId: squad.coach?.teamId ?? null,
      balanceMilli: wallet.balanceMilli,
      startedTeamIds: new Set(),
      requireComplete: false,
    });
    if (!check.ok) throw new CoachKingError(check.code, 'Pick was rejected');
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.coachKingSquad.updateMany({
        where: { id: squad.id, version: squad.version },
        data: { version: next.version, confirmedAt: next.confirmedAt, unlocksAt: next.unlocksAt, spentMilli: check.spentMilli },
      });
      if (claimed.count === 0) {
        logger.info('[fantasy.confirm.conflict] mode=coach-king');
        throw new CoachKingError('SQUAD_LOCKED', 'Your squad changed. Try again');
      }
      const keep = new Map(squad.slots.map((slot) => [slot.slotKey, slot]));
      for (const member of members) {
        if (member.slotKey == null) {
          if (member.coachId === squad.coachId) continue;
        } else if (keep.get(member.slotKey)?.playerId === member.playerId) {
          keep.delete(member.slotKey);
          continue;
        }
        await tx.coachKingMembership.update({ where: { id: member.id }, data: { removedAt: now } });
      }
      for (const slot of keep.values()) {
        await tx.coachKingMembership.create({
          data: {
            squadId: squad.id,
            slotKey: slot.slotKey,
            playerId: slot.playerId,
            selectedAt: now,
            priceMilli: slotCost(slot),
          },
        });
      }
      const coachMember = members.find((member) => member.slotKey == null);
      if (squad.coachId && coachMember?.coachId !== squad.coachId) {
        await tx.coachKingMembership.create({
          data: {
            squadId: squad.id,
            coachId: squad.coachId,
            selectedAt: now,
            priceMilli: coachCost(squad),
          },
        });
      }
    });
  }
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
    where: { userId, isLive: true },
    include: { ...SQUAD_INCLUDE, gameweek: true, memberships: { where: { removedAt: null } } },
  });
  const [scores, board] = await Promise.all([
    squad
      ? pointsByPlayer(gameweek.id, squad.memberships)
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
      leagueKey: europeLeagueKey(row.leagueId),
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

export function invalidateBoard(): void {
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
  const rows = (period === 'week' ? board.week : board.all).slice(0, limit);
  const { identityFor, loadFeaturedBadges } = await import('./elite-badge.service');
  const flags = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.userId) } },
    select: { id: true, isVerified: true, isDeveloper: true },
  });
  const byId = new Map(flags.map((row) => [row.id, row]));
  const badges = await loadFeaturedBadges(rows.map((row) => row.userId));
  return rows.map((row) => {
    const user = byId.get(row.userId);
    return {
      ...row,
      isVerified: !!user?.isVerified,
      isDeveloper: !!user?.isDeveloper,
      identity: identityFor({ id: row.userId, isVerified: user?.isVerified, isDeveloper: user?.isDeveloper }, badges),
    };
  });
}

async function buildBoard(now: Date): Promise<{ all: CoachKingBoardEntry[]; week: CoachKingBoardEntry[] }> {
  await ensureCoachKingSchema();
  const current = await ensureCoachKingGameweek(now);
  const squads = await prisma.coachKingSquad.findMany({
    where: { confirmedAt: { not: null }, isLive: false },
    include: {
      slots: { select: { playerId: true } },
      user: { select: USER_SELECT },
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

  const liveSquads = await prisma.coachKingSquad.findMany({
    where: { isLive: true, confirmedAt: { not: null } },
    include: {
      memberships: true,
      user: { select: USER_SELECT },
    },
  });
  if (liveSquads.length) {
    const [livePerfs, liveCoach] = await Promise.all([
      prisma.coachKingPerformance.findMany({
        select: { gameweekId: true, playerId: true, fixtureId: true, points: true, fixtureDate: true, createdAt: true },
      }),
      prisma.coachKingCoachScore.findMany({
        select: { gameweekId: true, coachId: true, fixtureId: true, points: true, fixtureDate: true, createdAt: true },
      }),
    ]);
    for (const squad of liveSquads) {
      let points = 0;
      let weekPoints = 0;
      const seen = new Set<string>();
      for (const member of squad.memberships) {
        const rowsForMember = member.playerId
          ? livePerfs.filter((row) => row.playerId === member.playerId)
          : liveCoach.filter((row) => row.coachId === member.coachId);
        for (const row of rowsForMember) {
          const key = `${row.gameweekId}:${'fixtureId' in row ? row.fixtureId : ''}:${member.playerId ?? member.coachId}`;
          if (seen.has(key)) continue;
          if (!performanceCountsForMember(
            { kickoffAt: row.fixtureDate, createdAt: row.createdAt, gameweekId: row.gameweekId },
            member,
            squad.gameweekId,
          )) continue;
          seen.add(key);
          points += row.points;
          if (row.gameweekId === current.id) weekPoints += row.points;
        }
      }
      const confirmedAt = squad.confirmedAt ?? squad.createdAt;
      const prev = byUser.get(squad.userId);
      if (!prev) {
        byUser.set(squad.userId, {
          userId: squad.userId,
          username: squad.user.username,
          name: squad.user.displayName || squad.user.username,
          avatar: squad.user.avatar,
          level: squad.user.level,
          points,
          weekPoints,
          inWeek: true,
          confirmedAt,
        });
      } else {
        prev.points += points;
        prev.weekPoints += weekPoints;
        prev.inWeek = true;
      }
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

/**
 * Full competition restart: wipe squads / scores / weeks, reset wallets to 100M,
 * reprice the pool on the 5/8/13 ladder, and open a fresh gameweek.
 */
export async function resetCoachKingCompetition(now: Date = new Date()): Promise<{
  gameweekId: string;
  weekKey: string;
  wallets: number;
  pool: { players: number; coaches: number };
}> {
  await ensureCoachKingSchema();

  await prisma.$transaction(async (tx) => {
    await tx.coachKingPerformance.deleteMany();
    await tx.coachKingCoachScore.deleteMany();
    await tx.coachKingWeekPayout.deleteMany();
    await tx.coachKingMembership.deleteMany();
    await tx.coachKingSquadSlot.deleteMany();
    await tx.coachKingSquad.deleteMany();
    await tx.coachKingFixture.deleteMany();
    await tx.coachKingGameweek.deleteMany();
    await tx.coachKingWallet.updateMany({ data: { balanceMilli: CK_WEEKLY_BUDGET_MILLI } });
  });

  invalidateBoard();
  await redisCacheService.delPattern(`${CK_LIST_CACHE_PREFIX}*`).catch(() => undefined);

  const pool = await syncCoachKingPool();
  const gameweek = await ensureCoachKingGameweek(now);
  // Keep the fresh season OPEN for building squads; clubs that already played
  // this window are still blocked per pick via MATCH_STARTED.
  await prisma.coachKingGameweek.update({
    where: { id: gameweek.id },
    data: {
      status: 'OPEN',
      settledAt: null,
      completedAt: null,
      lockAt: gameweek.endAt,
    },
  });

  const wallets = await prisma.coachKingWallet.count();
  logger.info(
    `[CoachKing] competition reset week=${gameweek.weekKey} wallets=${wallets} players=${pool.players} coaches=${pool.coaches}`,
  );
  return {
    gameweekId: gameweek.id,
    weekKey: gameweek.weekKey,
    wallets,
    pool,
  };
}

/**
 * Close the week: record fantasy points for the board, then renew every wallet
 * to a fresh 100M for the next gameweek (points never raise the budget).
 */
export async function settleCoachKingGameweek(gameweekId: string, now: Date = new Date()): Promise<number> {
  try {
    return await settleCoachKingGameweekOnce(gameweekId, now);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info(`[fantasy.settle.duplicate] gameweekId=${gameweekId}`);
      return 0;
    }
    throw error;
  }
}

async function settleCoachKingGameweekOnce(gameweekId: string, now: Date): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const gameweek = await tx.coachKingGameweek.findUnique({ where: { id: gameweekId } });
    if (!gameweek || gameweek.status !== 'COMPLETED' || gameweek.settledAt) return 0;

    const squads = await tx.coachKingSquad.findMany({
      where: { isLive: true, confirmedAt: { not: null } },
      include: { memberships: true },
    });
    const already = new Set(
      (await tx.coachKingWeekPayout.findMany({ where: { gameweekId }, select: { userId: true } })).map((row) => row.userId),
    );
    const [performances, coachScores] = await Promise.all([
      tx.coachKingPerformance.findMany({
        where: { gameweekId },
        select: { playerId: true, fixtureId: true, points: true, fixtureDate: true, createdAt: true },
      }),
      tx.coachKingCoachScore.findMany({
        where: { gameweekId },
        select: { coachId: true, fixtureId: true, points: true, fixtureDate: true, createdAt: true },
      }),
    ]);

    for (const squad of squads) {
      if (already.has(squad.userId)) continue;
      let points = 0;
      const seen = new Set<string>();
      for (const member of squad.memberships) {
        if (member.playerId) {
          for (const row of performances) {
            if (row.playerId !== member.playerId) continue;
            const key = `p:${row.fixtureId}:${row.playerId}`;
            if (seen.has(key)) continue;
            if (!performanceCountsForMember(
              { kickoffAt: row.fixtureDate, createdAt: row.createdAt, gameweekId },
              member,
              squad.gameweekId,
            )) continue;
            seen.add(key);
            points += row.points;
          }
        }
        if (member.coachId) {
          for (const row of coachScores) {
            if (row.coachId !== member.coachId) continue;
            const key = `c:${row.fixtureId}:${row.coachId}`;
            if (seen.has(key)) continue;
            if (!performanceCountsForMember(
              { kickoffAt: row.fixtureDate, createdAt: row.createdAt, gameweekId },
              member,
              squad.gameweekId,
            )) continue;
            seen.add(key);
            points += row.points;
          }
        }
      }
      await tx.coachKingWallet.upsert({
        where: { userId: squad.userId },
        create: { userId: squad.userId, balanceMilli: CK_WEEKLY_BUDGET_MILLI },
        update: { balanceMilli: CK_WEEKLY_BUDGET_MILLI },
      });
      await tx.coachKingWeekPayout.create({
        data: { userId: squad.userId, gameweekId, points, settledAt: now },
      });
      await tx.coachKingSquad.update({
        where: { id: squad.id },
        data: { payoutMilli: points },
      });
    }
    await tx.coachKingGameweek.update({ where: { id: gameweekId }, data: { settledAt: now } });
    return squads.length;
  });
}
