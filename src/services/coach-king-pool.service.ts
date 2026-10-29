/**
 * King of Coaches pool — every outfield line from the big-five clubs already
 * used by Top Scorers Five, plus each club's head coach from its team profile.
 * Prices come from this season's numbers and are refreshed once a gameweek.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { mapPool } from '../utils/recent-form-averages';
import { TOP_SCORERS_FIVE_BUNDESLIGA } from '../data/top-scorers-five-bundesliga';
import { TOP_SCORERS_FIVE_LALIGA } from '../data/top-scorers-five-laliga';
import { TOP_SCORERS_FIVE_LIGUE1 } from '../data/top-scorers-five-ligue1';
import { TOP_SCORERS_FIVE_PL } from '../data/top-scorers-five-pl';
import { TOP_SCORERS_FIVE_SERIEA } from '../data/top-scorers-five-seriea';
import type { TopScorersFiveSeedClub } from '../data/top-scorers-five-laliga';
import type { CkLine } from './coach-king-scoring';
import {
  CK_COACH_PRICE_MILLI,
  CK_EMPTY_STATS,
  CK_PLAYER_CAP_MILLI,
  CK_PLAYER_FLOOR_MILLI,
  CK_PRICE_TIERS_MILLI,
  ckClubTier,
  ckCoachPrice,
  ckParseStatValue,
  ckPricePool,
  ckStatKey,
  type CkSeasonStats,
} from './coach-king-pricing';
import { redisCacheService } from './redis-cache.service';
import {
  threeSixFiveScoresService,
  type SquadPositionGroup,
  type ThreeSixFiveCoach,
  type ThreeSixFiveSquadPlayer,
} from './threeSixFiveScores.service';
import { TSF_LEAGUES, tsfGameweekWindow, tsfPortraitUrl, type TsfLeagueKey } from './top-scorers-five-scoring';
import { tsfPositionCode } from './top-scorers-five-pool.service';

type Club = { leagueKey: TsfLeagueKey; teamId: number; clubNameAr: string; clubNameEn: string };

const SEEDS: Array<[TsfLeagueKey, TopScorersFiveSeedClub[]]> = [
  ['laliga', TOP_SCORERS_FIVE_LALIGA],
  ['seriea', TOP_SCORERS_FIVE_SERIEA],
  ['bundesliga', TOP_SCORERS_FIVE_BUNDESLIGA],
  ['pl', TOP_SCORERS_FIVE_PL],
  ['ligue1', TOP_SCORERS_FIVE_LIGUE1],
];

const CONCURRENCY = 6;
export const CK_LIST_CACHE_PREFIX = 'ck:list:v2:';

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '');
}

function europeClubs(): { clubs: Club[]; stars: Set<string> } {
  const clubs = new Map<number, Club>();
  const stars = new Set<string>();
  for (const [leagueKey, list] of SEEDS) {
    for (const club of list) {
      if (!clubs.has(club.teamId)) {
        clubs.set(club.teamId, {
          leagueKey,
          teamId: club.teamId,
          clubNameAr: club.clubNameAr,
          clubNameEn: club.clubNameEn,
        });
      }
      for (const player of club.players) {
        const ar = norm(player.nameAr);
        const en = norm(player.nameEn);
        if (ar) stars.add(ar);
        if (en) stars.add(en);
      }
    }
  }
  return { clubs: [...clubs.values()], stars };
}

function lineOf(group: SquadPositionGroup): CkLine | null {
  if (group === 'goalkeeper') return 'GK';
  if (group === 'defender') return 'DEF';
  if (group === 'midfielder') return 'MID';
  if (group === 'forward') return 'FWD';
  return null;
}

function isStar(player: ThreeSixFiveSquadPlayer | undefined, stars: Set<string>): boolean {
  if (!player) return false;
  return stars.has(norm(player.name)) || stars.has(norm(player.shortName));
}

async function clubTiers(): Promise<Map<number, number>> {
  const tiers = new Map<number, number>();
  const keys = [...new Set(SEEDS.map(([key]) => key))];
  await Promise.all(keys.map(async (key) => {
    const cfg = TSF_LEAGUES[key];
    if (!cfg) return;
    const table = await threeSixFiveScoresService.getStandings(cfg.scores365CompetitionId, 'en').catch(() => null);
    const rows = (table?.data ?? []).filter((row) => row.groupNum === (table?.data?.[0]?.groupNum ?? row.groupNum));
    for (const row of rows) tiers.set(row.teamId, ckClubTier(row.position, rows.length));
  }));
  return tiers;
}

function applyBoardStats(
  out: Map<number, CkSeasonStats>,
  boards: Array<{ typeId?: number | null; rows: Array<{ athleteId: number; value: string | number | null }> }> | undefined,
): void {
  for (const board of boards ?? []) {
    const key = ckStatKey(board.typeId);
    if (!key) continue;
    for (const row of board.rows) {
      const stats = out.get(row.athleteId) ?? { ...CK_EMPTY_STATS };
      const next = ckParseStatValue(row.value);
      const current = stats[key];
      stats[key] = (typeof current === 'number' ? Math.max(current, next) : next) as never;
      out.set(row.athleteId, stats);
    }
  }
}

async function seasonStats(club: Club): Promise<Map<number, CkSeasonStats>> {
  const out = new Map<number, CkSeasonStats>();
  const cfg = TSF_LEAGUES[club.leagueKey];
  if (!cfg) return out;
  const res = await threeSixFiveScoresService
    .getCompetitorStats(club.teamId, cfg.scores365CompetitionId, 'en', { roster: true })
    .catch(() => null);
  applyBoardStats(out, res?.data?.leaderboards);
  return out;
}

/** League-wide boards catch stars that club roster stats miss or time out on. */
async function leagueSeasonStats(): Promise<Map<string, Map<number, CkSeasonStats>>> {
  const out = new Map<string, Map<number, CkSeasonStats>>();
  const keys = [...new Set(SEEDS.map(([key]) => key))];
  await Promise.all(keys.map(async (key) => {
    const cfg = TSF_LEAGUES[key];
    if (!cfg) return;
    const res = await threeSixFiveScoresService
      .getCompetitionStats(cfg.scores365CompetitionId, 'en')
      .catch(() => null);
    const board = new Map<number, CkSeasonStats>();
    applyBoardStats(board, res?.data?.leaderboards);
    out.set(key, board);
  }));
  return out;
}

function mergeSeasonStats(base: CkSeasonStats, extra: CkSeasonStats | undefined): CkSeasonStats {
  if (!extra) return base;
  return {
    goals: Math.max(base.goals, extra.goals),
    assists: Math.max(base.assists, extra.assists),
    xg: Math.max(base.xg, extra.xg),
    xa: Math.max(base.xa, extra.xa),
    rating: base.rating == null ? extra.rating : extra.rating == null ? base.rating : Math.max(base.rating, extra.rating),
    cleanSheets: Math.max(base.cleanSheets, extra.cleanSheets),
    saves: Math.max(base.saves, extra.saves),
    tackles: Math.max(base.tackles, extra.tackles),
    interceptions: Math.max(base.interceptions, extra.interceptions),
  };
}

type Fetched = {
  club: Club;
  ar: ThreeSixFiveSquadPlayer[];
  en: Map<number, ThreeSixFiveSquadPlayer>;
  stats: Map<number, CkSeasonStats>;
  coachAr: ThreeSixFiveCoach | null;
  coachEn: ThreeSixFiveCoach | null;
  ok: boolean;
};

async function fetchClub(club: Club): Promise<Fetched> {
  try {
    const [ar, en, stats, coachAr, coachEn] = await Promise.all([
      threeSixFiveScoresService.getCompetitorSquad(club.teamId, 'ar'),
      threeSixFiveScoresService.getCompetitorSquad(club.teamId, 'en'),
      seasonStats(club),
      threeSixFiveScoresService.getCompetitorCoach(club.teamId, 'ar').catch(() => null),
      threeSixFiveScoresService.getCompetitorCoach(club.teamId, 'en').catch(() => null),
    ]);
    const english = en.data?.players ?? [];
    return {
      club,
      ar: ar.data?.players?.length ? ar.data.players : english,
      en: new Map(english.map((player) => [player.athleteId, player])),
      stats,
      coachAr: coachAr?.data?.role === 'head_coach' ? coachAr.data : null,
      coachEn: coachEn?.data?.role === 'head_coach' ? coachEn.data : null,
      ok: Boolean(ar.data?.players?.length || english.length),
    };
  } catch (error) {
    logger.warn(`[CoachKing] club ${club.teamId} skipped: ${(error as Error)?.message}`);
    return { club, ar: [], en: new Map(), stats: new Map(), coachAr: null, coachEn: null, ok: false };
  }
}

let poolSync: Promise<{ players: number; coaches: number }> | null = null;
let lastCoachAttempt = 0;
let lastStaleCheck = 0;

function runSync(): Promise<{ players: number; coaches: number }> {
  if (!poolSync) {
    poolSync = syncCoachKingPool().finally(() => {
      poolSync = null;
    });
  }
  return poolSync;
}

export async function ensureCoachKingPool(): Promise<void> {
  const players = await prisma.coachKingPlayer.count();
  const coaches = players > 0 ? await prisma.coachKingCoach.count() : 0;
  if (players > 0 && coaches > 0) return;
  if (players > 0 && Date.now() - lastCoachAttempt < 60 * 60_000) return;
  lastCoachAttempt = Date.now();
  await runSync();
}

/** Reprice once per gameweek, and again immediately when stored prices still use an old ladder. */
export async function refreshCoachKingPoolIfStale(now: Date = new Date()): Promise<void> {
  if (Date.now() - lastStaleCheck < 10 * 60_000) return;
  lastStaleCheck = Date.now();
  const [latest, overCap, offTier, coachOff, topPrice] = await Promise.all([
    prisma.coachKingPlayer.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    prisma.coachKingPlayer.count({ where: { active: true, priceMilli: { gt: CK_PLAYER_CAP_MILLI } } }),
    prisma.coachKingPlayer.count({
      where: { active: true, priceMilli: { notIn: [...CK_PRICE_TIERS_MILLI] } },
    }),
    prisma.coachKingCoach.count({ where: { active: true, priceMilli: { not: CK_COACH_PRICE_MILLI } } }),
    prisma.coachKingPlayer.aggregate({
      where: { active: true },
      _max: { priceMilli: true },
    }),
  ]);
  const weekFresh = latest != null && latest.updatedAt >= tsfGameweekWindow(now).startAt;
  const capMissing = (topPrice._max.priceMilli ?? 0) < CK_PLAYER_CAP_MILLI;
  if (weekFresh && overCap === 0 && offTier === 0 && coachOff === 0 && !capMissing) return;
  await runSync();
}

export async function syncCoachKingPool(): Promise<{ players: number; coaches: number }> {
  const { clubs, stars } = europeClubs();
  const [tiers, fetched, leagueStats] = await Promise.all([
    clubTiers(),
    mapPool(clubs, CONCURRENCY, fetchClub),
    leagueSeasonStats(),
  ]);

  type Row = {
    club: Club;
    player: ThreeSixFiveSquadPlayer;
    twin: ThreeSixFiveSquadPlayer | undefined;
    line: CkLine;
    stats: CkSeasonStats;
    star: boolean;
  };
  const rows: Row[] = [];
  for (const item of fetched) {
    const leagueBoard = leagueStats.get(item.club.leagueKey);
    for (const player of item.ar) {
      const twin = item.en.get(player.athleteId);
      const line = lineOf(player.positionGroup !== 'other' ? player.positionGroup : twin?.positionGroup ?? 'other');
      if (!line) continue;
      rows.push({
        club: item.club,
        player,
        twin,
        line,
        stats: mergeSeasonStats(
          item.stats.get(player.athleteId) ?? { ...CK_EMPTY_STATS },
          leagueBoard?.get(player.athleteId),
        ),
        star: isStar(player, stars) || isStar(twin, stars),
      });
    }
  }

  const prices = ckPricePool(rows.map((row) => ({
    key: row.player.athleteId,
    line: row.line,
    stats: row.stats,
    clubTier: tiers.get(row.club.teamId) ?? 0.5,
    star: row.star,
  })));

  let players = 0;
  await mapPool(rows, CONCURRENCY, async ({ club, player, twin, line }) => {
    const position = tsfPositionCode(twin?.position ?? player.position)
      ?? (line === 'GK' ? 'GK' : line === 'DEF' ? 'CB' : line === 'MID' ? 'CM' : 'ST');
    const data = {
      leagueKey: club.leagueKey,
      teamId: club.teamId,
      clubNameAr: club.clubNameAr,
      clubNameEn: club.clubNameEn,
      nameAr: player.name || twin?.name || '—',
      nameEn: twin?.name ?? null,
      photoUrl: player.photo || twin?.photo || tsfPortraitUrl(player.athleteId),
      position,
      line,
      shirtNumber: player.jerseyNumber ?? twin?.jerseyNumber ?? null,
      priceMilli: prices.get(player.athleteId) ?? CK_PLAYER_FLOOR_MILLI,
      active: true,
    };
    try {
      await prisma.coachKingPlayer.upsert({
        where: { externalPlayerId: player.athleteId },
        create: { externalPlayerId: player.athleteId, ...data },
        update: data,
      });
      players += 1;
    } catch (error) {
      logger.warn(`[CoachKing] player ${player.athleteId} skipped: ${(error as Error)?.message}`);
    }
  });

  const synced = fetched.filter((item) => item.ok);
  for (const item of synced) {
    const seen = item.ar.map((player) => player.athleteId);
    await prisma.coachKingPlayer.updateMany({
      where: { teamId: item.club.teamId, externalPlayerId: { notIn: seen }, active: true },
      data: { active: false },
    });
  }

  let coaches = 0;
  for (const item of fetched) {
    const coach = item.coachAr ?? item.coachEn;
    if (!coach?.athleteId) continue;
    const { club } = item;
    const data = {
      leagueKey: club.leagueKey,
      teamId: club.teamId,
      clubNameAr: club.clubNameAr,
      clubNameEn: club.clubNameEn,
      nameAr: item.coachAr?.name || coach.name || '—',
      nameEn: item.coachEn?.name || coach.name || null,
      photoUrl: item.coachAr?.imageUrl || item.coachEn?.imageUrl || null,
      priceMilli: ckCoachPrice(tiers.get(club.teamId) ?? 0.5),
      active: true,
    };
    try {
      await prisma.coachKingCoach.updateMany({
        where: { teamId: club.teamId, externalCoachId: { not: coach.athleteId } },
        data: { active: false },
      });
      await prisma.coachKingCoach.upsert({
        where: { externalCoachId: coach.athleteId },
        create: { externalCoachId: coach.athleteId, ...data },
        update: data,
      });
      coaches += 1;
    } catch (error) {
      logger.warn(`[CoachKing] coach ${coach.athleteId} skipped: ${(error as Error)?.message}`);
    }
  }

  await redisCacheService.delPattern(`${CK_LIST_CACHE_PREFIX}*`).catch(() => undefined);
  logger.info(`[CoachKing] pool sync players=${players} coaches=${coaches} clubs=${synced.length}/${fetched.length}`);
  return { players, coaches };
}
