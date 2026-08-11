/**
 * Builds the quiz entity dataset from TeamInfo + TeamPlayer + CachedTeam.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import type { QuizLanguage } from '../types/quiz.types';
import type {
  QuizDatasetBuildResult,
  QuizDatasetClub,
  QuizDatasetPlayer,
  QuizDatasetStadium,
  QuizEntityDataset,
  QuizEntitySlice,
} from '../types/quiz-entity.types';
import {
  QUIZ_DATASET_MIN_CLUBS,
  QUIZ_DATASET_MIN_PLAYERS,
  QUIZ_DATASET_MIN_STADIUMS,
  QUIZ_SLICE_CLUB_COUNT,
  QUIZ_SLICE_PLAYER_COUNT,
  QUIZ_SLICE_STADIUM_COUNT,
} from '../constants/quiz.constants';
import { buildWorldCupNations } from '../constants/world-cup-nations';
import { QuizTheme } from '../types/quiz-theme.types';
import { getQuizThemeCampaign } from '../constants/quiz-theme.config';
import type { QuizDatasetNation } from '../types/quiz-entity.types';
import { scoreEntityNameMatch } from './quiz-name-match.util';

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickSlice<T>(items: T[], count: number, seed: string): T[] {
  if (items.length <= count) return [...items];
  const start = hashSeed(seed) % items.length;
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(items[(start + i) % items.length]!);
  }
  return out;
}

function parsePlayerInfoFields(apiContext: string): Partial<Pick<QuizDatasetPlayer, 'nationality' | 'age' | 'birthdate' | 'achievements' | 'statistics'>> {
  const out: Partial<Pick<QuizDatasetPlayer, 'nationality' | 'age' | 'birthdate' | 'achievements' | 'statistics'>> = {};
  try {
    const parsed = JSON.parse(apiContext) as Record<string, unknown>;
    if (typeof parsed.nationality === 'string') out.nationality = parsed.nationality;
    if (typeof parsed.age === 'number') out.age = parsed.age;
    if (typeof parsed.birthdate === 'string') out.birthdate = parsed.birthdate;
    if (Array.isArray(parsed.achievements)) {
      out.achievements = parsed.achievements.filter((a): a is string => typeof a === 'string');
    }
    if (parsed.statistics && typeof parsed.statistics === 'object') {
      out.statistics = parsed.statistics as Record<string, string | number>;
    }
  } catch {
    const nationality = apiContext.match(/nationality[:\s]+([A-Za-z\u0600-\u06FF\s]+)/i)?.[1]?.trim();
    if (nationality) out.nationality = nationality;
    const age = apiContext.match(/\bage[:\s]+(\d{1,2})\b/i)?.[1];
    if (age) out.age = Number(age);
    const birth = apiContext.match(/birth(?:date)?[:\s]+([\d-]+)/i)?.[1];
    if (birth) out.birthdate = birth;
  }
  return out;
}

export function isDatasetSufficient(dataset: QuizEntityDataset): boolean {
  return (
    dataset.players.length >= QUIZ_DATASET_MIN_PLAYERS &&
    dataset.clubs.length >= QUIZ_DATASET_MIN_CLUBS &&
    dataset.stadiums.length >= QUIZ_DATASET_MIN_STADIUMS
  );
}

export function selectDailyEntitySlice(
  dataset: QuizEntityDataset,
  packDate: string,
  language: QuizLanguage,
  attemptOffset = 0,
): QuizEntitySlice {
  const base = `${packDate}:${language}:attempt${attemptOffset}`;
  return {
    players: pickSlice(dataset.players, QUIZ_SLICE_PLAYER_COUNT, `${base}:players`),
    clubs: pickSlice(dataset.clubs, QUIZ_SLICE_CLUB_COUNT, `${base}:clubs`),
    stadiums: pickSlice(dataset.stadiums, QUIZ_SLICE_STADIUM_COUNT, `${base}:stadiums`),
  };
}

export async function buildQuizEntityDataset(): Promise<QuizDatasetBuildResult> {
  const [teamPlayers, cachedTeams, playerInfoRows] = await Promise.all([
    prisma.teamPlayer.findMany({
      include: { teamInfo: true },
    }),
    prisma.cachedTeam.findMany({
      where: { logo: { not: null } },
    }),
    prisma.playerInfo.findMany({
      where: { apiPlayerId: { not: null } },
      select: { apiPlayerId: true, apiContext: true },
      distinct: ['apiPlayerId'],
    }),
  ]);

  const playerInfoByApiId = new Map<number, ReturnType<typeof parsePlayerInfoFields>>();
  for (const row of playerInfoRows) {
    if (row.apiPlayerId == null) continue;
    playerInfoByApiId.set(row.apiPlayerId, parsePlayerInfoFields(row.apiContext));
  }

  const cachedByTeamId = new Map(cachedTeams.map((t) => [t.teamId, t]));

  const clubs: QuizDatasetClub[] = cachedTeams.map((t) => ({
    id: `team:${t.teamId}`,
    name: t.name,
    apiTeamId: t.teamId,
    country: t.country ?? undefined,
    founded: t.founded ?? undefined,
    logoUrl: t.logo ?? undefined,
  }));

  const stadiums: QuizDatasetStadium[] = cachedTeams
    .filter((t) => t.venueName?.trim() && t.venueImage?.trim())
    .map((t) => ({
      id: `venue:${t.teamId}`,
      name: t.venueName!.trim(),
      city: t.venueCity ?? undefined,
      capacity: t.venueCapacity ?? undefined,
      teamName: t.name,
      apiTeamId: t.teamId,
      imageUrl: t.venueImage ?? undefined,
    }));

  const players: QuizDatasetPlayer[] = [];
  const seenPlayerIds = new Set<number>();

  for (const tp of teamPlayers) {
    if (!tp.teamInfo || seenPlayerIds.has(tp.apiPlayerId)) continue;
    seenPlayerIds.add(tp.apiPlayerId);

    const cached = cachedByTeamId.get(tp.teamInfo.apiTeamId);
    const enrichment = playerInfoByApiId.get(tp.apiPlayerId) ?? {};

    players.push({
      id: `player:${tp.apiPlayerId}`,
      name: tp.playerName,
      apiPlayerId: tp.apiPlayerId,
      position: tp.position,
      jerseyNumber: tp.jerseyNumber ?? undefined,
      teamId: tp.teamInfo.apiTeamId,
      teamName: tp.teamInfo.teamName,
      country: cached?.country ?? undefined,
      ...enrichment,
    });
  }

  /*
   * Second local source: CachedPlayer.
   *
   * These are real player records already persisted by the player/search caches
   * and 365Scores lineups — same upstream identities as a squad snapshot, but
   * they cost no extra API-Football quota to read. Squad snapshots stay
   * authoritative (they carry the club relationship and shirt number); this only
   * tops the pool up so a thin TeamPlayer table does not block generation on its
   * own. Nothing is invented: a row without a club is skipped.
   */
  if (players.length < QUIZ_DATASET_MIN_PLAYERS) {
    const cachedPlayers = await prisma.cachedPlayer.findMany({
      where: { teamId: { not: null } },
      select: {
        playerId: true,
        name: true,
        position: true,
        teamId: true,
        teamName: true,
        nationality: true,
        age: true,
        birthDate: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    });

    for (const row of cachedPlayers) {
      if (!row.name?.trim() || row.teamId == null || seenPlayerIds.has(row.playerId)) continue;
      const teamName = row.teamName?.trim() || cachedByTeamId.get(row.teamId)?.name;
      if (!teamName) continue;
      seenPlayerIds.add(row.playerId);

      players.push({
        id: `player:${row.playerId}`,
        name: row.name.trim(),
        apiPlayerId: row.playerId,
        position: row.position?.trim() || 'Unknown',
        teamId: row.teamId,
        teamName,
        country: cachedByTeamId.get(row.teamId)?.country ?? undefined,
        nationality: row.nationality ?? undefined,
        age: row.age ?? undefined,
        birthdate: row.birthDate ?? undefined,
      });
    }
  }

  if (players.length < QUIZ_DATASET_MIN_PLAYERS) {
    const fallbackRows = await prisma.playerInfo.findMany({
      where: { apiPlayerId: { not: null }, teamId: { not: null } },
      include: { teamInfo: true },
      distinct: ['apiPlayerId'],
      orderBy: [{ accessCount: 'desc' }, { hits: 'desc' }],
      take: 300,
    });

    for (const row of fallbackRows) {
      if (row.apiPlayerId == null || !row.teamInfo || seenPlayerIds.has(row.apiPlayerId)) continue;
      seenPlayerIds.add(row.apiPlayerId);

      const cached = cachedByTeamId.get(row.teamInfo.apiTeamId);
      const enrichment = playerInfoByApiId.get(row.apiPlayerId) ?? {};

      players.push({
        id: `player:${row.apiPlayerId}`,
        name: row.displayName ?? row.playerName,
        apiPlayerId: row.apiPlayerId,
        position: 'Unknown',
        teamId: row.teamInfo.apiTeamId,
        teamName: row.teamInfo.teamName,
        country: cached?.country ?? undefined,
        ...enrichment,
      });
    }

    if (players.length < QUIZ_DATASET_MIN_PLAYERS && teamPlayers.length === 0) {
      logger.info('[QuizDataset] TeamPlayer empty — filled from PlayerInfo+TeamInfo where linked');
    }
  }

  const dataset: QuizEntityDataset = { players, clubs, stadiums };

  if (!isDatasetSufficient(dataset)) {
    logger.warn('[QuizDataset] Insufficient entity pool', {
      players: players.length,
      clubs: clubs.length,
      stadiums: stadiums.length,
      required: {
        players: QUIZ_DATASET_MIN_PLAYERS,
        clubs: QUIZ_DATASET_MIN_CLUBS,
        stadiums: QUIZ_DATASET_MIN_STADIUMS,
      },
    });
    return {
      ok: false,
      reason: 'INSUFFICIENT_DATA',
      counts: { players: players.length, clubs: clubs.length, stadiums: stadiums.length },
    };
  }

  return { ok: true, dataset };
}

/** Attach campaign-specific entities (e.g. national teams for WORLD_CUP). */
export function enrichSliceForTheme(slice: QuizEntitySlice, theme: QuizTheme): QuizEntitySlice {
  if (!getQuizThemeCampaign(theme)) return slice;

  if (theme === QuizTheme.WORLD_CUP) {
    const byId = new Map<string, QuizDatasetNation>();
    for (const nation of buildWorldCupNations()) {
      byId.set(nation.id, nation);
    }
    for (const player of slice.players) {
      for (const label of [player.nationality, player.country]) {
        if (!label?.trim()) continue;
        const id = `nation:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        if (!byId.has(id)) {
          byId.set(id, { id, name: label.trim() });
        }
      }
    }
    return { ...slice, nations: [...byId.values()] };
  }

  return slice;
}

export function resolveNationIdInSlice(slice: QuizEntitySlice, textOrId: string): string | null {
  const nations = slice.nations;
  if (!nations?.length) return null;

  const trimmed = textOrId.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('nation:')) {
    return nations.find((n) => n.id === trimmed)?.id ?? null;
  }

  let bestId: string | null = null;
  let bestScore = 0;
  for (const nation of nations) {
    const labels = [nation.name, ...(nation.aliases ?? [])];
    for (const label of labels) {
      const score = scoreEntityNameMatch(trimmed, label);
      if (score > bestScore && score >= 0.78) {
        bestScore = score;
        bestId = nation.id;
      }
    }
  }
  return bestId;
}

/** Resolve option text or entityId to a dataset entity id. */
export function resolveEntityIdInSlice(
  slice: QuizEntitySlice,
  textOrId: string,
  category: 'player' | 'club' | 'stadium',
): string | null {
  const trimmed = textOrId.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('player:') || trimmed.startsWith('team:') || trimmed.startsWith('venue:')) {
    const pool =
      trimmed.startsWith('player:') ? slice.players
      : trimmed.startsWith('venue:') ? slice.stadiums
      : slice.clubs;
    const found = pool.find((e) => e.id === trimmed);
    return found ? found.id : null;
  }

  const pool =
    category === 'player' ? slice.players
    : category === 'stadium' ? slice.stadiums
    : slice.clubs;

  let bestId: string | null = null;
  let bestScore = 0;
  for (const entity of pool) {
    const score = scoreEntityNameMatch(trimmed, entity.name);
    if (score > bestScore && score >= 0.78) {
      bestScore = score;
      bestId = entity.id;
    }
  }
  return bestId;
}

export function getEntityNameById(slice: QuizEntitySlice, entityId: string): string | null {
  if (entityId.startsWith('player:')) {
    return slice.players.find((p) => p.id === entityId)?.name ?? null;
  }
  if (entityId.startsWith('venue:')) {
    return slice.stadiums.find((s) => s.id === entityId)?.name ?? null;
  }
  if (entityId.startsWith('team:')) {
    return slice.clubs.find((c) => c.id === entityId)?.name ?? null;
  }
  if (entityId.startsWith('nation:')) {
    return slice.nations?.find((n) => n.id === entityId)?.name ?? null;
  }
  return null;
}

export function getDatasetPlayer(slice: QuizEntitySlice, entityId: string): QuizDatasetPlayer | null {
  return slice.players.find((p) => p.id === entityId) ?? null;
}
