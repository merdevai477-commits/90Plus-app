/**
 * 365Scores — secondary World Cup data source.
 * Each public method maps to exactly one upstream endpoint (Single Responsibility).
 * Controllers must not call this directly; use football-data-cache.service wrappers.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';
import { matchCacheService, type FixtureFromAPI } from './match-cache.service';
import { leagueCacheService } from './league-cache.service';
import {
  getScores365CompetitionId,
  isScores365ExperimentEnabled,
  mapScores365ToApiFootballFixture,
  registerScores365FixtureMapping,
  resolveScores365LangId,
  scores365CompetitionToLeagueId,
  SCORES365_LEAGUE_ID_OFFSET,
  synthesizeBaseFrom365Game,
} from './scores365-experiment.service';
import { buildScores365AthletePhotoUrl } from '../utils/scores365-athlete-photo';

const BASE_URL = 'https://webws.365scores.com';

/**
 * 365Scores competition (league) logo URL.
 * Verified pattern: `<transforms>/v<imageVersion>/Competitions/<competitionId>`
 * (a bogus competitionId 404s; the `imageVersion` is the `v{n}` path segment).
 */
function buildLeagueLogoUrl(competitionId: number, imageVersion: number | null): string | null {
  if (imageVersion == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v${imageVersion}/Competitions/${competitionId}`;
}

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.365scores.com/',
  Origin: 'https://www.365scores.com',
};

export type ThreeSixFiveDataSource = '365scores';

export interface ThreeSixFiveResult<T> {
  data: T | null;
  source: ThreeSixFiveDataSource | null;
}

export type ThreeSixFiveMatchPhase = 'upcoming' | 'live' | 'finished';

export interface ThreeSixFiveFixtureItem {
  gameId: number;
  phase: ThreeSixFiveMatchPhase;
  startTime?: string;
  homeName?: string;
  awayName?: string;
  homeScore: number | null;
  awayScore: number | null;
  statusText?: string;
  competitionId?: number;
  raw: Scores365Game;
}

export interface ThreeSixFiveLiveGameDetails {
  gameId: number;
  minute: number | null;
  minuteDisplay?: string;
  homeScore: number | null;
  awayScore: number | null;
  statusText?: string;
  shortStatusText?: string;
  phase: ThreeSixFiveMatchPhase;
  homeLineupMemberIds: number[];
  awayLineupMemberIds: number[];
  lineupsStatus?: string;
  lineupsConfirmed: boolean;
  raw: Scores365Game;
}

export interface ThreeSixFiveLineupPlayer {
  side: 'home' | 'away';
  memberId: number;
  athleteId: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  position: string | null;
  formation: string | null;
  imageVersion: number | null;
  imageUrl: string | null;
  stats?: unknown[];
}

export interface ThreeSixFiveStandingRow {
  groupNum: number;
  groupName: string | null;
  position: number;
  teamId: number;
  teamName: string;
  teamLogo: string;
  gamePlayed: number;
  gamesWon: number;
  gamesEven: number;
  gamesLost: number;
  goalsFor: number;
  goalsAgainst: number;
  ratio: number;
  points: number;
}

export interface ThreeSixFiveTeamForm {
  teamId: number;
  teamName: string;
  recentGames: Scores365Game[];
}

export interface ThreeSixFiveHeadToHeadForm {
  home: ThreeSixFiveTeamForm | null;
  away: ThreeSixFiveTeamForm | null;
}

export interface ThreeSixFivePlayerMatchReport {
  athleteId: number;
  gameId: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  position: string | null;
  formation: string | null;
  imageUrl: string | null;
  stats: unknown[];
  chartEvents: unknown[];
}

export interface ThreeSixFivePlayerCareerShotChart {
  athleteId: number;
  mostCommonGoalZone?: unknown;
  penaltyGoals?: number;
  penaltyConversions?: number;
  events: unknown[];
}

export interface ThreeSixFivePlayerBasicInfo {
  athleteId: number;
  name: string;
  shortName?: string;
  club?: string;
  nationality?: string;
  position?: string;
  imageUrl?: string | null;
  nextGame?: unknown;
  raw: unknown;
}

interface Scores365Game {
  id: number;
  sportId?: number;
  competitionId?: number;
  competitionDisplayName?: string;
  statusId?: number;
  statusGroup?: number;
  statusText?: string;
  shortStatusText?: string;
  startTime?: string;
  gameTime?: number;
  gameTimeDisplay?: string;
  lineupsStatus?: number;
  lineupsStatusText?: string;
  homeCompetitor?: Scores365Competitor;
  awayCompetitor?: Scores365Competitor;
  events?: unknown[];
  members?: Scores365Member[];
  h2hGames?: Record<string, Scores365Game[]>;
  recentGames?: Scores365Game[];
}

interface Scores365Competitor {
  id: number;
  name: string;
  score?: number;
  recentGames?: Scores365Game[];
  lineups?: {
    status?: string;
    formation?: string;
    members?: Array<{ id: number; status?: number }>;
  };
}

interface Scores365Member {
  id: number;
  athleteId?: number;
  competitorId?: number;
  name?: string;
  shortName?: string;
  jerseyNumber?: number;
  position?: { name?: string; shortName?: string };
  formation?: { name?: string; shortName?: string };
  imageVersion?: number;
  stats?: unknown[];
}

interface FixturesPayload {
  games?: Scores365Game[];
  paging?: { previousPage?: string; nextPage?: string };
}

interface Scores365CompetitionMeta {
  id: number;
  countryId?: number;
  name?: string;
  imageVersion?: number;
  hasStandings?: boolean;
}

interface Scores365CountryMeta {
  id: number;
  name?: string;
}

interface AllScoresPayload {
  games?: Scores365Game[];
  competitions?: Scores365CompetitionMeta[];
  countries?: Scores365CountryMeta[];
}

/** competitionId → resolved league metadata (for synthetic non-WC fixtures + league cache). */
interface CompetitionMeta {
  name?: string;
  country?: string;
  logo?: string;
  hasStandings?: boolean;
}
type CompetitionMetaMap = Map<number, CompetitionMeta>;

interface GamePayload {
  game?: Scores365Game;
}

interface LineupsPayload {
  members?: Scores365Member[];
  chartEvents?: { events?: unknown[] };
}

interface StandingsPayload {
  standings?: Array<{
    groups?: Array<{ num: number; name: string }>;
    rows?: Array<{
      groupNum: number;
      position: number;
      gamePlayed: number;
      gamesWon: number;
      gamesEven: number;
      gamesLost: number;
      for: number;
      against: number;
      ratio: number;
      points: number;
      competitor?: { id: number; name: string; imageVersion?: number };
    }>;
  }>;
}

interface ChartEventsPayload {
  athletes?: Array<{
    id?: number;
    athleteId?: number;
    chartEvents?: {
      mostCommonGoalZone?: unknown;
      penaltyGoals?: number;
      penaltyConversions?: number;
      events?: unknown[];
    };
  }>;
}

interface NextGamePayload {
  athletes?: Array<Record<string, unknown>>;
}

const LIVE_GAME_MIN_INTERVAL_MS = 3_000;
const LIVE_POLL_INTERVAL_MS = 4_000;
const LIVE_SUBSCRIPTION_TTL_MS = 45_000;
const FINISHED_UPSERTED_KEY_PREFIX = '365:finished-upserted:';

class ThreeSixFiveScoresService {
  private lastUpstreamFetch = new Map<string, number>();
  private inFlight = new Map<string, Promise<unknown>>();
  private liveSubscriptions = new Map<number, { expiresAt: number }>();
  private livePollTimer: ReturnType<typeof setInterval> | null = null;

  isEnabled(): boolean {
    return isScores365ExperimentEnabled();
  }

  /** Extend live-view subscription (ref-count via TTL refresh from cache wrappers). */
  touchLiveGameSubscription(gameId: number): void {
    this.liveSubscriptions.set(gameId, { expiresAt: Date.now() + LIVE_SUBSCRIPTION_TTL_MS });
    this.ensureLivePollLoop();
  }

  // ─── 1. Fixtures (paginated) ─────────────────────────────────────────────

  async getFixtures(
    competitionId: number = getScores365CompetitionId(),
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveFixtureItem[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:fixtures:${competitionId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveFixtureItem[]>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const inflightKey = `fixtures:${competitionId}:${langId}`;
      const existing = this.inFlight.get(inflightKey);
      if (existing) {
        const data = (await existing) as ThreeSixFiveFixtureItem[] | null;
        return { data, source: data ? '365scores' : null };
      }

      const promise = this.fetchAllFixtures(competitionId, langId);
      this.inFlight.set(inflightKey, promise);
      const games = await promise.finally(() => this.inFlight.delete(inflightKey));

      if (!games?.length) return { data: null, source: null };

      const items = games.map((g) => this.toFixtureItem(g));
      const hasLive = items.some((i) => i.phase === 'live');
      const ttlMs = hasLive ? 60_000 : 300_000;
      await redisCacheService.set(cacheKey, items, ttlMs);

      await this.persistFinishedFixtures(items);

      return { data: items, source: '365scores' };
    } catch (err: unknown) {
      logger.error('[365Scores] getFixtures failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── 1b. All scores (date range, all leagues) ────────────────────────────

  async getAllScores(
    startDate: string,
    endDate: string,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveFixtureItem[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:allscores:${startDate}:${endDate}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveFixtureItem[]>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const path =
        `/web/games/allscores/?${this.commonParams(langId)}` +
        `&sports=1&startDate=${encodeURIComponent(startDate)}` +
        `&endDate=${encodeURIComponent(endDate)}&showOdds=true&onlyMajorGames=true&withTop=true`;

      const payload = await this.fetchJson<AllScoresPayload>(
        path,
        `allscores:${startDate}:${endDate}`,
        120_000,
      );
      if (!payload?.games?.length) return { data: null, source: null };

      const competitionMeta = this.buildCompetitionMeta(payload);
      const items = payload.games.map((g) => this.toFixtureItem(g));
      await redisCacheService.set(cacheKey, items, 120_000);
      await this.persistAllScoresFixtures(items, competitionMeta);

      return { data: items, source: '365scores' };
    } catch (err: unknown) {
      logger.error('[365Scores] getAllScores failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── 2. Live game details ────────────────────────────────────────────────

  async getLiveGameDetails(
    gameId: number,
    matchupId?: string,
    options?: { language?: string | null; force?: boolean },
  ): Promise<ThreeSixFiveResult<ThreeSixFiveLiveGameDetails>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(options?.language);
      const rateKey = `game:${gameId}:${langId}`;
      const cacheKey = `365:game:${gameId}:${langId}`;

      if (!options?.force) {
        const cached = await redisCacheService.get<ThreeSixFiveLiveGameDetails>(cacheKey);
        if (cached) {
          if (cached.phase === 'live') this.touchLiveGameSubscription(gameId);
          return { data: cached, source: '365scores' };
        }
      }

      if (!options?.force && !this.canFetchUpstream(rateKey, LIVE_GAME_MIN_INTERVAL_MS)) {
        const stale = await redisCacheService.get<ThreeSixFiveLiveGameDetails>(cacheKey);
        if (stale) return { data: stale, source: '365scores' };
      }

      const game = await this.fetchGameUpstream(gameId, langId, matchupId);
      if (!game) return { data: null, source: null };

      const phase = this.classifyPhase(game);
      if (phase !== 'live') {
        logger.warn(
          `[365Scores] getLiveGameDetails refused for game ${gameId}: phase=${phase}`,
        );
        if (phase === 'finished') {
          await this.getFixtures(getScores365CompetitionId(), options?.language);
        }
        return { data: null, source: null };
      }

      const details = this.toLiveGameDetails(game);
      await redisCacheService.set(cacheKey, details, LIVE_GAME_MIN_INTERVAL_MS);
      this.touchLiveGameSubscription(gameId);
      return { data: details, source: '365scores' };
    } catch (err: unknown) {
      logger.error(`[365Scores] getLiveGameDetails(${gameId}) failed:`, (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── 3. Lineups with names ───────────────────────────────────────────────

  async getLineupsWithNames(
    gameId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveLineupPlayer[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:lineups:${gameId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveLineupPlayer[]>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const gameResult = await this.fetchGameUpstream(gameId, langId);
      if (!gameResult) return { data: null, source: null };

      const phase = this.classifyPhase(gameResult);
      const hasStructuredLineups =
        (gameResult.homeCompetitor?.lineups?.members?.length ?? 0) > 0 ||
        (gameResult.awayCompetitor?.lineups?.members?.length ?? 0) > 0;
      if (phase === 'upcoming' && !hasStructuredLineups) {
        return { data: null, source: null };
      }

      const homeIds = new Set(
        (gameResult.homeCompetitor?.lineups?.members ?? []).map((m) => m.id),
      );
      const awayIds = new Set(
        (gameResult.awayCompetitor?.lineups?.members ?? []).map((m) => m.id),
      );
      const lineupsConfirmed = gameResult.lineupsStatus === 1;

      const payload = await this.fetchJson<LineupsPayload>(
        `/web/athletes/games/lineups?${this.commonParams(langId)}&gameId=${gameId}`,
        `lineups:${gameId}`,
        120_000,
      );

      const memberCount = payload?.members?.length ?? 0;
      logger.info(
        `[365Scores] getLineupsWithNames(${gameId}): received ${memberCount} member records from athletes/lineups (homeIds=${homeIds.size}, awayIds=${awayIds.size})`,
      );

      if (!memberCount) return { data: null, source: null };

      const players: ThreeSixFiveLineupPlayer[] = (payload!.members!).map((m) => {
        const side: 'home' | 'away' = homeIds.has(m.id)
          ? 'home'
          : awayIds.has(m.id)
            ? 'away'
            : m.competitorId === gameResult.homeCompetitor?.id
              ? 'home'
              : 'away';
        const athleteId = m.athleteId ?? m.id;
        const imageVersion = m.imageVersion ?? null;
        return {
          side,
          memberId: m.id,
          athleteId,
          name: m.name ?? '—',
          shortName: m.shortName ?? m.name ?? '—',
          jerseyNumber: m.jerseyNumber ?? null,
          position: m.position?.shortName ?? m.position?.name ?? null,
          formation: m.formation?.shortName ?? m.formation?.name ?? null,
          imageVersion,
          imageUrl: buildScores365AthletePhotoUrl(athleteId, 68),
          stats: m.stats,
        };
      });

      // Per-side completeness audit.
      const homePlayers = players.filter((p) => p.side === 'home');
      const awayPlayers = players.filter((p) => p.side === 'away');
      logger.info(
        `[365Scores] getLineupsWithNames(${gameId}): resolved home=${homePlayers.length}/${homeIds.size} away=${awayPlayers.length}/${awayIds.size} (confirmed=${lineupsConfirmed})`,
      );

      // Log join misses (member IDs present in game payload but absent in athletes response).
      for (const id of homeIds) {
        if (!players.some((p) => p.memberId === id)) {
          logger.warn(
            `[365Scores] getLineupsWithNames(${gameId}): home member id=${id} missing from athletes/lineups response — join miss`,
          );
        }
      }
      for (const id of awayIds) {
        if (!players.some((p) => p.memberId === id)) {
          logger.warn(
            `[365Scores] getLineupsWithNames(${gameId}): away member id=${id} missing from athletes/lineups response — join miss`,
          );
        }
      }

      // Completeness gate: do NOT cache a confirmed lineup that is still incomplete.
      if (lineupsConfirmed && (homePlayers.length < 11 || awayPlayers.length < 11)) {
        logger.warn(
          `[365Scores] getLineupsWithNames(${gameId}): confirmed lineup is incomplete (home=${homePlayers.length}, away=${awayPlayers.length}) — skipping cache`,
        );
        return { data: players, source: '365scores' }; // return but do NOT cache
      }

      await redisCacheService.set(cacheKey, players, phase === 'finished' ? 86_400_000 : 300_000);
      return { data: players, source: '365scores' };
    } catch (err: unknown) {
      logger.error(`[365Scores] getLineupsWithNames(${gameId}) failed:`, (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── 4. Standings ────────────────────────────────────────────────────────

  async getStandings(
    competitionId: number = getScores365CompetitionId(),
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveStandingRow[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:standings:${competitionId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveStandingRow[]>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<StandingsPayload>(
        `/web/standings/?${this.commonParams(langId)}&competitions=${competitionId}`,
        `standings:${competitionId}`,
        300_000,
      );
      if (!payload?.standings?.length) return { data: null, source: null };

      const rows: ThreeSixFiveStandingRow[] = [];
      for (const block of payload.standings) {
        const groupNames = new Map((block.groups ?? []).map((g) => [g.num, g.name]));
        for (const row of block.rows ?? []) {
          rows.push({
            groupNum: row.groupNum,
            groupName: groupNames.get(row.groupNum) ?? null,
            position: row.position,
            teamId: row.competitor?.id ?? 0,
            teamName: row.competitor?.name ?? '—',
            teamLogo: row.competitor?.id
              ? `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v${row.competitor.imageVersion ?? 1}/Competitors/${row.competitor.id}`
              : '',
            gamePlayed: row.gamePlayed,
            gamesWon: row.gamesWon,
            gamesEven: row.gamesEven,
            gamesLost: row.gamesLost,
            goalsFor: row.for,
            goalsAgainst: row.against,
            ratio: row.ratio,
            points: row.points,
          });
        }
      }

      await redisCacheService.set(cacheKey, rows, 300_000);
      return { data: rows, source: '365scores' };
    } catch (err: unknown) {
      logger.error('[365Scores] getStandings failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── 5. Head-to-head / recent form ───────────────────────────────────────

  async getHeadToHeadForm(
    gameId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveHeadToHeadForm>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:h2h:${gameId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveHeadToHeadForm>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<{ game?: Scores365Game }>(
        `/web/games/h2h/?${this.commonParams(langId)}&gameId=${gameId}&addMainOdds=true`,
        `h2h:${gameId}`,
        600_000,
      );
      const game = payload?.game;
      if (!game) return { data: null, source: null };

      const data: ThreeSixFiveHeadToHeadForm = {
        home: game.homeCompetitor
          ? {
              teamId: game.homeCompetitor.id,
              teamName: game.homeCompetitor.name,
              recentGames: game.homeCompetitor.recentGames ?? [],
            }
          : null,
        away: game.awayCompetitor
          ? {
              teamId: game.awayCompetitor.id,
              teamName: game.awayCompetitor.name,
              recentGames: game.awayCompetitor.recentGames ?? [],
            }
          : null,
      };

      await redisCacheService.set(cacheKey, data, 600_000);
      return { data, source: '365scores' };
    } catch (err: unknown) {
      logger.error(`[365Scores] getHeadToHeadForm(${gameId}) failed:`, (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── 6. Player match report ──────────────────────────────────────────────
  // 365Scores has no standalone player search/listing. athleteId must come from a
  // game lineup (/web/athletes/games/lineups?gameId=) or our CachedPlayer DB.

  async getPlayerMatchReport(
    athleteId: number,
    gameId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerMatchReport>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:player-report:${athleteId}:${gameId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFivePlayerMatchReport>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const [playerPayload, gameLineups] = await Promise.all([
        this.fetchJson<LineupsPayload>(
          `/web/athletes/games/lineups?${this.commonParams(langId)}&athleteId=${athleteId}&gameId=${gameId}`,
          `player-report:${athleteId}:${gameId}`,
          300_000,
        ),
        this.fetchJson<LineupsPayload>(
          `/web/athletes/games/lineups?${this.commonParams(langId)}&gameId=${gameId}`,
          `lineups-chart:${gameId}`,
          120_000,
        ),
      ]);

      // Callers may pass 365 memberId (game.members[].id) instead of athleteId — resolve from full lineup.
      let member = playerPayload?.members?.[0];
      if (!member && gameLineups?.members?.length) {
        member = gameLineups.members.find(
          (m) => m.athleteId === athleteId || m.id === athleteId,
        );
      }
      if (!member) return { data: null, source: null };

      const aid = member.athleteId ?? member.id;
      const allEvents = gameLineups?.chartEvents?.events ?? [];
      const chartEvents = Array.isArray(allEvents)
        ? allEvents.filter((ev) => {
            const e = ev as { athleteId?: number; playerId?: number; memberId?: number };
            return (
              e.athleteId === aid ||
              e.playerId === aid ||
              e.athleteId === member!.id ||
              e.playerId === member!.id ||
              e.memberId === member!.id
            );
          })
        : [];

      const report: ThreeSixFivePlayerMatchReport = {
        athleteId: aid,
        gameId,
        name: member.name ?? '—',
        shortName: member.shortName ?? member.name ?? '—',
        jerseyNumber: member.jerseyNumber ?? null,
        position: member.position?.shortName ?? member.position?.name ?? null,
        formation: member.formation?.shortName ?? member.formation?.name ?? null,
        imageUrl: buildScores365AthletePhotoUrl(aid, 68),
        stats: member.stats ?? [],
        chartEvents,
      };

      await redisCacheService.set(cacheKey, report, 300_000);
      return { data: report, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getPlayerMatchReport(${athleteId}, ${gameId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  // ─── 7. Player career shot chart ─────────────────────────────────────────

  async getPlayerCareerShotChart(
    athleteId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerCareerShotChart>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:player-chart:${athleteId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFivePlayerCareerShotChart>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<ChartEventsPayload>(
        `/web/athletes/chartEvents?${this.commonParams(langId)}&athletes=${athleteId}`,
        `player-chart:${athleteId}`,
        86_400_000,
      );
      const athlete = payload?.athletes?.[0];
      if (!athlete?.chartEvents) return { data: null, source: null };

      const chart = athlete.chartEvents;
      const data: ThreeSixFivePlayerCareerShotChart = {
        athleteId,
        mostCommonGoalZone: chart.mostCommonGoalZone,
        penaltyGoals: chart.penaltyGoals,
        penaltyConversions: chart.penaltyConversions,
        events: chart.events ?? [],
      };

      await redisCacheService.set(cacheKey, data, 86_400_000);
      return { data, source: '365scores' };
    } catch (err: unknown) {
      logger.warn(
        `[365Scores] getPlayerCareerShotChart(${athleteId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  // ─── 8. Player basic info ────────────────────────────────────────────────

  async getPlayerBasicInfo(
    athleteId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerBasicInfo>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:player-info:${athleteId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFivePlayerBasicInfo>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<NextGamePayload>(
        `/web/athletes/nextGame?${this.commonParams(langId)}&athletes=${athleteId}&fullDetails=true`,
        `player-info:${athleteId}`,
        86_400_000,
      );
      const raw = payload?.athletes?.[0];
      if (!raw) return { data: null, source: null };

      const data: ThreeSixFivePlayerBasicInfo = {
        athleteId,
        name: (raw.name as string) ?? '—',
        shortName: raw.shortName as string | undefined,
        club: (raw.clubName as string) ?? (raw.competitorName as string),
        nationality: raw.countryName as string | undefined,
        position: (raw.positionName as string) ?? (raw.position as string),
        imageUrl: buildScores365AthletePhotoUrl(athleteId, 68),
        nextGame: raw.nextGame,
        raw,
      };

      await redisCacheService.set(cacheKey, data, 86_400_000);
      return { data, source: '365scores' };
    } catch (err: unknown) {
      logger.warn(`[365Scores] getPlayerBasicInfo(${athleteId}) failed:`, (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private commonParams(langId: number): string {
    const tz = encodeURIComponent(process.env.SCORES365_TIMEZONE || 'Africa/Cairo');
    const countryId = process.env.SCORES365_USER_COUNTRY_ID || '131';
    return `appTypeId=5&langId=${langId}&timezoneName=${tz}&userCountryId=${countryId}`;
  }

  private classifyPhase(game: Scores365Game): ThreeSixFiveMatchPhase {
    const homeRaw = game.homeCompetitor?.score;
    const awayRaw = game.awayCompetitor?.score;
    if (homeRaw === -1 || awayRaw === -1) return 'upcoming';

    const text = (game.statusText ?? '').toLowerCase();
    if (
      text.includes('انته') ||
      text.includes('ended') ||
      text.includes('finish') ||
      (game.shortStatusText ?? '').toLowerCase() === 'ft'
    ) {
      return 'finished';
    }
    return 'live';
  }

  private toFixtureItem(game: Scores365Game): ThreeSixFiveFixtureItem {
    const phase = this.classifyPhase(game);
    const homeScore =
      game.homeCompetitor?.score != null && game.homeCompetitor.score >= 0
        ? game.homeCompetitor.score
        : null;
    const awayScore =
      game.awayCompetitor?.score != null && game.awayCompetitor.score >= 0
        ? game.awayCompetitor.score
        : null;
    return {
      gameId: game.id,
      phase,
      startTime: game.startTime,
      homeName: game.homeCompetitor?.name,
      awayName: game.awayCompetitor?.name,
      homeScore,
      awayScore,
      statusText: game.statusText,
      competitionId: game.competitionId,
      raw: game,
    };
  }

  private toLiveGameDetails(game: Scores365Game): ThreeSixFiveLiveGameDetails {
    const lineupsText = (game.lineupsStatusText ?? '').toLowerCase();
    const confirmed =
      lineupsText.includes('confirm') ||
      lineupsText.includes('مؤك') ||
      game.lineupsStatus === 1;
    return {
      gameId: game.id,
      minute: game.gameTime != null ? Math.floor(game.gameTime) : null,
      minuteDisplay: game.gameTimeDisplay,
      homeScore:
        game.homeCompetitor?.score != null && game.homeCompetitor.score >= 0
          ? game.homeCompetitor.score
          : null,
      awayScore:
        game.awayCompetitor?.score != null && game.awayCompetitor.score >= 0
          ? game.awayCompetitor.score
          : null,
      statusText: game.statusText,
      shortStatusText: game.shortStatusText,
      phase: 'live',
      homeLineupMemberIds: (game.homeCompetitor?.lineups?.members ?? []).map((m) => m.id),
      awayLineupMemberIds: (game.awayCompetitor?.lineups?.members ?? []).map((m) => m.id),
      lineupsStatus: game.lineupsStatusText,
      lineupsConfirmed: confirmed,
      raw: game,
    };
  }

  private async fetchAllFixtures(competitionId: number, langId: number): Promise<Scores365Game[]> {
    const seen = new Set<number>();
    const all: Scores365Game[] = [];
    const add = (games?: Scores365Game[]) => {
      for (const g of games ?? []) {
        if (!seen.has(g.id)) {
          seen.add(g.id);
          all.push(g);
        }
      }
    };

    const firstPath = `/web/games/fixtures/?${this.commonParams(langId)}&competitions=${competitionId}&showOdds=true`;
    const first = await this.fetchJson<FixturesPayload>(
      firstPath,
      `fixtures-page:${competitionId}`,
      0,
      true,
    );
    add(first?.games);

    let prev = first?.paging?.previousPage;
    for (let step = 0; prev && step < 40; step++) {
      const normalized = this.rewritePagingPath(prev, langId);
      const url = normalized.startsWith('http') ? normalized : `${BASE_URL}${normalized}`;
      const page = await this.fetchJson<FixturesPayload>(
        url,
        `fixtures-page:${competitionId}`,
        0,
        true,
      );
      const before = all.length;
      add(page?.games);
      if (all.length === before && !page?.games?.length) break;
      prev = page?.paging?.previousPage;
    }

    let next = first?.paging?.nextPage;
    for (let step = 0; next && step < 40; step++) {
      const normalized = this.rewritePagingPath(next, langId);
      const url = normalized.startsWith('http') ? normalized : `${BASE_URL}${normalized}`;
      const page = await this.fetchJson<FixturesPayload>(
        url,
        `fixtures-page:${competitionId}`,
        0,
        true,
      );
      const before = all.length;
      add(page?.games);
      if (all.length === before && !page?.games?.length) break;
      next = page?.paging?.nextPage;
    }

    return all;
  }

  private rewritePagingPath(path: string, langId: number): string {
    try {
      const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
      url.searchParams.set('langId', String(langId));
      return `${url.pathname}${url.search}`;
    } catch {
      return path;
    }
  }

  private async fetchGameUpstream(
    gameId: number,
    langId: number,
    matchupId?: string,
  ): Promise<Scores365Game | null> {
    let path = `/web/game/?${this.commonParams(langId)}&gameId=${gameId}`;
    if (matchupId) path += `&matchupId=${encodeURIComponent(matchupId)}`;
    const payload = await this.fetchJson<GamePayload>(path, `game:${gameId}`, LIVE_GAME_MIN_INTERVAL_MS);
    return payload?.game ?? null;
  }

  private canFetchUpstream(rateKey: string, minIntervalMs: number): boolean {
    const last = this.lastUpstreamFetch.get(rateKey) ?? 0;
    return Date.now() - last >= minIntervalMs;
  }

  private async fetchJson<T>(
    pathOrUrl: string,
    rateKey: string,
    minIntervalMs: number,
    skipRateLimit = false,
  ): Promise<T | null> {
    if (!skipRateLimit && minIntervalMs > 0 && !this.canFetchUpstream(rateKey, minIntervalMs)) {
      return null;
    }

    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;

    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(12_000),
      });

      if (res.status === 403) {
        logger.warn(`[365Scores] HTTP 403 for ${rateKey} — backing off`);
        return null;
      }
      if (!res.ok) {
        logger.warn(`[365Scores] HTTP ${res.status} for ${rateKey}`);
        return null;
      }

      const text = await res.text();
      if (!text?.trim()) {
        logger.warn(`[365Scores] empty body for ${rateKey}`);
        return null;
      }

      this.lastUpstreamFetch.set(rateKey, Date.now());
      const parsed = JSON.parse(text) as T;
      // Log response size for diagnostics (helps catch truncated payloads).
      const itemCount = Array.isArray(parsed)
        ? parsed.length
        : typeof parsed === 'object' && parsed !== null
          ? Object.keys(parsed as object).length
          : -1;
      logger.debug(
        `[365Scores] fetch ${rateKey}: ${text.length} bytes, ${itemCount < 0 ? 'non-array' : itemCount + ' top-level keys/items'}`,
      );
      return parsed;
    } catch (err: unknown) {
      logger.warn(`[365Scores] fetch ${rateKey} failed:`, (err as Error)?.message);
      return null;
    }
  }

  private async persistFinishedFixtures(items: ThreeSixFiveFixtureItem[]): Promise<void> {
    const leagueId = parseInt(process.env.WORLD_CUP_LEAGUE_ID || '1', 10);
    const season = parseInt(process.env.WORLD_CUP_SEASON || '2026', 10);
    const dbRows = await prisma.cachedFixture.findMany({
      where: { leagueId, leagueSeason: season },
      orderBy: { matchDate: 'asc' },
    });

    const toUpsert: FixtureFromAPI[] = [];

    for (const item of items) {
      // Finished fixtures are immutable — upsert once, then skip on later ticks.
      // Upcoming/live fixtures change (score, status, lineups) — refresh every tick.
      const isFinished = item.phase === 'finished';
      const upsertedKey = `${FINISHED_UPSERTED_KEY_PREFIX}${item.gameId}`;
      if (isFinished) {
        const already = await redisCacheService.get<boolean>(upsertedKey);
        if (already) continue;
      }

      const dbRow = this.resolveDbRow(item.raw, dbRows);
      const base = dbRow ? matchCacheService.convertDbMatchToApiFormat(dbRow) : null;
      // Use the 365 gameId as a synthetic fixtureId when API-Football has no row.
      const fixtureId = dbRow?.fixtureId ?? item.gameId;
      const mapped = await mapScores365ToApiFootballFixture(
        item.raw as Parameters<typeof mapScores365ToApiFootballFixture>[0],
        base,
        fixtureId,
      );
      if (mapped) {
        toUpsert.push(mapped);
        registerScores365FixtureMapping(fixtureId, item.gameId);
        if (isFinished) {
          await redisCacheService.set(upsertedKey, true, 30 * 24 * 60 * 60 * 1000);
        }
      }
    }

    if (toUpsert.length > 0) {
      const count = await matchCacheService.upsertFixtures(toUpsert);
      logger.info(`[365Scores] upserted ${count} WC fixtures to DB (all phases)`);
    }
  }

  /**
   * League-agnostic persistence for the /allscores/ feed (non-WC competitions).
   * Unlike persistFinishedFixtures (WC-scoped), candidate DB rows are loaded by a
   * date window across ALL leagues so resolveDbRow can reuse an existing
   * API-Football row when present; unmatched games become synthetic fixtures with
   * a namespaced leagueId derived from the 365 competitionId.
   */
  /** Build competitionId → { name, country } from the allscores payload lookups. */
  private buildCompetitionMeta(payload: AllScoresPayload): CompetitionMetaMap {
    const countriesById = new Map<number, string>();
    for (const c of payload.countries ?? []) {
      if (c.id != null && c.name) countriesById.set(c.id, c.name);
    }
    const meta: CompetitionMetaMap = new Map();
    for (const comp of payload.competitions ?? []) {
      if (comp.id == null) continue;
      meta.set(comp.id, {
        name: comp.name,
        country: comp.countryId != null ? countriesById.get(comp.countryId) : undefined,
        logo: buildLeagueLogoUrl(comp.id, comp.imageVersion ?? null) ?? undefined,
        hasStandings: comp.hasStandings,
      });
    }
    return meta;
  }

  private async persistAllScoresFixtures(
    items: ThreeSixFiveFixtureItem[],
    competitionMeta?: CompetitionMetaMap,
  ): Promise<void> {
    if (!items.length) return;

    // Date window covering all kickoffs ±3h, so resolveDbRow can match existing
    // API-Football rows without a leagueId/season restriction.
    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const item of items) {
      const ms = item.raw.startTime ? new Date(item.raw.startTime).getTime() : NaN;
      if (Number.isNaN(ms)) continue;
      if (ms < minMs) minMs = ms;
      if (ms > maxMs) maxMs = ms;
    }
    if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return;

    const WINDOW_MS = 3 * 60 * 60 * 1000;
    const dbRows = await prisma.cachedFixture.findMany({
      where: {
        matchDate: {
          gte: new Date(minMs - WINDOW_MS),
          lte: new Date(maxMs + WINDOW_MS),
        },
      },
      orderBy: { matchDate: 'asc' },
    });

    // Self-heal: finished synthetic fixtures are Redis-guarded and never
    // re-upserted, so any metadata written by older code (e.g. country
    // "World", missing logo) would persist forever. Reconcile every tick
    // against the freshly-built competition meta so country/logo stay correct
    // even for rows we won't otherwise touch below.
    if (competitionMeta) {
      await this.reconcileSyntheticLeagueMeta(dbRows, competitionMeta);
    }

    const toUpsert: FixtureFromAPI[] = [];
    const competitions = new Set<number>();

    for (const item of items) {
      // Finished fixtures are immutable — upsert once, then skip on later ticks.
      // Upcoming/live fixtures change (score, status) — refresh every tick.
      const isFinished = item.phase === 'finished';
      const upsertedKey = `${FINISHED_UPSERTED_KEY_PREFIX}${item.gameId}`;
      if (isFinished) {
        const already = await redisCacheService.get<boolean>(upsertedKey);
        if (already) continue;
      }

      const dbRow = this.resolveDbRow(item.raw, dbRows);

      let base: FixtureFromAPI | null;
      let fixtureId: number;
      if (dbRow) {
        // Reuse the existing API-Football row (keeps its real leagueId).
        base = matchCacheService.convertDbMatchToApiFormat(dbRow);
        fixtureId = dbRow.fixtureId;
      } else {
        const competitionId = item.competitionId ?? item.raw.competitionId;
        if (!competitionId) {
          logger.debug(
            `[OtherLeagues-365] game ${item.gameId}: no competitionId — skipping synthetic build`,
          );
          continue;
        }
        const kickoff = item.raw.startTime ? new Date(item.raw.startTime) : new Date();
        const meta = competitionMeta?.get(competitionId);
        base = synthesizeBaseFrom365Game(
          item.raw as Parameters<typeof synthesizeBaseFrom365Game>[0],
          item.gameId,
          {
            leagueId: scores365CompetitionToLeagueId(competitionId),
            season: kickoff.getUTCFullYear(),
            leagueName: meta?.name ?? item.raw.competitionDisplayName,
            country: meta?.country,
            leagueLogo: meta?.logo,
          },
        );
        fixtureId = item.gameId;
      }

      const mapped = await mapScores365ToApiFootballFixture(
        item.raw as Parameters<typeof mapScores365ToApiFootballFixture>[0],
        base,
        fixtureId,
      );
      if (mapped) {
        toUpsert.push(mapped);
        registerScores365FixtureMapping(fixtureId, item.gameId);
        const compId = item.competitionId ?? item.raw.competitionId;
        if (compId) competitions.add(compId);
        if (isFinished) {
          await redisCacheService.set(upsertedKey, true, 30 * 24 * 60 * 60 * 1000);
        }
      }
    }

    if (toUpsert.length > 0) {
      const count = await matchCacheService.upsertFixtures(toUpsert);
      logger.info(
        `[OtherLeagues-365] upserted ${count} fixtures across ${competitions.size} competitions`,
      );

      // Persist each distinct competition as its own league record so the app
      // can render league logo/name/country for any 365 competition.
      if (competitionMeta) {
        const leagueRecords = [...competitions]
          .map((compId) => {
            const meta = competitionMeta.get(compId);
            if (!meta?.name) return null;
            return {
              leagueId: scores365CompetitionToLeagueId(compId),
              name: meta.name,
              country: meta.country ?? 'World',
              logo: meta.logo ?? null,
              hasStandings: meta.hasStandings,
              fullData: {
                competitionId: compId,
                leagueId: scores365CompetitionToLeagueId(compId),
                name: meta.name,
                country: meta.country ?? 'World',
                logo: meta.logo ?? null,
                hasStandings: meta.hasStandings ?? false,
                source: '365scores',
              },
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (leagueRecords.length > 0) {
          try {
            await leagueCacheService.upsertScores365Leagues(leagueRecords);
          } catch (err: unknown) {
            logger.warn('[OtherLeagues-365] league cache upsert failed:', (err as Error)?.message);
          }
        }
      }
    }
  }

  /**
   * Correct drifted league metadata (country / logo) on already-stored
   * synthetic 365 fixtures. Only rows whose country or logo actually differ
   * from the authoritative competition meta are written, so this is a no-op on
   * a healthy DB and cheap on a drifted one.
   */
  private async reconcileSyntheticLeagueMeta(
    dbRows: Awaited<ReturnType<typeof prisma.cachedFixture.findMany>>,
    competitionMeta: CompetitionMetaMap,
  ): Promise<void> {
    let fixed = 0;
    for (const row of dbRows) {
      if (row.leagueId < SCORES365_LEAGUE_ID_OFFSET) continue;
      const competitionId = row.leagueId - SCORES365_LEAGUE_ID_OFFSET;
      const meta = competitionMeta.get(competitionId);
      const country = meta?.country;
      if (!country || country === 'World') continue; // nothing authoritative to apply

      const logo = meta?.logo ?? row.leagueLogo ?? null;
      const name = meta?.name ?? row.leagueName;

      const countryDrifted = row.leagueCountry !== country;
      const logoDrifted = !!meta?.logo && row.leagueLogo !== meta.logo;
      const full = row.fullData as { league?: { country?: string; logo?: string } } | null;
      const jsonDrifted =
        !!full?.league && (full.league.country !== country || (!!meta?.logo && full.league.logo !== meta.logo));

      if (!countryDrifted && !logoDrifted && !jsonDrifted) continue;

      let fullData = row.fullData as unknown;
      if (full?.league) {
        fullData = {
          ...(full as object),
          league: { ...full.league, country, logo: logo ?? full.league.logo ?? '' },
        };
      }

      try {
        await prisma.cachedFixture.update({
          where: { id: row.id },
          data: {
            leagueCountry: country,
            leagueLogo: logo,
            leagueName: name,
            fullData: fullData as never,
          },
        });
        fixed++;
      } catch (err: unknown) {
        logger.debug(
          `[OtherLeagues-365] reconcile failed for fixture ${row.fixtureId}: ${(err as Error)?.message}`,
        );
      }
    }
    if (fixed > 0) {
      logger.info(`[OtherLeagues-365] reconciled league metadata on ${fixed} synthetic fixtures`);
    }
  }

  private resolveDbRow(
    game: Scores365Game,
    dbRows: Awaited<ReturnType<typeof prisma.cachedFixture.findMany>>,
  ) {
    const gameMs = game.startTime ? new Date(game.startTime).getTime() : NaN;
    if (Number.isNaN(gameMs)) return null;

    type Row = (typeof dbRows)[number];
    const candidates: { row: Row; delta: number; hits: number }[] = [];

    for (const row of dbRows) {
      const rowMs = row.matchTimestamp ? row.matchTimestamp * 1000 : row.matchDate.getTime();
      const delta = Math.abs(rowMs - gameMs);
      if (delta > 3 * 60 * 60 * 1000) continue;

      const hits = this.teamHitCount(game, row);
      if (hits < 2) continue;
      candidates.push({ row, delta, hits });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.delta - b.delta || b.hits - a.hits);
    const best = candidates[0];
    const tied = candidates.filter((c) => c.delta === best.delta && c.hits === best.hits);
    if (tied.length > 1) return null;
    return best.row;
  }

  private teamHitCount(
    game: Scores365Game,
    row: { homeTeamName: string; awayTeamName: string },
  ): number {
    const norm = (s?: string) =>
      (s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const match = (a?: string, b?: string) => {
      const na = norm(a);
      const nb = norm(b);
      return na && nb && (na === nb || na.includes(nb) || nb.includes(na));
    };
    let hits = 0;
    if (match(game.homeCompetitor?.name, row.homeTeamName)) hits++;
    if (match(game.awayCompetitor?.name, row.awayTeamName)) hits++;
    return hits;
  }

  private ensureLivePollLoop(): void {
    if (this.livePollTimer) return;
    this.livePollTimer = setInterval(() => {
      void this.runLivePollTick();
    }, LIVE_POLL_INTERVAL_MS);
  }

  private async runLivePollTick(): Promise<void> {
    const now = Date.now();
    for (const [gameId, sub] of this.liveSubscriptions) {
      if (sub.expiresAt < now) {
        this.liveSubscriptions.delete(gameId);
        continue;
      }
      await this.getLiveGameDetails(gameId, undefined, { force: true });
    }
    if (this.liveSubscriptions.size === 0 && this.livePollTimer) {
      clearInterval(this.livePollTimer);
      this.livePollTimer = null;
    }
  }
}

export const threeSixFiveScoresService = new ThreeSixFiveScoresService();
