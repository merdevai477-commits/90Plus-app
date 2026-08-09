/**
 * Knowledge Export service — read-only adapter over production Cached365PlayerCareer.
 *
 * Season-aware membership + stats come ONLY from 365 career rows (seasonKey).
 * No generic HTTP season= assumption. No fabricated athleteId↔playerId mapping.
 * Coverage is PARTIAL: cache is not a complete competition roster index.
 */

import prisma from '../lib/prisma';
import { scores365CompetitionToLeagueId } from '../utils/scores365-league-id.util';
import {
  KnowledgeSeason,
  isValidSeasonKey,
  normalizeSeasonKey,
  resolveKnowledgeSeason,
  resolveKnowledgeSeasonFromObservations,
} from '../utils/knowledge-season-resolver.util';
import { logger } from '../utils/logger';

export const KNOWLEDGE_EXPORT_SCHEMA_VERSION = '1.0';
export const KNOWLEDGE_MEMBERSHIP_SOURCE = 'production_365_career' as const;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 250;
const SCHEMA_PROVIDER = '90plus';

export type CoverageStatus = 'FULL' | 'PARTIAL' | 'UNKNOWN';

export interface KnowledgeCoverage {
  status: CoverageStatus;
  membershipSource: typeof KNOWLEDGE_MEMBERSHIP_SOURCE | 'unknown' | 'mixed';
  reason: string;
  seasonSpecific: boolean;
}

export interface KnowledgePlayerStatistics {
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  yellowCards: number | null;
  redCards: number | null;
  rating: number | null;
}

export interface KnowledgeExportPlayer {
  athleteId: number;
  playerId: null;
  name: string;
  position: string | null;
  nationality: string | null;
  season: {
    seasonKey: string;
    seasonLabel: string;
  };
  statistics: KnowledgePlayerStatistics;
  source: {
    provider: typeof SCHEMA_PROVIDER;
    apiLayer: '365';
    cacheTable: 'cached_365_player_career';
  };
}

export interface KnowledgeExportTeam {
  teamId: number | null;
  name: string | null;
  players: KnowledgeExportPlayer[];
}

export interface KnowledgeCompetitionMeta {
  competitionId: number;
  leagueId: number;
  name: string | null;
  country: string | null;
}

export interface KnowledgeDatasetMeta {
  provider: typeof SCHEMA_PROVIDER;
  seasonKey: string;
  seasonLabel: string;
  seasonResolveSource: KnowledgeSeason['source'];
  generatedAt: string;
  schemaVersion: typeof KNOWLEDGE_EXPORT_SCHEMA_VERSION;
}

export interface KnowledgePagination {
  cursor: number | null;
  nextCursor: number | null;
  hasMore: boolean;
  pageSize: number;
  scannedAthletes: number;
}

export interface CareerSeasonRow {
  seasonKey: string;
  label: string;
  competitions: Array<{
    competitionId: number | null;
    competitionName: string;
    teamId: number | null;
    teamName: string | null;
    appearances: number | null;
    goals: number | null;
    assists: number | null;
    minutes: number | null;
    yellowCards: number | null;
    redCards: number | null;
    rating: number | null;
  }>;
}

export interface CareerExportRow {
  athleteId: number;
  name: string;
  position: string | null;
  nationality: string | null;
  seasons: CareerSeasonRow[];
}

export interface CompetitionExportResult {
  status: 'success';
  dataset: KnowledgeDatasetMeta;
  competition: KnowledgeCompetitionMeta;
  coverage: KnowledgeCoverage;
  standings: null;
  standingsAvailability: 'not_season_proven';
  fixtures: null;
  fixturesAvailability: 'not_season_proven';
  teamStatistics: null;
  teamStatisticsAvailability: 'not_season_proven';
  teams: KnowledgeExportTeam[];
  pagination: KnowledgePagination;
  metrics: {
    teamCount: number;
    playerCount: number;
    statisticFieldCount: number;
  };
}

function clampPageSize(raw?: number): number {
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(raw)));
}

function countStatFields(stats: KnowledgePlayerStatistics): number {
  return Object.values(stats).filter((v) => v != null).length;
}

export function careerRowFromDb(athleteId: number, name: string, data: unknown): CareerExportRow | null {
  const d = data as {
    profile?: { name?: string; position?: string | null; nationality?: string | null };
    seasons?: CareerSeasonRow[];
  } | null;
  if (!d || !Array.isArray(d.seasons)) return null;
  return {
    athleteId,
    name: d.profile?.name || name || '—',
    position: d.profile?.position ?? null,
    nationality: d.profile?.nationality ?? null,
    seasons: d.seasons.map((s) => ({
      seasonKey: String(s.seasonKey),
      label: String(s.label ?? s.seasonKey),
      competitions: Array.isArray(s.competitions) ? s.competitions : [],
    })),
  };
}

export function buildCompetitionExportFromCareers(
  careers: CareerExportRow[],
  seasonKeyRaw: string | number,
  competitionId: number,
  options?: {
    teamId?: number | null;
    generatedAt?: string;
    pagination?: KnowledgePagination;
  },
): CompetitionExportResult {
  const seasonKey = normalizeSeasonKey(seasonKeyRaw);
  if (!seasonKey) {
    throw new Error('INVALID_SEASON_KEY');
  }
  if (!Number.isFinite(competitionId) || competitionId <= 0) {
    throw new Error('INVALID_COMPETITION_ID');
  }

  const observedLabels: string[] = [];
  const teamMap = new Map<string, KnowledgeExportTeam>();
  let competitionName: string | null = null;
  let playerCount = 0;
  let statisticFieldCount = 0;
  const seenAthletes = new Set<number>();

  for (const career of careers) {
    const season = career.seasons.find((s) => normalizeSeasonKey(s.seasonKey) === seasonKey);
    if (!season) continue;
    observedLabels.push(season.label);

    for (const comp of season.competitions) {
      if (comp.competitionId !== competitionId) continue;
      if (options?.teamId != null && comp.teamId !== options.teamId) continue;

      if (!competitionName && comp.competitionName) {
        competitionName = comp.competitionName;
      }

      if (seenAthletes.has(career.athleteId)) {
        // Same athlete can appear once per team/comp row; allow multi-team but not duplicate athlete+team
      }

      const teamKey = comp.teamId != null ? `id:${comp.teamId}` : `name:${comp.teamName ?? 'unknown'}`;
      let team = teamMap.get(teamKey);
      if (!team) {
        team = {
          teamId: comp.teamId,
          name: comp.teamName,
          players: [],
        };
        teamMap.set(teamKey, team);
      }

      const already = team.players.some((p) => p.athleteId === career.athleteId);
      if (already) continue;

      const resolved = resolveKnowledgeSeason(seasonKey, season.label);
      const statistics: KnowledgePlayerStatistics = {
        appearances: comp.appearances ?? null,
        minutes: comp.minutes ?? null,
        goals: comp.goals ?? null,
        assists: comp.assists ?? null,
        yellowCards: comp.yellowCards ?? null,
        redCards: comp.redCards ?? null,
        rating: comp.rating ?? null,
      };

      team.players.push({
        athleteId: career.athleteId,
        playerId: null,
        name: career.name,
        position: career.position,
        nationality: career.nationality,
        season: {
          seasonKey: resolved.seasonKey,
          seasonLabel: resolved.seasonLabel,
        },
        statistics,
        source: {
          provider: SCHEMA_PROVIDER,
          apiLayer: '365',
          cacheTable: 'cached_365_player_career',
        },
      });
      seenAthletes.add(career.athleteId);
      playerCount += 1;
      statisticFieldCount += countStatFields(statistics);
    }
  }

  const seasonMeta = resolveKnowledgeSeasonFromObservations(seasonKey, observedLabels);
  const teams = [...teamMap.values()].sort((a, b) =>
    String(a.name ?? '').localeCompare(String(b.name ?? '')),
  );

  const pagination: KnowledgePagination = options?.pagination ?? {
    cursor: null,
    nextCursor: null,
    hasMore: false,
    pageSize: careers.length,
    scannedAthletes: careers.length,
  };

  return {
    status: 'success',
    dataset: {
      provider: SCHEMA_PROVIDER,
      seasonKey: seasonMeta.seasonKey,
      seasonLabel: seasonMeta.seasonLabel,
      seasonResolveSource: seasonMeta.source,
      generatedAt: options?.generatedAt ?? new Date().toISOString(),
      schemaVersion: KNOWLEDGE_EXPORT_SCHEMA_VERSION,
    },
    competition: {
      competitionId,
      leagueId: scores365CompetitionToLeagueId(competitionId),
      name: competitionName,
      country: null,
    },
    coverage: {
      status: 'PARTIAL',
      membershipSource: KNOWLEDGE_MEMBERSHIP_SOURCE,
      reason:
        'Team/player membership is derived from Cached365PlayerCareer rows for the requested seasonKey. ' +
        'This is not a complete competition roster index; only athletes previously cached in production are included.',
      seasonSpecific: true,
    },
    standings: null,
    standingsAvailability: 'not_season_proven',
    fixtures: null,
    fixturesAvailability: 'not_season_proven',
    teamStatistics: null,
    teamStatisticsAvailability: 'not_season_proven',
    teams,
    pagination,
    metrics: {
      teamCount: teams.length,
      playerCount,
      statisticFieldCount,
    },
  };
}

export function listCompetitionsFromCareers(
  careers: CareerExportRow[],
  seasonKeyRaw: string | number,
): {
  season: KnowledgeSeason;
  competitions: Array<{
    competitionId: number;
    leagueId: number;
    name: string | null;
    teamCount: number;
    playerCount: number;
  }>;
  coverage: KnowledgeCoverage;
} {
  const seasonKey = normalizeSeasonKey(seasonKeyRaw);
  if (!seasonKey) throw new Error('INVALID_SEASON_KEY');

  const observedLabels: string[] = [];
  const map = new Map<
    number,
    { competitionId: number; name: string | null; teams: Set<string>; players: Set<number> }
  >();

  for (const career of careers) {
    const season = career.seasons.find((s) => normalizeSeasonKey(s.seasonKey) === seasonKey);
    if (!season) continue;
    observedLabels.push(season.label);
    for (const comp of season.competitions) {
      if (comp.competitionId == null) continue;
      let entry = map.get(comp.competitionId);
      if (!entry) {
        entry = {
          competitionId: comp.competitionId,
          name: comp.competitionName ?? null,
          teams: new Set(),
          players: new Set(),
        };
        map.set(comp.competitionId, entry);
      }
      if (!entry.name && comp.competitionName) entry.name = comp.competitionName;
      entry.teams.add(comp.teamId != null ? `id:${comp.teamId}` : `name:${comp.teamName ?? '?'}`);
      entry.players.add(career.athleteId);
    }
  }

  const season = resolveKnowledgeSeasonFromObservations(seasonKey, observedLabels);
  const competitions = [...map.values()]
    .map((c) => ({
      competitionId: c.competitionId,
      leagueId: scores365CompetitionToLeagueId(c.competitionId),
      name: c.name,
      teamCount: c.teams.size,
      playerCount: c.players.size,
    }))
    .sort((a, b) => a.competitionId - b.competitionId);

  return {
    season,
    competitions,
    coverage: {
      status: 'PARTIAL',
      membershipSource: KNOWLEDGE_MEMBERSHIP_SOURCE,
      reason:
        'Competition membership for this season is discovered from cached 365 career rows only; ' +
        'season-specific competition catalog membership is unavailable as a complete index.',
      seasonSpecific: true,
    },
  };
}

export function listSeasonsFromCareers(careers: CareerExportRow[]): KnowledgeSeason[] {
  const byKey = new Map<string, string[]>();
  for (const career of careers) {
    for (const s of career.seasons) {
      const key = normalizeSeasonKey(s.seasonKey);
      if (!key) continue;
      const arr = byKey.get(key) ?? [];
      arr.push(s.label);
      byKey.set(key, arr);
    }
  }
  return [...byKey.keys()]
    .sort((a, b) => Number(b) - Number(a))
    .map((key) => resolveKnowledgeSeasonFromObservations(key, byKey.get(key) ?? []));
}

class KnowledgeExportService {
  async listSeasons(): Promise<{
    status: 'success';
    seasons: KnowledgeSeason[];
    coverage: KnowledgeCoverage;
    scannedAthletes: number;
    generatedAt: string;
  }> {
    const started = Date.now();
    const rows = await prisma.cached365PlayerCareer.findMany({
      select: { athleteId: true, name: true, data: true },
      orderBy: { athleteId: 'asc' },
      take: 2000,
    });

    const careers: CareerExportRow[] = [];
    for (const row of rows) {
      const parsed = careerRowFromDb(row.athleteId, row.name, row.data);
      if (parsed) careers.push(parsed);
    }

    const seasons = listSeasonsFromCareers(careers);
    logger.info('[KnowledgeExport] listSeasons', {
      scannedAthletes: rows.length,
      seasonCount: seasons.length,
      durationMs: Date.now() - started,
    });

    return {
      status: 'success',
      seasons,
      coverage: {
        status: 'PARTIAL',
        membershipSource: KNOWLEDGE_MEMBERSHIP_SOURCE,
        reason: 'Seasons listed from Cached365PlayerCareer observations (bounded scan).',
        seasonSpecific: true,
      },
      scannedAthletes: rows.length,
      generatedAt: new Date().toISOString(),
    };
  }

  async getSeasonSummary(seasonKeyRaw: string | number): Promise<{
    status: 'success';
    dataset: KnowledgeDatasetMeta;
    coverage: KnowledgeCoverage;
    competitions: Array<{
      competitionId: number;
      leagueId: number;
      name: string | null;
      teamCount: number;
      playerCount: number;
    }>;
    scannedAthletes: number;
  }> {
    if (!isValidSeasonKey(seasonKeyRaw)) throw new Error('INVALID_SEASON_KEY');
    const started = Date.now();
    const seasonKey = normalizeSeasonKey(seasonKeyRaw)!;

    const rows = await prisma.cached365PlayerCareer.findMany({
      select: { athleteId: true, name: true, data: true },
      orderBy: { athleteId: 'asc' },
      take: 5000,
    });

    const careers: CareerExportRow[] = [];
    for (const row of rows) {
      const parsed = careerRowFromDb(row.athleteId, row.name, row.data);
      if (parsed) careers.push(parsed);
    }

    const listed = listCompetitionsFromCareers(careers, seasonKey);
    logger.info('[KnowledgeExport] getSeasonSummary', {
      seasonKey,
      competitionCount: listed.competitions.length,
      scannedAthletes: rows.length,
      coverage: listed.coverage.status,
      durationMs: Date.now() - started,
    });

    return {
      status: 'success',
      dataset: {
        provider: SCHEMA_PROVIDER,
        seasonKey: listed.season.seasonKey,
        seasonLabel: listed.season.seasonLabel,
        seasonResolveSource: listed.season.source,
        generatedAt: new Date().toISOString(),
        schemaVersion: KNOWLEDGE_EXPORT_SCHEMA_VERSION,
      },
      coverage: listed.coverage,
      competitions: listed.competitions,
      scannedAthletes: rows.length,
    };
  }

  async exportCompetition(params: {
    seasonKey: string | number;
    competitionId: number;
    cursor?: number | null;
    pageSize?: number;
    teamId?: number | null;
  }): Promise<CompetitionExportResult> {
    if (!isValidSeasonKey(params.seasonKey)) throw new Error('INVALID_SEASON_KEY');
    if (!Number.isFinite(params.competitionId) || params.competitionId <= 0) {
      throw new Error('INVALID_COMPETITION_ID');
    }

    const started = Date.now();
    const pageSize = clampPageSize(params.pageSize);
    const cursor = params.cursor != null && Number.isFinite(params.cursor) ? params.cursor : null;

    const rows = await prisma.cached365PlayerCareer.findMany({
      where: cursor != null ? { athleteId: { gt: cursor } } : undefined,
      select: { athleteId: true, name: true, data: true },
      orderBy: { athleteId: 'asc' },
      take: pageSize,
    });

    const careers: CareerExportRow[] = [];
    for (const row of rows) {
      const parsed = careerRowFromDb(row.athleteId, row.name, row.data);
      if (parsed) careers.push(parsed);
    }

    const lastAthleteId = rows.length ? rows[rows.length - 1].athleteId : null;
    const hasMore = rows.length === pageSize;

    const result = buildCompetitionExportFromCareers(
      careers,
      params.seasonKey,
      params.competitionId,
      {
        teamId: params.teamId ?? null,
        pagination: {
          cursor,
          nextCursor: hasMore ? lastAthleteId : null,
          hasMore,
          pageSize,
          scannedAthletes: rows.length,
        },
      },
    );

    // Detect season/competition mismatch: scanned athletes but zero players for this competition
    if (rows.length > 0 && result.metrics.playerCount === 0 && !hasMore && cursor == null) {
      // Full first-page empty with no more pages — still return PARTIAL empty rather than inventing
      result.coverage.reason =
        'No Cached365PlayerCareer rows prove membership for this competitionId in the requested seasonKey ' +
        '(within scanned cache). Season-specific competition membership may be unavailable or empty.';
    }

    logger.info('[KnowledgeExport] exportCompetition', {
      seasonKey: result.dataset.seasonKey,
      competitionId: params.competitionId,
      teamId: params.teamId ?? null,
      teamCount: result.metrics.teamCount,
      playerCount: result.metrics.playerCount,
      statisticFieldCount: result.metrics.statisticFieldCount,
      coverage: result.coverage.status,
      scannedAthletes: rows.length,
      hasMore,
      durationMs: Date.now() - started,
    });

    return result;
  }
}

export const knowledgeExportService = new KnowledgeExportService();
