/**
 * 365Scores — secondary World Cup data source.
 * Each public method maps to exactly one upstream endpoint (Single Responsibility).
 * Controllers must not call this directly; use football-data-cache.service wrappers.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';
import { matchCacheService, type FixtureFromAPI, LIVE_STATUSES } from './match-cache.service';
import { leagueCacheService } from './league-cache.service';
import {
  getScores365CompetitionId,
  isScores365ExperimentEnabled,
  mapScores365ToApiFootballFixture,
  registerScores365FixtureMapping,
  resolveScores365LangId,
  resolveScores365SearchLangId,
  scores365CompetitionToLeagueId,
  SCORES365_LEAGUE_ID_OFFSET,
  synthesizeBaseFrom365Game,
  sync365SyntheticLiveSnapshots,
  classifyScores365MatchStatus,
} from './scores365-experiment.service';
import { buildScores365AthletePhotoUrl } from '../utils/scores365-athlete-photo';
import { calendarDateFromKickoff } from '../utils/calendar-day-bounds.util';

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
  /** Direct meetings between the two sides (from h2hGames or cross-filtered recent games). */
  meetings: Scores365Game[];
  homeCompetitorId: number | null;
  awayCompetitorId: number | null;
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

export interface ThreeSixFiveSearchAthlete {
  athleteId: number;
  name: string;
  shortName: string;
  clubName: string | null;
  clubId: number | null;
  nationalityId: number | null;
  sportId: number | null;
  imageVersion: number | null;
  imageUrl: string | null;
}

export interface ThreeSixFivePlayerLookupEntry {
  athleteId: number;
  name: string;
  shortName: string;
  clubName: string | null;
  clubId: number | null;
  nationalityId: number | null;
  imageUrl: string | null;
  info: ThreeSixFivePlayerBasicInfo | null;
  career: ThreeSixFivePlayerCareer | null;
}

export interface ThreeSixFivePlayerLookupResult {
  query: string;
  players: ThreeSixFivePlayerLookupEntry[];
}

export interface Career365CompetitionStat {
  competitionId: number | null;
  competitionName: string;
  competitionLogo: string | null;
  teamId: number | null;
  teamName: string | null;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  minutes: number | null;
  yellowCards: number | null;
  redCards: number | null;
  rating: number | null;
}

export interface Career365Season {
  /** Stable identifier used by the season selector (e.g. "2024" or "2024-2025"). */
  seasonKey: string;
  /** Human label (e.g. "2024/25"). */
  label: string;
  goals: number;
  assists: number;
  appearances: number;
  minutes: number | null;
  competitions: Career365CompetitionStat[];
}

export interface Career365TrendPoint {
  seasonKey: string;
  label: string;
  goals: number;
  assists: number;
}

export interface Career365HighlightStat {
  name: string;
  shortName?: string;
  value: string;
  type?: number;
  isTop?: boolean;
}

export interface Career365HighlightCompetition {
  competitionId: number;
  competitionName: string;
  competitionLogo: string | null;
  seasonNum?: number | null;
  stats: Career365HighlightStat[];
}

export interface Career365Trophy {
  competitionId: number;
  name: string;
  displayName?: string;
  count: number;
  categoryName?: string;
}

export interface ThreeSixFivePlayerCareer {
  athleteId: number;
  profile: {
    name: string;
    shortName?: string;
    position?: string | null;
    clubName?: string | null;
    nationality?: string | null;
    jerseyNumber?: number | null;
    age?: number | null;
    imageUrl: string | null;
  };
  seasons: Career365Season[];
  trend: Career365TrendPoint[];
  /** Newest season key from 365 (e.g. "2026" for 2025/26). */
  currentSeasonKey: string | null;
  /** Rich per-competition stats for the active season (highlightStats). */
  currentSeasonHighlights: Career365HighlightCompetition[];
  trophies: Career365Trophy[];
}

export interface ThreeSixFiveCoach {
  athleteId: number;
  teamId: number;
  teamName: string;
  name: string;
  nationality?: string;
  bio?: string;
  imageUrl: string | null;
  imageVersion?: number | null;
  role: 'head_coach' | 'assistant_coach';
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
  h2hGames?: Record<string, Scores365Game[]> | Scores365Game[];
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
  formation?: { name?: string; shortName?: string; id?: number };
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

interface CompetitionsCatalogPayload {
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
const TRACKED_COMPETITIONS_KEY = '365:tracked_competition_ids';
const TRACKED_COMPETITIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COMPETITIONS_CATALOG_CACHE_KEY = '365:competitions_catalog';
const FIXTURES_SYNC_CURSOR_KEY = '365:fixtures_sync_cursor';
const SUPPLEMENT_COMPETITION_BATCH = 6;
/** Always supplement / rotate these 365 competitionIds (lower tiers often missing from allscores). */
const DEFAULT_TRACKED_COMPETITIONS = [
  116, // Brasileirão Série B
  18, // Serie B (Italy)
  1, // Championship (England)
  2, // League One (England)
  3, // League Two (England)
  26, // Bundesliga 2
  34, // 3. Liga
  12, // LaLiga 2
  36, // Ligue 2
  74, // Liga Portugal 2
  58, // Eerste Divisie
  5502, // Saudi First Division
  6994, // Egypt Second Division
  5651, // Botola 2 (Morocco)
  6168, // Serie C (Italy)
  7741, // Segunda RFEF (Spain)
  357, // Championnat National (France)
  6251, // Regionalliga (Germany)
];

function supplementCompetitionLimit(): number {
  const raw = parseInt(process.env.SCORES365_SUPPLEMENT_COMPETITION_LIMIT || '801', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 801;
}

function fixturesSyncBatchSize(): number {
  const raw = parseInt(process.env.SCORES365_FIXTURES_SYNC_BATCH || '30', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

function trackedCompetitionStoreLimit(): number {
  const raw = parseInt(process.env.SCORES365_TRACKED_COMPETITIONS_LIMIT || '2000', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 2000;
}

function useOnlyMajorGames(): boolean {
  return process.env.SCORES365_ONLY_MAJOR_GAMES === 'true';
}

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
    options?: { force?: boolean },
  ): Promise<ThreeSixFiveResult<ThreeSixFiveFixtureItem[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const majorOnly = useOnlyMajorGames();
      const cacheKey = `365:allscores:${startDate}:${endDate}:${langId}:${majorOnly ? 'major' : 'all'}`;
      if (!options?.force) {
        const cached = await redisCacheService.get<ThreeSixFiveFixtureItem[]>(cacheKey);
        if (cached) return { data: cached, source: '365scores' };
      }

      const path =
        `/web/games/allscores/?${this.commonParams(langId)}` +
        `&sports=1&startDate=${encodeURIComponent(startDate)}` +
        `&endDate=${encodeURIComponent(endDate)}&showOdds=true&onlyMajorGames=${majorOnly}&withTop=true`;

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
      await this.storeTrackedCompetitionIds(competitionMeta);

      return { data: items, source: '365scores' };
    } catch (err: unknown) {
      logger.error('[365Scores] getAllScores failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  /**
   * Fill upcoming gaps for a calendar day via per-competition /fixtures/ feed.
   * allscores often omits scheduled lower-tier games (e.g. Brasileirão Série B).
   */
  async supplementCalendarDateFromCompetitionFixtures(
    dateString: string,
    language?: string | null,
  ): Promise<number> {
    if (!this.isEnabled()) return 0;

    const competitionIds = await this.loadTrackedCompetitionIds();
    if (!competitionIds.length) return 0;

    const langId = resolveScores365LangId(language);
    const items: ThreeSixFiveFixtureItem[] = [];
    const competitionMeta = await this.loadCompetitionMetaForIds(competitionIds);

    for (let i = 0; i < competitionIds.length; i += SUPPLEMENT_COMPETITION_BATCH) {
      const slice = competitionIds.slice(i, i + SUPPLEMENT_COMPETITION_BATCH);
      const batches = await Promise.all(
        slice.map(async (competitionId) => {
          try {
            const games = await this.fetchAllFixtures(competitionId, langId);
            return games
              .filter((g) => calendarDateFromKickoff(g.startTime) === dateString)
              .map((g) => this.toFixtureItem(g));
          } catch (err: unknown) {
            logger.debug(
              `[365Scores] supplement fixtures comp=${competitionId} failed:`,
              (err as Error)?.message,
            );
            return [] as ThreeSixFiveFixtureItem[];
          }
        }),
      );
      for (const batch of batches) items.push(...batch);
    }

    if (!items.length) return 0;

    await this.persistAllScoresFixtures(items, competitionMeta);
    logger.info(
      `[365Scores] supplemented ${items.length} fixtures for ${dateString} from ${competitionIds.length} competitions`,
    );
    return items.length;
  }

  /**
   * Fetch the full 365Scores football competitions catalog (~800+ leagues incl.
   * 2nd/3rd divisions) and persist each as a CachedLeague row.
   */
  async syncCompetitionsCatalog(
    language?: string | null,
    options?: { force?: boolean },
  ): Promise<{ competitions: number; leaguesUpserted: number }> {
    if (!this.isEnabled()) return { competitions: 0, leaguesUpserted: 0 };

    try {
      const langId = resolveScores365LangId(language);
      if (!options?.force) {
        const cached = await redisCacheService.get<number[]>(COMPETITIONS_CATALOG_CACHE_KEY);
        if (cached?.length) {
          return { competitions: cached.length, leaguesUpserted: 0 };
        }
      }

      const path = `/web/competitions/?${this.commonParams(langId)}&sports=1`;
      const payload = await this.fetchJson<CompetitionsCatalogPayload>(
        path,
        'competitions-catalog',
        86_400_000,
      );
      const competitions = payload?.competitions ?? [];
      if (!competitions.length) return { competitions: 0, leaguesUpserted: 0 };

      const countriesById = new Map<number, string>();
      for (const c of payload?.countries ?? []) {
        if (c.id != null && c.name) countriesById.set(c.id, c.name);
      }

      const competitionMeta = this.buildCompetitionMetaFromCatalog(competitions, countriesById);
      const competitionIds = [...competitionMeta.keys()];

      const leagueRecords = competitionIds
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
        await leagueCacheService.upsertScores365Leagues(leagueRecords);
      }

      await this.storeTrackedCompetitionIds(competitionMeta);
      await redisCacheService.set(
        COMPETITIONS_CATALOG_CACHE_KEY,
        competitionIds,
        86_400_000,
      );

      logger.info(
        `[365Scores] synced competitions catalog: ${competitionIds.length} leagues upserted=${leagueRecords.length}`,
      );
      return { competitions: competitionIds.length, leaguesUpserted: leagueRecords.length };
    } catch (err: unknown) {
      logger.error('[365Scores] syncCompetitionsCatalog failed:', (err as Error)?.message);
      return { competitions: 0, leaguesUpserted: 0 };
    }
  }

  /** Sync fixtures for one 365 competition (all pages) into cachedFixture. */
  async syncCompetitionFixtures(
    competitionId: number,
    language?: string | null,
  ): Promise<number> {
    if (!this.isEnabled() || competitionId <= 0) return 0;

    try {
      const langId = resolveScores365LangId(language);
      const games = await this.fetchAllFixtures(competitionId, langId);
      if (!games?.length) return 0;

      const items = games.map((g) => this.toFixtureItem(g));
      let competitionMeta = await this.loadCompetitionMetaForIds([competitionId]);
      if (!competitionMeta.has(competitionId) && games[0]) {
        competitionMeta.set(competitionId, {
          name: games[0].competitionDisplayName ?? `Competition ${competitionId}`,
        });
      }
      await this.persistAllScoresFixtures(items, competitionMeta);
      return items.length;
    } catch (err: unknown) {
      logger.debug(
        `[365Scores] syncCompetitionFixtures(${competitionId}) failed:`,
        (err as Error)?.message,
      );
      return 0;
    }
  }

  /**
   * Round-robin batch sync: walks the full catalog so 2nd/3rd-tier leagues
   * eventually populate the DB even when /allscores/ omits them.
   */
  async syncCompetitionFixturesBatch(
    language?: string | null,
    options?: { batchSize?: number },
  ): Promise<{ batchSize: number; fixtures: number; cursor: number; total: number }> {
    if (!this.isEnabled()) {
      return { batchSize: 0, fixtures: 0, cursor: 0, total: 0 };
    }

    const batchSize = options?.batchSize ?? fixturesSyncBatchSize();
    const allIds = await this.loadAllCompetitionIds();
    if (!allIds.length) return { batchSize: 0, fixtures: 0, cursor: 0, total: 0 };

    const cursor =
      (await redisCacheService.get<number>(FIXTURES_SYNC_CURSOR_KEY)) ?? 0;
    const slice =
      cursor + batchSize <= allIds.length
        ? allIds.slice(cursor, cursor + batchSize)
        : [...allIds.slice(cursor), ...allIds.slice(0, batchSize - (allIds.length - cursor))];
    const nextCursor = (cursor + batchSize) % allIds.length;

    let fixtures = 0;
    for (let i = 0; i < slice.length; i += SUPPLEMENT_COMPETITION_BATCH) {
      const chunk = slice.slice(i, i + SUPPLEMENT_COMPETITION_BATCH);
      const counts = await Promise.all(
        chunk.map((competitionId) => this.syncCompetitionFixtures(competitionId, language)),
      );
      fixtures += counts.reduce((sum, n) => sum + n, 0);
    }

    await redisCacheService.set(FIXTURES_SYNC_CURSOR_KEY, nextCursor, 7 * 24 * 60 * 60 * 1000);

    if (fixtures > 0) {
      logger.info(
        `[365Scores] fixtures batch synced ${fixtures} fixtures for ${slice.length}/${allIds.length} competitions (cursor ${cursor}→${nextCursor})`,
      );
    }

    return { batchSize: slice.length, fixtures, cursor: nextCursor, total: allIds.length };
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

      const isStaffOrMissingLineupMember = (m: {
        id: number;
        status?: number;
        formation?: { id?: number };
      }): boolean =>
        m.status === 3 ||
        m.status === 4 ||
        m.formation?.id === 16 ||
        m.formation?.id === 17;

      const homeLineupMembers = gameResult.homeCompetitor?.lineups?.members ?? [];
      const awayLineupMembers = gameResult.awayCompetitor?.lineups?.members ?? [];
      const homeIds = new Set(homeLineupMembers.map((m) => m.id));
      const awayIds = new Set(awayLineupMembers.map((m) => m.id));
      const joinMissHomeIds = new Set(
        homeLineupMembers.filter((m) => !isStaffOrMissingLineupMember(m)).map((m) => m.id),
      );
      const joinMissAwayIds = new Set(
        awayLineupMembers.filter((m) => !isStaffOrMissingLineupMember(m)).map((m) => m.id),
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

      // Log join misses for players only (coaches/missing are absent from athletes/lineups by design).
      for (const id of joinMissHomeIds) {
        if (!players.some((p) => p.memberId === id)) {
          logger.debug(
            `[365Scores] getLineupsWithNames(${gameId}): home member id=${id} missing from athletes/lineups response — join miss`,
          );
        }
      }
      for (const id of joinMissAwayIds) {
        if (!players.some((p) => p.memberId === id)) {
          logger.debug(
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

  private flattenH2hGames(
    h2hGames?: Record<string, Scores365Game[]> | Scores365Game[],
  ): Scores365Game[] {
    if (!h2hGames) return [];
    if (Array.isArray(h2hGames)) return h2hGames;
    return Object.values(h2hGames).flat();
  }

  private extractDirectMeetings(
    game: Scores365Game,
    homeId: number | undefined,
    awayId: number | undefined,
  ): Scores365Game[] {
    const fromH2h = this.flattenH2hGames(game.h2hGames);
    if (fromH2h.length) {
      return fromH2h
        .filter((g) => g?.id != null)
        .sort(
          (a, b) =>
            new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime(),
        );
    }
    if (!homeId || !awayId) return [];

    const all = [
      ...(game.homeCompetitor?.recentGames ?? []),
      ...(game.awayCompetitor?.recentGames ?? []),
    ];
    const seen = new Set<number>();
    const meetings: Scores365Game[] = [];
    for (const g of all) {
      if (!g?.id || seen.has(g.id)) continue;
      const h = g.homeCompetitor?.id;
      const a = g.awayCompetitor?.id;
      if ((h === homeId && a === awayId) || (h === awayId && a === homeId)) {
        seen.add(g.id);
        meetings.push(g);
      }
    }
    return meetings.sort(
      (a, b) => new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime(),
    );
  }

  async getHeadToHeadForm(
    gameId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveHeadToHeadForm>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:h2h:v2:${gameId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveHeadToHeadForm>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<{ game?: Scores365Game }>(
        `/web/games/h2h/?${this.commonParams(langId)}&gameId=${gameId}&addMainOdds=true`,
        `h2h:${gameId}`,
        600_000,
      );
      const game = payload?.game;
      if (!game) return { data: null, source: null };

      const homeId = game.homeCompetitor?.id;
      const awayId = game.awayCompetitor?.id;
      const meetings = this.extractDirectMeetings(game, homeId, awayId);

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
        meetings,
        homeCompetitorId: homeId ?? null,
        awayCompetitorId: awayId ?? null,
      };

      await redisCacheService.set(cacheKey, data, 600_000);
      return { data, source: '365scores' };
    } catch (err: unknown) {
      logger.error(`[365Scores] getHeadToHeadForm(${gameId}) failed:`, (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  // ─── 5b. Player search (cold discovery) ──────────────────────────────────

  /**
   * Resolve 365 athleteId by name via /web/search/ (works without SCORES365_EXPERIMENT_ENABLED).
   */
  async searchAthletes(
    query: string,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveSearchAthlete[]>> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { data: [], source: '365scores' };
    }

    try {
      const primaryLangId = resolveScores365SearchLangId(trimmed, language);
      const fallbackLangId =
        primaryLangId === parseInt(process.env.SCORES365_LANG_ID_AR || '27', 10)
          ? parseInt(process.env.SCORES365_LANG_ID_EN || '1', 10)
          : parseInt(process.env.SCORES365_LANG_ID_AR || '27', 10);

      let athletes = await this.fetchSearchAthletes(trimmed, primaryLangId);
      if (!athletes.length && fallbackLangId !== primaryLangId) {
        athletes = await this.fetchSearchAthletes(trimmed, fallbackLangId);
      }

      return { data: athletes, source: '365scores' };
    } catch (err: unknown) {
      logger.error('[365Scores] searchAthletes failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  private async fetchSearchAthletes(
    query: string,
    langId: number,
  ): Promise<ThreeSixFiveSearchAthlete[]> {
    const cacheKey = `365:search:${langId}:${query.toLowerCase()}`;
    const cached = await redisCacheService.get<ThreeSixFiveSearchAthlete[]>(cacheKey);
    if (cached) return cached;

    const path = `/web/search/?${this.commonParams(langId)}&query=${encodeURIComponent(query)}`;
    const payload = await this.fetchJson<{
      athletes?: Array<{
        id: number;
        name?: string;
        shortName?: string;
        clubId?: number;
        clubName?: string;
        nationalityId?: number;
        sportId?: number;
        imageVersion?: number;
      }>;
    }>(path, `search:${langId}:${query}`, 60_000);

    const athletes = (payload?.athletes ?? [])
      .filter((a) => a.sportId == null || a.sportId === 1)
      .map((a) => ({
        athleteId: a.id,
        name: a.name ?? '—',
        shortName: a.shortName ?? a.name ?? '—',
        clubName: a.clubName ?? null,
        clubId: a.clubId ?? null,
        nationalityId: a.nationalityId ?? null,
        sportId: a.sportId ?? null,
        imageVersion: a.imageVersion ?? null,
        imageUrl: buildScores365AthletePhotoUrl(a.id, a.imageVersion ?? 68),
      }));

    await redisCacheService.set(cacheKey, athletes, 300_000);
    return athletes;
  }

  // ─── 6. Player match report ──────────────────────────────────────────────
  // athleteId can also come from searchAthletes() or a game lineup.

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
      void this.invalidatePlayerCareerCache(aid, langId);
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

  // ─── 8b. Player full career (all seasons) ────────────────────────────────

  /**
   * Aggregates a player's full career from 365Scores.
   *
   * 365 has no single "career" payload with a guaranteed schema, so this method
   * is intentionally defensive: it pulls the athlete profile from
   * `/web/athletes/?fullDetails=true` and the per-season breakdown from
   * `/web/athletes/career`, then normalizes whatever shape comes back into a
   * stable {@link ThreeSixFivePlayerCareer}. Unknown/missing fields degrade to
   * null/empty rather than throwing.
   */
  async getPlayerCareer(
    athleteId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerCareer>> {
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:player-career:v4:${athleteId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFivePlayerCareer>(cacheKey);
      if (cached?.seasons?.length) return { data: cached, source: '365scores' };

      const detailsPayload = await this.fetchJson<{ athletes?: any[]; competitors?: any[]; competitions?: any[] }>(
        `/web/athletes/?${this.commonParams(langId)}&athletes=${athleteId}&fullDetails=true`,
        `player-career-details:${athleteId}`,
        86_400_000,
      );

      const athlete = detailsPayload?.athletes?.[0] ?? null;
      if (!athlete) return { data: null, source: null };

      const compLogoMap = this.build365CompetitionLogoMap(detailsPayload?.competitions ?? []);
      const competitorNames = new Map<number, string>(
        (detailsPayload?.competitors ?? [])
          .filter((c: any) => c?.id != null && c?.name)
          .map((c: any) => [c.id as number, c.name as string]),
      );

      const profile = this.build365CareerProfile(athleteId, athlete, competitorNames);
      const currentSeasonKey = String(athlete.careerStats?.seasons?.[0]?.key ?? '') || null;
      const currentSeasonHighlights = this.parse365HighlightStats(athlete.highlightStats, compLogoMap);
      const trophies = this.parse365Trophies(athlete.trophies);

      const seasonDefs: Array<{ key: string; name: string; embeddedStats?: any }> = (
        athlete.careerStats?.seasons ?? []
      )
        .filter((s: any) => s?.key && String(s.key) !== '-1')
        .map((s: any) => ({
          key: String(s.key),
          name: String(s.name ?? s.key),
          embeddedStats: s.stats,
        }));

      if (!seasonDefs.length) {
        logger.warn(`[365Scores] getPlayerCareer(${athleteId}): no seasons in fullDetails`);
        return { data: null, source: null };
      }

      const seasons = await this.fetch365CareerSeasons(athleteId, langId, seasonDefs, compLogoMap);
      if (!seasons.length) {
        logger.warn(`[365Scores] getPlayerCareer(${athleteId}): all season fetches empty`);
        return { data: null, source: null };
      }

      if (currentSeasonKey) {
        const current = seasons.find((s) => s.seasonKey === currentSeasonKey) ?? seasons[0];
        if (current) this.enrichCurrentSeasonFromHighlights(current, currentSeasonHighlights);
      }

      const trend: Career365TrendPoint[] = [...seasons]
        .reverse()
        .map((s) => ({ seasonKey: s.seasonKey, label: s.label, goals: s.goals, assists: s.assists }));

      const data: ThreeSixFivePlayerCareer = {
        athleteId,
        profile,
        seasons,
        trend,
        currentSeasonKey,
        currentSeasonHighlights,
        trophies,
      };

      await redisCacheService.set(cacheKey, data, 86_400_000);
      return { data, source: '365scores' };
    } catch (err: unknown) {
      logger.warn(`[365Scores] getPlayerCareer(${athleteId}) failed:`, (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  /** Clears Redis career cache so the next read refetches from 365. */
  async invalidatePlayerCareerCache(athleteId: number, langId?: number): Promise<void> {
    const langs = langId != null ? [langId] : [1, 27];
    for (const lid of langs) {
      await redisCacheService.del(`365:player-career:v4:${athleteId}:${lid}`);
      await redisCacheService.del(`365:player-career:v3:${athleteId}:${lid}`);
      await redisCacheService.del(`365:player-career:${athleteId}:${lid}`);
    }
  }

  private build365CompetitionLogoMap(competitions: any[]): Map<number, string | null> {
    const map = new Map<number, string | null>();
    for (const c of competitions ?? []) {
      const id = this.num365(c?.id);
      if (id != null) {
        map.set(id, buildLeagueLogoUrl(id, this.num365(c.imageVersion)));
      }
    }
    return map;
  }

  private parse365HighlightStats(
    raw: any[] | undefined,
    compLogoMap: Map<number, string | null>,
  ): Career365HighlightCompetition[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((h) => h?.competitionId != null)
      .map((h) => {
        const competitionId = this.num365(h.competitionId) ?? 0;
        const stats: Career365HighlightStat[] = (h.stats ?? []).map((s: any) => ({
          name: String(s.name ?? s.shortName ?? '—'),
          shortName: s.shortName as string | undefined,
          value: String(s.value ?? '—'),
          type: this.num365(s.type) ?? undefined,
          isTop: Boolean(s.isTop),
        }));
        return {
          competitionId,
          competitionName: String(h.competitionName ?? h.name ?? '—'),
          competitionLogo: compLogoMap.get(competitionId) ?? null,
          seasonNum: this.num365(h.seasonNum),
          stats,
        };
      });
  }

  private parse365Trophies(raw: any): Career365Trophy[] {
    const out: Career365Trophy[] = [];
    const categories = raw?.categories ?? [];
    for (const cat of categories) {
      const categoryName = cat?.name as string | undefined;
      for (const t of cat?.trophies ?? []) {
        const competitionId = this.num365(t?.competitionId);
        if (competitionId == null) continue;
        out.push({
          competitionId,
          name: String(t.name ?? '—'),
          displayName: t.displayName as string | undefined,
          count: this.num365(t.count) ?? 1,
          categoryName,
        });
      }
    }
    return out;
  }

  private enrichCurrentSeasonFromHighlights(
    season: Career365Season,
    highlights: Career365HighlightCompetition[],
  ): void {
    if (!highlights.length) return;
    const byCompId = new Map(highlights.map((h) => [h.competitionId, h]));
    let seasonMinutes = 0;
    let hasMinutes = false;

    for (const comp of season.competitions) {
      const cid = comp.competitionId;
      if (cid == null) continue;
      const hl = byCompId.get(cid);
      if (!hl) continue;
      const minutesStat = hl.stats.find((s) => s.type === 222);
      const ratingStat = hl.stats.find((s) => s.type === 54);
      if (minutesStat) {
        const mins = this.num365(minutesStat.value);
        if (mins != null) {
          comp.minutes = mins;
          seasonMinutes += mins;
          hasMinutes = true;
        }
      }
      if (ratingStat) {
        comp.rating = this.num365(ratingStat.value);
      }
    }

    if (hasMinutes) season.minutes = seasonMinutes;
  }

  /** Fetches per-season career tables from 365 (requires seasonKey on each call). */
  private async fetch365CareerSeasons(
    athleteId: number,
    langId: number,
    seasonDefs: Array<{ key: string; name: string; embeddedStats?: any }>,
    compLogoMap: Map<number, string | null>,
  ): Promise<Career365Season[]> {
    const seasons: Career365Season[] = [];
    const BATCH = 4;

    const hasEmbeddedRows = (stats: any): boolean =>
      Array.isArray(stats?.tables) &&
      stats.tables.some((t: any) => Array.isArray(t?.rows) && t.rows.length > 0);

    for (let i = 0; i < seasonDefs.length; i += BATCH) {
      const batch = seasonDefs.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (def) => {
          let payload: any = null;
          if (hasEmbeddedRows(def.embeddedStats)) {
            payload = { stats: def.embeddedStats };
          } else {
            payload = await this.fetchJson<any>(
              `/web/athletes/career?${this.commonParams(langId)}&athleteId=${athleteId}&seasonKey=${encodeURIComponent(def.key)}`,
              `player-career:${athleteId}:${def.key}`,
              0,
              true,
            );
          }
          if (!payload?.stats) return null;
          return this.parse365SeasonCareerPayload(def, payload, compLogoMap);
        }),
      );
      for (const s of results) {
        if (s && (s.competitions.length > 0 || s.appearances > 0 || s.goals > 0 || s.assists > 0)) {
          seasons.push(s);
        }
      }
    }

    seasons.sort((a, b) => {
      const na = parseInt(a.seasonKey.replace(/[^0-9]/g, ''), 10);
      const nb = parseInt(b.seasonKey.replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
      return b.label.localeCompare(a.label);
    });
    return seasons;
  }

  /**
   * Parses one season's `/web/athletes/career?seasonKey=` response.
   * Shape: stats.categories[] + stats.tables[] (one table per category) with rows per competition.
   */
  private parse365SeasonCareerPayload(
    seasonDef: { key: string; name: string },
    payload: any,
    compLogoMap: Map<number, string | null>,
  ): Career365Season {
    const categories: any[] = payload.stats?.categories ?? [];
    const tables: any[] = payload.stats?.tables ?? [];
    const competitions: Career365CompetitionStat[] = [];

    for (let ti = 0; ti < tables.length; ti++) {
      const table = tables[ti];
      const category = categories[ti];
      const teamId = this.num365(category?.competitorId);
      const teamName = (category?.name as string) ?? null;

      for (const row of table.rows ?? []) {
        if (!row || typeof row !== 'object') continue;
        const valByCol = new Map<number, number>();
        for (const v of row.values ?? []) {
          if (v?.columnNum != null) {
            valByCol.set(Number(v.columnNum), this.num365(v.value) ?? 0);
          }
        }

        const competitionId = this.num365(row.entityId);
        competitions.push({
          competitionId,
          competitionName: (row.title as string) ?? '—',
          competitionLogo:
            competitionId != null ? (compLogoMap.get(competitionId) ?? null) : null,
          teamId,
          teamName,
          appearances: valByCol.get(5) ?? null,
          goals: valByCol.get(1) ?? null,
          assists: valByCol.get(2) ?? null,
          minutes: null,
          yellowCards: valByCol.get(3) ?? null,
          redCards: valByCol.get(4) ?? null,
          rating: null,
        });
      }
    }

    const sum = (sel: (c: Career365CompetitionStat) => number | null) =>
      competitions.reduce((acc, c) => acc + (sel(c) ?? 0), 0);

    return {
      seasonKey: seasonDef.key,
      label: seasonDef.name || this.formatSeasonLabel365(seasonDef.key, this.num365(seasonDef.key)),
      goals: sum((c) => c.goals),
      assists: sum((c) => c.assists),
      appearances: sum((c) => c.appearances),
      minutes: null,
      competitions,
    };
  }

  private build365CareerProfile(
    athleteId: number,
    raw: any,
    competitorNames?: Map<number, string>,
  ): ThreeSixFivePlayerCareer['profile'] {
    const clubId = this.num365(raw?.clubId);
    const clubFromMap = clubId != null && clubId > 0 ? competitorNames?.get(clubId) : undefined;
    return {
      name: (raw?.name as string) ?? '—',
      shortName: (raw?.shortName as string) ?? undefined,
      position:
        (raw?.position?.name as string) ??
        (raw?.positionName as string) ??
        (typeof raw?.position === 'string' ? raw.position : null) ??
        null,
      clubName:
        clubFromMap ??
        (raw?.clubName as string) ??
        (raw?.competitorName as string) ??
        (raw?.club?.name as string) ??
        null,
      nationality:
        (raw?.nationalityName as string) ??
        (raw?.countryName as string) ??
        (raw?.nationality as string) ??
        null,
      jerseyNumber: this.num365(raw?.jerseyNumber ?? raw?.shirtNumber ?? raw?.jersey),
      age: this.num365(raw?.age),
      imageUrl: buildScores365AthletePhotoUrl(athleteId, 250),
    };
  }

  /** Coerces 365's mixed number/string stat values to a number (or null). */
  private num365(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  /** "2024" / 2024 → "2024/25"; passes through already-formatted labels. */
  private formatSeasonLabel365(raw: string, seasonNum: number | null): string {
    const trimmed = (raw || '').trim();
    if (trimmed && /\d{4}\s*[\/\-]\s*\d{2,4}/.test(trimmed)) return trimmed.replace(/\s/g, '');
    const year = seasonNum ?? (trimmed ? parseInt(trimmed.replace(/[^0-9]/g, ''), 10) : NaN);
    if (Number.isFinite(year) && year > 1900 && year < 2100) {
      const next = String((year + 1) % 100).padStart(2, '0');
      return `${year}/${next}`;
    }
    return trimmed || '—';
  }

  // ─── 9. Competition Coaches (Extract via Lineups) ─────────────────────────

  async extractCompetitionCoaches(
    competitionId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCoach[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:competition:${competitionId}:coaches:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCoach[]>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      // 1. Fetch all games for the competition
      const gamesPayload = await this.fetchJson<AllScoresPayload>(
        `/web/games/allscores/?${this.commonParams(langId)}&competitions=${competitionId}`,
        `coaches-allscores:${competitionId}`,
        86400000,
      );

      const games = gamesPayload?.games ?? [];

      // 2. Extract unique teams
      const teamGameMap = new Map<number, { gameId: number; teamName: string }>(); // teamId -> { gameId, teamName }
      for (const game of games) {
        if (!game.id) continue;
        if (game.homeCompetitor?.id && !teamGameMap.has(game.homeCompetitor.id)) {
          teamGameMap.set(game.homeCompetitor.id, { gameId: game.id, teamName: game.homeCompetitor.name || 'Unknown' });
        }
        if (game.awayCompetitor?.id && !teamGameMap.has(game.awayCompetitor.id)) {
          teamGameMap.set(game.awayCompetitor.id, { gameId: game.id, teamName: game.awayCompetitor.name || 'Unknown' });
        }
      }

      const coaches: ThreeSixFiveCoach[] = [];

      // 3. For each team, fetch game details and extract coach
      for (const [teamId, { gameId, teamName }] of teamGameMap.entries()) {
        try {
          const gamePayload = await this.fetchJson<GamePayload>(
            `/web/game/?${this.commonParams(langId)}&gameId=${gameId}`,
            `coaches-game:${gameId}`,
            86400000,
          );
          const game = gamePayload?.game;
          if (!game?.members) continue;

          // 4. Find coach in lineups.members (formation.id = 16 or 17)
          const competitor = game.homeCompetitor?.id === teamId ? game.homeCompetitor : game.awayCompetitor;
          const lineupMembers = competitor?.lineups?.members || [];
          
          const coachLineup = lineupMembers.find(
            (m: any) => m.formation?.id === 16 || m.formation?.id === 17
          );

          if (!coachLineup) continue;

          // Find the corresponding member in game.members to get athleteId
          const coachMember = game.members.find((m: any) => m.id === coachLineup.id);

          if (!coachMember || !coachMember.athleteId) continue; // Skip if no lineup/coach

          // 5 & 6. Fetch athlete details
          const athletePayload = await this.fetchJson<{ athletes?: any[] }>(
            `/web/athletes/?${this.commonParams(langId)}&athletes=${coachMember.athleteId}&fullDetails=true`,
            `coaches-athlete:${coachMember.athleteId}`,
            86400000,
          );

          const athlete = athletePayload?.athletes?.[0];
          if (!athlete) continue;

          // 7. Construct image URL and coach object
          const imageVersion = athlete.imageVersion ?? coachMember.imageVersion ?? null;
          // Note: using generic coach photo builder (with imageVersion if supported)
          const imageUrl = imageVersion
            ? `https://imagecache.365scores.com/image/upload/f_png,w_200,h_200,c_limit,q_auto:eco,dpr_2,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/v${imageVersion}/Athletes/${coachMember.athleteId}`
            : `https://imagecache.365scores.com/image/upload/f_png,w_200,h_200,c_limit,q_auto:eco,dpr_2,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/Athletes/${coachMember.athleteId}`;

          coaches.push({
            athleteId: coachMember.athleteId,
            teamId,
            teamName,
            name: athlete.name || coachMember.name || 'Unknown',
            nationality: athlete.countryName,
            bio: athlete.shortName,
            imageVersion,
            imageUrl,
            role: coachMember.formation?.id === 16 ? 'head_coach' : 'assistant_coach',
          });
        } catch (err: unknown) {
          logger.warn(
            `[365Scores] extractCompetitionCoaches team ${teamId} in game ${gameId} failed:`,
            (err as Error)?.message,
          );
        }
      }

      await redisCacheService.set(cacheKey, coaches, 86_400_000); // cache for 1 day
      return { data: coaches, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] extractCompetitionCoaches(${competitionId}) failed:`,
        (err as Error)?.message,
      );
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
    const { short } = classifyScores365MatchStatus(game as Parameters<typeof classifyScores365MatchStatus>[0]);
    // Not-yet-played states: scheduled or postponed to a future date.
    if (short === 'NS' || short === 'PST' || short === 'TBD') return 'upcoming';
    // Terminal states (played to a result or cancelled/abandoned/walkover).
    if (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'finished';
    // Everything else (1H/2H/HT/ET/BT/P/INT/SUSP/LIVE) is in-play or resumable.
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

  /** Build competitionId → { name, country } from the allscores payload lookups. */
  private buildCompetitionMeta(payload: AllScoresPayload): CompetitionMetaMap {
    const countriesById = new Map<number, string>();
    for (const c of payload.countries ?? []) {
      if (c.id != null && c.name) countriesById.set(c.id, c.name);
    }
    return this.buildCompetitionMetaFromCatalog(payload.competitions ?? [], countriesById);
  }

  private buildCompetitionMetaFromCatalog(
    competitions: Scores365CompetitionMeta[],
    countriesById: Map<number, string>,
  ): CompetitionMetaMap {
    const meta: CompetitionMetaMap = new Map();
    for (const comp of competitions) {
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

  private async storeTrackedCompetitionIds(meta: CompetitionMetaMap): Promise<void> {
    if (!meta.size) return;
    const existing = (await redisCacheService.get<number[]>(TRACKED_COMPETITIONS_KEY)) ?? [];
    const merged = [...new Set([...existing, ...meta.keys()])].slice(
      0,
      trackedCompetitionStoreLimit(),
    );
    await redisCacheService.set(TRACKED_COMPETITIONS_KEY, merged, TRACKED_COMPETITIONS_TTL_MS);
  }

  private async loadAllCompetitionIds(): Promise<number[]> {
    const fromCatalog = (await redisCacheService.get<number[]>(COMPETITIONS_CATALOG_CACHE_KEY)) ?? [];
    const fromRedis = (await redisCacheService.get<number[]>(TRACKED_COMPETITIONS_KEY)) ?? [];
    const fromLeagues = await prisma.cachedLeague.findMany({
      where: { leagueId: { gte: SCORES365_LEAGUE_ID_OFFSET } },
      select: { leagueId: true },
    });
    const fromLeagueIds = fromLeagues
      .map((r) => r.leagueId - SCORES365_LEAGUE_ID_OFFSET)
      .filter((id) => id > 0);

    return [...new Set([...fromCatalog, ...fromRedis, ...fromLeagueIds, ...DEFAULT_TRACKED_COMPETITIONS])];
  }

  private async loadTrackedCompetitionIds(): Promise<number[]> {
    const merged = await this.loadAllCompetitionIds();
    return merged.slice(0, supplementCompetitionLimit());
  }

  private async loadCompetitionMetaForIds(competitionIds: number[]): Promise<CompetitionMetaMap> {
    const meta: CompetitionMetaMap = new Map();
    const leagueIds = competitionIds.map((id) => scores365CompetitionToLeagueId(id));
    const rows = await prisma.cachedLeague.findMany({
      where: { leagueId: { in: leagueIds } },
      select: { leagueId: true, name: true, country: true, logo: true, fullData: true },
    });
    for (const row of rows) {
      const competitionId = row.leagueId - SCORES365_LEAGUE_ID_OFFSET;
      if (competitionId <= 0) continue;
      const full = row.fullData as { hasStandings?: boolean } | null;
      meta.set(competitionId, {
        name: row.name,
        country: row.country ?? undefined,
        logo: row.logo ?? undefined,
        hasStandings: full?.hasStandings,
      });
    }
    return meta;
  }

  /**
   * League-agnostic persistence for the /allscores/ feed (non-WC competitions).
   * Unlike persistFinishedFixtures (WC-scoped), candidate DB rows are loaded by a
   * date window across ALL leagues so resolveDbRow can reuse an existing
   * API-Football row when present; unmatched games become synthetic fixtures with
   * a namespaced leagueId derived from the 365 competitionId.
   */
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
        if (already) {
          const candidateRow = this.resolveDbRow(item.raw, dbRows);
          const stillLiveInDb =
            !!candidateRow &&
            candidateRow.leagueId >= SCORES365_LEAGUE_ID_OFFSET &&
            LIVE_STATUSES.includes(candidateRow.status);
          if (!stillLiveInDb) continue;
        }
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

    const liveGameIds = items.filter((i) => i.phase === 'live').map((i) => i.gameId);
    if (liveGameIds.length > 0) {
      void sync365SyntheticLiveSnapshots({ gameIds: liveGameIds, language: 'en' });
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
