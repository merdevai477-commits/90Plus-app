/**
 * 365Scores — secondary World Cup data source.
 * Each public method maps to exactly one upstream endpoint (Single Responsibility).
 * Controllers must not call this directly; use football-data-cache.service wrappers.
 */

import type { Prisma } from '@prisma/client';
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
  resolveScores365AppLanguage,
  resolveScores365SearchLangId,
  scores365CompetitionToLeagueId,
  SCORES365_LEAGUE_ID_OFFSET,
  synthesizeBaseFrom365Game,
  sync365SyntheticLiveSnapshots,
  classifyScores365MatchStatus,
} from './scores365-experiment.service';
import {
  buildScores365AthletePhotoUrl,
  buildScores365CoachPhotoUrl,
} from '../utils/scores365-athlete-photo';
import {
  competitionIndexRecords,
  DEFAULT_ARABIC_COUNTRY_ID,
  expandSearchQueries,
  isIndexedCoachId,
  isPlayerOrientedBoost,
  normalizeSearchText,
  queryHasArabic,
  rankByScore,
  scoreAthlete,
  scoreCompetition,
  scoreCompetitor,
  scoreSearchName,
} from '../utils/football-search-index';
import {
  calendarDateFromKickoff,
  calendarTodayKey,
  offsetCalendarDateKey,
  toScores365QueryDate,
} from '../utils/calendar-day-bounds.util';
import { scores365RateLimitMapMaxEntries } from '../config/football-reliability-rollout.config';
import { asTerminalFinishedFixture } from '../utils/fixture-terminal.util';
import {
  findReplacedSyntheticFixture,
  isHotAllScoresPersistItem,
  isAllScoresLiveItem,
  coerceAllScoresLiveStatus,
} from '../utils/scores365-live-identity.util';

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

/**
 * 365Scores competitor (club / national team) logo URL.
 * Verified pattern: `<transforms>/v<imageVersion>/Competitors/<competitorId>`.
 * imageVersion defaults to a low value when the payload omits it (still resolves).
 */
function buildCompetitorLogoUrl(
  competitorId: number,
  imageVersion?: number | null,
  size: 64 | 128 = 128,
): string {
  const v = imageVersion ?? 1;
  return `https://imagecache.365scores.com/image/upload/f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2/v${v}/Competitors/${competitorId}`;
}

function emptySquadGroups(): Record<SquadPositionGroup, ThreeSixFiveSquadPlayer[]> {
  return {
    goalkeeper: [],
    defender: [],
    midfielder: [],
    forward: [],
    other: [],
  };
}

function isSquadStaff(position: string | null | undefined): boolean {
  if (!position) return false;
  return /coach|manager|مدرب|staff/.test(position.toLowerCase());
}

function classifySquadPosition(
  position: string | null | undefined,
  formation?: string | null,
): SquadPositionGroup {
  const s = `${position ?? ''} ${formation ?? ''}`.toLowerCase();
  if (!s.trim()) return 'other';
  if (/gk|goal\s*keep|حارس|keeper/.test(s)) return 'goalkeeper';
  if (
    /\bcb\b|\blb\b|\brb\b|\blwb\b|\brwb\b|\bwb\b|defender|centre back|center back|left back|right back|wing back|مدافع/.test(
      s,
    )
  ) {
    return 'defender';
  }
  if (/\bdm\b|\bcm\b|\bam\b|\bcdm\b|\bcam\b|\blm\b|\brm\b|midfield|وسط/.test(s)) {
    return 'midfielder';
  }
  if (
    /\bst\b|\bcf\b|\bss\b|\blw\b|\brw\b|\bfw\b|forward|striker|winger|attacker|مهاجم|wing/.test(s)
  ) {
    return 'forward';
  }
  return 'other';
}

function classifySquadPositionFrom365(athlete: {
  position?: { id?: number; name?: string };
  formationPosition?: { id?: number; name?: string };
}): SquadPositionGroup {
  const pid = athlete.position?.id;
  if (pid === 1) return 'goalkeeper';
  if (pid === 2) return 'defender';
  if (pid === 3) return 'midfielder';
  if (pid === 4) return 'forward';
  return classifySquadPosition(athlete.position?.name, athlete.formationPosition?.name);
}

function isSquadsStaffAthlete(athlete: {
  position?: { id?: number; name?: string };
  formationPosition?: { id?: number; name?: string };
}): boolean {
  const fid = athlete.formationPosition?.id;
  if (fid === 16 || fid === 17) return true;
  if (athlete.position?.id === 0) return true;
  return (
    isSquadStaff(athlete.position?.name) || isSquadStaff(athlete.formationPosition?.name)
  );
}

function isFriendlyCompetitionName(name: string): boolean {
  return /friendly|friendlies|ودية|ودّي|وديات/i.test(name);
}

function isCurrentDisplayCompetition(
  meta: CompetitorCompetitionMeta,
  mainCompetitionId: number | null,
): boolean {
  if (meta.hideOnCatalog === true || meta.hideOnSearch === true) return false;
  if (isFriendlyCompetitionName(meta.name ?? '')) return false;
  if (mainCompetitionId != null && meta.id === mainCompetitionId) return true;
  return meta.currentSeasonNum != null && meta.currentSeasonNum > 0;
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

export interface ThreeSixFivePlayerTransfer {
  competitorId: number | null;
  competitorName: string | null;
  competitorLogo: string | null;
  date: string | null;
  transferTitle: string | null;
  price: string | null;
  active: boolean;
}

export interface ThreeSixFivePlayerBasicInfo {
  athleteId: number;
  name: string;
  shortName?: string;
  club?: string;
  nationality?: string;
  position?: string;
  imageUrl?: string | null;
  dateOfBirth?: string | null;
  height?: string | null;
  age?: number | null;
  transfers?: ThreeSixFivePlayerTransfer[];
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
  positionId?: number | null;
  formationPositionId?: number | null;
}

export interface ThreeSixFiveSearchCompetition {
  competitionId: number;
  name: string;
  country: string | null;
  logo: string | null;
  hasStandings: boolean;
}

// ─── Competitor (club / national team) profile shapes ───────────────────────

/** A competition the competitor participates in (for standings/stats tabs). */
export interface ThreeSixFiveCompetitorCompetition {
  id: number;
  name: string;
  countryId: number | null;
  country: string | null;
  logo: string | null;
  hasStandings: boolean;
  hasStats: boolean;
  hasTransfers: boolean;
}

/** Club or national-team header/info block (type 1 = club, 2 = national team). */
export interface ThreeSixFiveCompetitorInfo {
  competitorId: number;
  sportId: number;
  type: number;
  name: string;
  longName: string | null;
  symbolicName: string | null;
  nameForURL: string | null;
  countryId: number | null;
  country: string | null;
  logo: string | null;
  color: string | null;
  awayColor: string | null;
  mainCompetitionId: number | null;
  hasSquad: boolean;
  hasTransfers: boolean;
  isNationalTeam: boolean;
  competitions: ThreeSixFiveCompetitorCompetition[];
  founded?: number | null;
  stadium?: string | null;
}

/** Grouped matches for a competitor's Matches tab. */
export interface ThreeSixFiveCompetitorMatches {
  live: FixtureFromAPI[];
  upcoming: FixtureFromAPI[];
  finished: FixtureFromAPI[];
}

export interface ThreeSixFiveCompetitorTransfer {
  athleteId: number;
  athleteName: string;
  athletePhoto: string | null;
  positionName: string | null;
  isArrival: boolean;
  price: string | null;
  date: string | null;
  clubId: number | null;
  clubName: string | null;
  clubLogo: string | null;
}

export interface ThreeSixFiveCompetitorTransfers {
  in: ThreeSixFiveCompetitorTransfer[];
  out: ThreeSixFiveCompetitorTransfer[];
}

export interface ThreeSixFiveLeagueTransfer {
  athleteId: number;
  athleteName: string;
  athletePhoto: string | null;
  date: string | null;
  price: string | null;
  typeName: string | null;
  fromClubId: number | null;
  fromClubName: string | null;
  fromClubLogo: string | null;
  toClubId: number | null;
  toClubName: string | null;
  toClubLogo: string | null;
}

export interface ThreeSixFiveCompetitionTransfers {
  competitionId: number;
  competitionName: string;
  competitionLogo: string | null;
  transfers: ThreeSixFiveLeagueTransfer[];
}

export interface ThreeSixFiveStatLeaderRow {
  rank: number;
  athleteId: number;
  name: string;
  photo: string | null;
  value: string;
  competitorId: number | null;
  leftClub: boolean;
  positionName?: string | null;
}

export interface ThreeSixFiveStatLeaderboard {
  key: number;
  name: string;
  rows: ThreeSixFiveStatLeaderRow[];
}

export interface ThreeSixFiveCompetitorStats {
  competitionId: number;
  leaderboards: ThreeSixFiveStatLeaderboard[];
}

/** A competitor match in combined search results (club or national team). */
export interface ThreeSixFiveSearchCompetitor {
  competitorId: number;
  name: string;
  type: number;
  countryId: number | null;
  country: string | null;
  logo: string | null;
  isNationalTeam: boolean;
  popularityRank?: number | null;
  longName?: string | null;
  symbolicName?: string | null;
}

export type SquadPositionGroup = 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'other';

export interface ThreeSixFiveSquadPlayer {
  athleteId: number;
  name: string;
  shortName: string;
  position: string | null;
  positionGroup: SquadPositionGroup;
  jerseyNumber: number | null;
  photo: string | null;
  age?: number | null;
  height?: string | null;
  nationality?: string | null;
}

export interface ThreeSixFiveCompetitorSquad {
  competitorId: number;
  players: ThreeSixFiveSquadPlayer[];
  groups: Record<SquadPositionGroup, ThreeSixFiveSquadPlayer[]>;
}

/** Combined text-search results: clubs, national teams, players, coaches, competitions. */
export interface ThreeSixFiveSearchResults {
  clubs: ThreeSixFiveSearchCompetitor[];
  nationalTeams: ThreeSixFiveSearchCompetitor[];
  players: ThreeSixFiveSearchAthlete[];
  coaches: ThreeSixFiveSearchAthlete[];
  competitions: ThreeSixFiveSearchCompetition[];
}

export interface ThreeSixFiveAthleteProfile {
  athleteId: number;
  name: string;
  shortName?: string;
  nationality?: string | null;
  bio?: string | null;
  age?: number | null;
  dateOfBirth?: string | null;
  height?: string | null;
  contractUntil?: string | null;
  imageUrl: string | null;
  imageVersion?: number | null;
  teamId?: number | null;
  teamName?: string | null;
  position?: string | null;
  role?: 'head_coach' | 'assistant_coach' | 'player';
  trophies?: Career365Trophy[];
  transfers?: ThreeSixFivePlayerTransfer[];
}

export interface ThreeSixFiveCompetitionProfile {
  competitionId: number;
  name: string;
  country: string | null;
  logo: string | null;
  hasStandings: boolean;
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
    dateOfBirth?: string | null;
    height?: string | null;
    imageUrl: string | null;
    transfers?: ThreeSixFivePlayerTransfer[];
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
  shortName?: string;
  nationality?: string;
  bio?: string;
  age?: number | null;
  contractUntil?: string | null;
  imageUrl: string | null;
  imageVersion?: number | null;
  role: 'head_coach' | 'assistant_coach';
  trophies?: Career365Trophy[];
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

/** Rich competition metadata from /web/competitors/ (superset of the catalog shape). */
interface CompetitorCompetitionMeta {
  id: number;
  countryId?: number;
  sportId?: number;
  name?: string;
  hasStandings?: boolean;
  hasStats?: boolean;
  hasTransfers?: boolean;
  nameForURL?: string;
  currentSeasonNum?: number;
  imageVersion?: number;
  isActive?: boolean;
  hideOnCatalog?: boolean;
  hideOnSearch?: boolean;
}

interface CompetitorInfoEntry {
  id: number;
  countryId?: number;
  sportId?: number;
  name?: string;
  longName?: string;
  symbolicName?: string;
  nameForURL?: string;
  type?: number;
  imageVersion?: number;
  color?: string;
  awayColor?: string;
  mainCompetitionId?: number;
  hasSquad?: boolean;
  hasTransfers?: boolean;
  competitions?: number[];
  founded?: number;
  establishmentYear?: number;
  yearFounded?: number;
  stadium?: string;
  venueName?: string;
  venue?: { name?: string };
}

interface CompetitorInfoPayload {
  competitors?: CompetitorInfoEntry[];
  countries?: Scores365CountryMeta[];
  competitions?: CompetitorCompetitionMeta[];
}

interface TransfersPayload {
  transfers?: Array<{
    id: number;
    type?: number;
    origin?: number;
    target?: number;
    time?: string;
    price?: string;
    athleteId?: number;
    statusName?: string;
    positionId?: number;
    ImageVersion?: number;
    isArrival?: boolean;
    isDeparture?: boolean;
    competitionId?: number;
  }>;
  athletes?: Array<{
    id: number;
    name?: string;
    shortName?: string;
    clubId?: number;
    clubName?: string;
    nationalityId?: number;
    imageVersion?: number;
  }>;
  competitors?: Array<{
    id: number;
    name?: string;
    imageVersion?: number;
    type?: number;
  }>;
}

interface StatsPayload {
  stats?: {
    athletesStats?: Array<{
      id: number;
      name?: string;
      competitionId?: number;
      rows?: Array<{
        position: number;
        secondaryStatName?: string;
        entity?: {
          id: number;
          name?: string;
          shortName?: string;
          competitorId?: number;
          positionName?: string;
          isLeftClub?: boolean;
          imageVersion?: number;
        };
        stats?: Array<{ typeId: number; value: string }>;
      }>;
    }>;
  };
}

interface SquadsAthlete {
  id: number;
  name?: string;
  shortName?: string;
  jerseyNum?: number;
  age?: number;
  height?: number | string;
  clubId?: number;
  nationalityId?: number;
  imageVersion?: number;
  position?: { id?: number; name?: string };
  formationPosition?: { id?: number; name?: string; order?: number };
}

interface SquadsPayload {
  squads?: Array<{
    competitorId: number;
    athletes?: SquadsAthlete[];
  }>;
  countries?: Scores365CountryMeta[];
  competitors?: Array<{ id: number; name?: string }>;
}

interface SearchEntitiesFetch extends ThreeSixFiveSearchResults {
  upstreamFailed?: boolean;
}

interface SearchAllPayload {
  countries?: Scores365CountryMeta[];
  competitors?: Array<{
    id: number;
    countryId?: number;
    sportId?: number;
    name?: string;
    longName?: string;
    symbolicName?: string;
    type?: number;
    imageVersion?: number;
    hideOnSearch?: boolean;
    popularityRank?: number;
  }>;
  athletes?: Array<{
    id: number;
    name?: string;
    shortName?: string;
    clubId?: number;
    clubName?: string;
    nationalityId?: number;
    sportId?: number;
    imageVersion?: number;
    position?: { id?: number; name?: string };
    formationPosition?: { id?: number; name?: string };
  }>;
}

function emptySearchResults(): ThreeSixFiveSearchResults {
  return { clubs: [], nationalTeams: [], players: [], coaches: [], competitions: [] };
}

function isCoachSearchAthlete(a: {
  athleteId?: number;
  id?: number;
  position?: { id?: number };
  formationPosition?: { id?: number };
  positionId?: number | null;
  formationPositionId?: number | null;
}): boolean {
  const id = a.athleteId ?? a.id ?? 0;
  const posId = a.positionId ?? a.position?.id;
  const formId = a.formationPositionId ?? a.formationPosition?.id;
  if (posId === 0) return true;
  if (formId === 16 || formId === 17) return true;
  return isIndexedCoachId(id);
}

function parseFoundedYear(c: CompetitorInfoEntry): number | null {
  const raw = c.founded ?? c.establishmentYear ?? c.yearFounded;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 1800 && raw < 2100) return raw;
  return null;
}

function parseStadiumName(c: CompetitorInfoEntry): string | null {
  const s = c.stadium ?? c.venueName ?? c.venue?.name;
  return typeof s === 'string' && s.trim() ? s.trim() : null;
}

/** competitionId → resolved league metadata (for synthetic non-WC fixtures + league cache). */
interface CompetitionMeta {
  name?: string;
  country?: string;
  logo?: string;
  hasStandings?: boolean;
}
type CompetitionMetaMap = Map<number, CompetitionMeta>;

export function setBoundedMapEntry<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  maxEntries: number,
): void {
  if (map.has(key)) map.delete(key);
  while (map.size >= maxEntries) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
  map.set(key, value);
}

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
const FINISHED_MARKER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHED_FIXTURE_PERSIST_SELECT = {
  id: true,
  fixtureId: true,
  leagueId: true,
  leagueName: true,
  leagueLogo: true,
  leagueCountry: true,
  leagueSeason: true,
  leagueRound: true,
  homeTeamId: true,
  homeTeamName: true,
  homeTeamLogo: true,
  awayTeamId: true,
  awayTeamName: true,
  awayTeamLogo: true,
  homeScore: true,
  awayScore: true,
  homeHalftimeScore: true,
  awayHalftimeScore: true,
  matchDate: true,
  matchTimestamp: true,
  status: true,
  statusLong: true,
  elapsed: true,
  venue: true,
  referee: true,
  fullData: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CachedFixtureSelect;
type CachedFixturePersistenceRow = Prisma.CachedFixtureGetPayload<{
  select: typeof CACHED_FIXTURE_PERSIST_SELECT;
}>;
const TRACKED_COMPETITIONS_KEY = '365:tracked_competition_ids';
const TRACKED_COMPETITIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COMPETITIONS_CATALOG_CACHE_KEY = '365:competitions_catalog';
const COMPETITIONS_SEARCH_INDEX_KEY = (langId: number) => `365:competitions_search_index:v1:${langId}`;
const FIXTURES_SYNC_CURSOR_KEY = '365:fixtures_sync_cursor';
const SUPPLEMENT_COMPETITION_BATCH = 6;
/** Always supplement / rotate these 365 competitionIds (lower tiers often missing from allscores). */
const DEFAULT_TRACKED_COMPETITIONS = [
  72, // Liga Profesional Argentina
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
  const raw = parseInt(process.env.SCORES365_FIXTURES_SYNC_BATCH || '15', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

function fixturesHotPageCap(): number {
  const raw = parseInt(process.env.SCORES365_FIXTURES_HOT_PAGE_CAP || '6', 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 12) : 6;
}

function trackedCompetitionStoreLimit(): number {
  const raw = parseInt(process.env.SCORES365_TRACKED_COMPETITIONS_LIMIT || '2000', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 2000;
}

function useOnlyMajorGames(): boolean {
  return process.env.SCORES365_ONLY_MAJOR_GAMES === 'true';
}

export function selectCompetitionFixturesBatch(
  allIds: number[],
  priorityIds: number[],
  batchSize: number,
  cursor: number,
): { ids: number[]; nextCursor: number; priorityCount: number } {
  if (!allIds.length || batchSize <= 0) {
    return { ids: [], nextCursor: 0, priorityCount: 0 };
  }
  const allSet = new Set(allIds);
  const prioritySlice = priorityIds
    .filter((id) => allSet.has(id))
    .slice(0, Math.max(0, batchSize - 1));
  const prioritySet = new Set(prioritySlice);
  const remainingSlots = Math.max(0, batchSize - prioritySlice.length);
  const roundRobin: number[] = [];
  let scanned = 0;
  for (let i = 0; i < allIds.length && roundRobin.length < remainingSlots; i++) {
    const id = allIds[(cursor + i) % allIds.length];
    scanned = i + 1;
    if (!prioritySet.has(id)) roundRobin.push(id);
  }
  return {
    ids: [...prioritySlice, ...roundRobin],
    // Advance past every catalog entry inspected, including hot entries that
    // were skipped because they already occupied a priority slot.
    nextCursor: (cursor + Math.max(scanned, 1)) % allIds.length,
    priorityCount: prioritySlice.length,
  };
}

class ThreeSixFiveScoresService {
  private lastUpstreamFetch = new Map<string, number>();
  private inFlight = new Map<string, Promise<unknown>>();
  private liveSubscriptions = new Map<number, { expiresAt: number }>();
  private livePollTimer: ReturnType<typeof setInterval> | null = null;

  getInProcessCacheSizes(): { lastUpstreamFetch: number; inFlight: number; liveSubscriptions: number } {
    return {
      lastUpstreamFetch: this.lastUpstreamFetch.size,
      inFlight: this.inFlight.size,
      liveSubscriptions: this.liveSubscriptions.size,
    };
  }

  isEnabled(): boolean {
    return isScores365ExperimentEnabled();
  }

  /** Extend live-view subscription (ref-count via TTL refresh from cache wrappers). */
  touchLiveGameSubscription(gameId: number): void {
    setBoundedMapEntry(
      this.liveSubscriptions,
      gameId,
      { expiresAt: Date.now() + LIVE_SUBSCRIPTION_TTL_MS },
      500,
    );
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
    options?: { force?: boolean; persist?: boolean },
  ): Promise<ThreeSixFiveResult<ThreeSixFiveFixtureItem[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const loaded = await this.loadAllScoresItems(startDate, endDate, language, options);
      if (!loaded) return { data: null, source: null };
      if (options?.persist !== false && !loaded.fromCache) {
        await this.persistAllScoresFixtures(loaded.items, loaded.competitionMeta);
        await this.storeTrackedCompetitionIds(loaded.competitionMeta);
      }
      return { data: loaded.items, source: '365scores' };
    } catch (err: unknown) {
      logger.error('[365Scores] getAllScores failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  /**
   * Authoritative live tick: one /allscores/ call for yesterday–tomorrow (Cairo),
   * persist live + just-ended rows only, REPLACE the Redis 365 live list.
   */
  async syncLiveSnapshotFromAllScores(
    language?: string | null,
  ): Promise<{ live: number; ended: number; retired: number }> {
    if (!this.isEnabled()) return { live: 0, ended: 0, retired: 0 };

    const start = offsetCalendarDateKey(calendarTodayKey(), -1);
    const end = offsetCalendarDateKey(calendarTodayKey(), 1);
    const loaded = await this.loadAllScoresItems(start, end, language, { force: true });
    if (!loaded) {
      logger.warn('[OtherLeagues-365] live allscores tick skipped — upstream fetch failed');
      return { live: 0, ended: 0, retired: 0 };
    }

    const liveItems = loaded.items.filter((item) => isAllScoresLiveItem(item));
    const liveFixtures: FixtureFromAPI[] = [];
    for (const item of liveItems) {
      const mapped = await this.mapAllScoresItemToLiveFixture(item, loaded.competitionMeta);
      if (mapped) liveFixtures.push(mapped);
    }
    if (liveItems.length > 0 && liveFixtures.length === 0) {
      logger.warn(
        `[OtherLeagues-365] live tick mapped 0 fixtures despite ${liveItems.length} allscores live rows — keeping previous Redis list`,
      );
      return { live: 0, ended: 0, retired: 0 };
    }

    const { replace365LiveFixturesSnapshot } = await import('./live-fixture-cache.service');
    await replace365LiveFixturesSnapshot(liveFixtures);

    const hotItems = loaded.items.filter((item) => isHotAllScoresPersistItem(item));
    const persistResult = await this.persistAllScoresFixtures(hotItems, loaded.competitionMeta, {
      refreshLiveDetails: false,
    });

    logger.info(
      `[OtherLeagues-365] live tick: ${liveFixtures.length} live (allscores ${liveItems.length}), ${hotItems.length - liveItems.length} just-ended, ${persistResult.retiredIds.length} retired (${start}..${end}, ${loaded.items.length} allscores)`,
    );
    return {
      live: liveFixtures.length,
      ended: Math.max(0, hotItems.length - liveItems.length),
      retired: persistResult.retiredIds.length,
    };
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
      const searchIndex: ThreeSixFiveSearchCompetition[] = leagueRecords.map((r) => ({
        competitionId: (r.fullData as { competitionId: number }).competitionId,
        name: r.name,
        country: r.country ?? null,
        logo: r.logo ?? null,
        hasStandings: Boolean((r.fullData as { hasStandings?: boolean }).hasStandings),
      }));
      await redisCacheService.set(
        COMPETITIONS_SEARCH_INDEX_KEY(langId),
        searchIndex,
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
   * Competitions with matches today/tomorrow are synced first each tick.
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
    const priorityIds = await this.loadCompetitionIdsWithMatchesNearToday();
    const selection = selectCompetitionFixturesBatch(allIds, priorityIds, batchSize, cursor);
    const slice = selection.ids;
    const nextCursor = selection.nextCursor;

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
        `[365Scores] fixtures batch synced ${fixtures} fixtures for ${slice.length}/${allIds.length} competitions (priority=${selection.priorityCount}, cursor ${cursor}→${nextCursor})`,
      );
    }

    return { batchSize: slice.length, fixtures, cursor: nextCursor, total: allIds.length };
  }

  /** Competition IDs that already have synthetic fixtures for today or tomorrow. */
  private async loadCompetitionIdsWithMatchesNearToday(): Promise<number[]> {
    try {
      const { calendarTodayKey, offsetCalendarDateKey, calendarDayBounds } = await import(
        '../utils/calendar-day-bounds.util'
      );
      const today = calendarTodayKey();
      const tomorrow = offsetCalendarDateKey(today, 1);
      const { start } = calendarDayBounds(today);
      const { end } = calendarDayBounds(tomorrow);
      const rows = await prisma.cachedFixture.findMany({
        where: {
          leagueId: { gte: SCORES365_LEAGUE_ID_OFFSET },
          matchDate: { gte: start, lte: end },
        },
        select: { leagueId: true },
        distinct: ['leagueId'],
      });
      return rows
        .map((r) => r.leagueId - SCORES365_LEAGUE_ID_OFFSET)
        .filter((id) => id > 0);
    } catch (err: unknown) {
      logger.debug(
        '[365Scores] loadCompetitionIdsWithMatchesNearToday failed:',
        (err as Error)?.message,
      );
      return [];
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
    options?: { bypassExperimentGate?: boolean },
  ): Promise<ThreeSixFiveResult<ThreeSixFiveLineupPlayer[]>> {
    if (!options?.bypassExperimentGate && !this.isEnabled()) {
      return { data: null, source: null };
    }

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
      logger.debug(
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
      logger.debug(
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
    options?: { force?: boolean },
  ): Promise<ThreeSixFiveResult<ThreeSixFiveStandingRow[]>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:standings:${competitionId}:${langId}`;
      if (!options?.force) {
        const cached = await redisCacheService.get<ThreeSixFiveStandingRow[]>(cacheKey);
        if (cached) return { data: cached, source: '365scores' };
      }

      const payload = await this.fetchJson<StandingsPayload>(
        `/web/standings/?${this.commonParams(langId)}&competitions=${competitionId}`,
        `standings:${competitionId}:${langId}`,
        300_000,
        options?.force === true,
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
        imageUrl: buildScores365AthletePhotoUrl(a.id, 68),
      }));

    await redisCacheService.set(cacheKey, athletes, 300_000);
    return athletes;
  }

  // ─── 5c. Competitor (club / national team) profile ───────────────────────

  /**
   * Club / national-team header + the competitions it plays in.
   * Cached 6h in Redis and mirrored to Postgres (Cached365Competitor) for durability.
   */
  async getCompetitorInfo(
    competitorId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorInfo>> {
    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:competitor:${competitorId}:info:v3:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCompetitorInfo>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<CompetitorInfoPayload>(
        `/web/competitors/?${this.commonParams(langId)}&competitors=${competitorId}&fullDetails=true`,
        `competitor-info:${competitorId}`,
        3_600_000,
      );
      const c =
        payload?.competitors?.find((x) => x.id === competitorId) ?? payload?.competitors?.[0];
      if (!c?.id) return { data: null, source: null };

      const countriesById = new Map<number, string>();
      for (const country of payload?.countries ?? []) {
        if (country.id != null && country.name) countriesById.set(country.id, country.name);
      }
      const competitionsById = new Map<number, CompetitorCompetitionMeta>();
      for (const comp of payload?.competitions ?? []) {
        if (comp.id != null) competitionsById.set(comp.id, comp);
      }

      const competitions: ThreeSixFiveCompetitorCompetition[] = (c.competitions ?? [])
        .map((id) => {
          const meta = competitionsById.get(id);
          if (!meta?.name) return null;
          if (!isCurrentDisplayCompetition(meta, c.mainCompetitionId ?? null)) return null;
          return {
            id,
            name: meta.name,
            countryId: meta.countryId ?? null,
            country:
              meta.countryId != null ? (countriesById.get(meta.countryId) ?? null) : null,
            logo: buildLeagueLogoUrl(id, meta.imageVersion ?? null),
            hasStandings: meta.hasStandings === true,
            hasStats: meta.hasStats === true,
            hasTransfers: meta.hasTransfers === true,
          } satisfies ThreeSixFiveCompetitorCompetition;
        })
        .filter((x): x is ThreeSixFiveCompetitorCompetition => x !== null);

      const info: ThreeSixFiveCompetitorInfo = {
        competitorId: c.id,
        sportId: c.sportId ?? 1,
        type: c.type ?? 1,
        name: c.name ?? '—',
        longName: c.longName ?? null,
        symbolicName: c.symbolicName ?? null,
        nameForURL: c.nameForURL ?? null,
        countryId: c.countryId ?? null,
        country: c.countryId != null ? (countriesById.get(c.countryId) ?? null) : null,
        logo: buildCompetitorLogoUrl(c.id, c.imageVersion),
        color: c.color ?? null,
        awayColor: c.awayColor ?? null,
        mainCompetitionId: c.mainCompetitionId ?? null,
        hasSquad: c.hasSquad === true,
        hasTransfers: c.hasTransfers === true,
        isNationalTeam: (c.type ?? 1) === 2,
        competitions,
        founded: parseFoundedYear(c),
        stadium: parseStadiumName(c),
      };

      await redisCacheService.set(cacheKey, info, 3_600_000);
      void this.persistCompetitorInfo(info, langId);
      return { data: info, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getCompetitorInfo(${competitorId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  private async persistCompetitorInfo(
    info: ThreeSixFiveCompetitorInfo,
    langId: number,
  ): Promise<void> {
    try {
      const row = {
        sportId: info.sportId,
        type: info.type,
        name: info.name,
        longName: info.longName,
        symbolicName: info.symbolicName,
        nameForURL: info.nameForURL,
        countryId: info.countryId,
        country: info.country,
        logo: info.logo,
        mainCompetitionId: info.mainCompetitionId,
        isNationalTeam: info.isNationalTeam,
        langId,
        fullData: info as unknown as Prisma.InputJsonValue,
      };
      await prisma.cached365Competitor.upsert({
        where: { competitorId: info.competitorId },
        create: { competitorId: info.competitorId, ...row },
        update: row,
      });
    } catch (err: unknown) {
      logger.debug(
        `[365Scores] persistCompetitorInfo(${info.competitorId}) failed:`,
        (err as Error)?.message,
      );
    }
  }

  /**
   * Live / upcoming / finished matches for a competitor across all competitions.
   * Fixtures are synthesized into the app Fixture shape and persisted to CachedFixture
   * (Postgres) in the background so calendar/detail screens stay consistent.
   */
  async getCompetitorMatches(
    competitorId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorMatches>> {
    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:competitor:${competitorId}:matches:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCompetitorMatches>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const { games, competitionMeta } = await this.fetchCompetitorGames(competitorId, langId);
      if (!games.length) return { data: null, source: null };

      const live: FixtureFromAPI[] = [];
      const upcoming: FixtureFromAPI[] = [];
      const finished: FixtureFromAPI[] = [];
      for (const game of games) {
        const fixture = this.buildCompetitorFixture(game, competitionMeta);
        const phase = this.classifyPhase(game);
        if (phase === 'live') live.push(fixture);
        else if (phase === 'upcoming') upcoming.push(fixture);
        else finished.push(fixture);
      }

      const asc = (a: FixtureFromAPI, b: FixtureFromAPI) =>
        new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime();
      live.sort(asc);
      upcoming.sort(asc);
      finished.sort((a, b) => asc(b, a)); // most recent first

      const result: ThreeSixFiveCompetitorMatches = { live, upcoming, finished };

      // Durable persistence via the shared allscores path (writes CachedFixture rows).
      void this.persistAllScoresFixtures(
        games.map((g) => this.toFixtureItem(g)),
        competitionMeta,
      );

      const ttlMs = live.length > 0 ? 60_000 : 300_000;
      await redisCacheService.set(cacheKey, result, ttlMs);
      return { data: result, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getCompetitorMatches(${competitorId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  private buildCompetitorFixture(
    game: Scores365Game,
    competitionMeta: CompetitionMetaMap,
  ): FixtureFromAPI {
    const compId = game.competitionId;
    const meta = compId != null ? competitionMeta.get(compId) : undefined;
    const kickoff = game.startTime ? new Date(game.startTime) : new Date();
    const season = Number.isNaN(kickoff.getTime())
      ? new Date().getUTCFullYear()
      : kickoff.getUTCFullYear();
    return synthesizeBaseFrom365Game(
      game as Parameters<typeof synthesizeBaseFrom365Game>[0],
      game.id,
      {
        leagueId: compId != null ? scores365CompetitionToLeagueId(compId) : undefined,
        season,
        leagueName: meta?.name ?? game.competitionDisplayName,
        country: meta?.country,
        leagueLogo: meta?.logo,
      },
    );
  }

  private async fetchCompetitorGames(
    competitorId: number,
    langId: number,
  ): Promise<{ games: Scores365Game[]; competitionMeta: CompetitionMetaMap }> {
    const seen = new Set<number>();
    const games: Scores365Game[] = [];
    const competitionMeta: CompetitionMetaMap = new Map();

    const mergeMeta = (
      payload: { competitions?: Scores365CompetitionMeta[]; countries?: Scores365CountryMeta[] } | null,
    ) => {
      if (!payload) return;
      const countriesById = new Map<number, string>();
      for (const country of payload.countries ?? []) {
        if (country.id != null && country.name) countriesById.set(country.id, country.name);
      }
      for (const [id, meta] of this.buildCompetitionMetaFromCatalog(
        payload.competitions ?? [],
        countriesById,
      )) {
        if (!competitionMeta.has(id)) competitionMeta.set(id, meta);
      }
    };

    const add = (list?: Scores365Game[]) => {
      for (const g of list ?? []) {
        if (g?.id != null && !seen.has(g.id)) {
          seen.add(g.id);
          games.push(g);
        }
      }
    };

    const pageCap = fixturesHotPageCap();

    const firstPath = `/web/games/fixtures/?${this.commonParams(langId)}&competitors=${competitorId}&showOdds=true`;
    const first = await this.fetchJson<FixturesPayload & CompetitionsCatalogPayload>(
      firstPath,
      `competitor-fixtures:${competitorId}`,
      0,
      true,
    );
    add(first?.games);
    mergeMeta(first ?? null);

    let prev = first?.paging?.previousPage;
    for (let step = 0; prev && step < pageCap; step++) {
      const normalized = this.rewritePagingPath(prev, langId);
      const page = await this.fetchJson<FixturesPayload & CompetitionsCatalogPayload>(
        normalized,
        `competitor-fixtures:${competitorId}`,
        0,
        true,
      );
      const before = games.length;
      add(page?.games);
      mergeMeta(page ?? null);
      if (games.length === before && !page?.games?.length) break;
      prev = page?.paging?.previousPage;
    }

    let next = first?.paging?.nextPage;
    for (let step = 0; next && step < pageCap; step++) {
      const normalized = this.rewritePagingPath(next, langId);
      const page = await this.fetchJson<FixturesPayload & CompetitionsCatalogPayload>(
        normalized,
        `competitor-fixtures:${competitorId}`,
        0,
        true,
      );
      const before = games.length;
      add(page?.games);
      mergeMeta(page ?? null);
      if (games.length === before && !page?.games?.length) break;
      next = page?.paging?.nextPage;
    }

    // Today / live snapshot for this competitor (allscores includes in-play scores).
    const allscores = await this.fetchJson<AllScoresPayload>(
      `/web/games/allscores/?${this.commonParams(langId)}&competitors=${competitorId}`,
      `competitor-allscores:${competitorId}`,
      60_000,
    );
    add(allscores?.games);
    mergeMeta(allscores ?? null);

    return { games, competitionMeta };
  }

  /** Incoming / outgoing transfers for a competitor. Cached 1h in Redis. */
  async getCompetitorTransfers(
    competitorId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorTransfers>> {
    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:competitor:${competitorId}:transfers:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCompetitorTransfers>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<TransfersPayload>(
        `/web/transfers/?${this.commonParams(langId)}&competitors=${competitorId}`,
        `competitor-transfers:${competitorId}`,
        3_600_000,
      );
      if (!payload?.transfers?.length) {
        const empty: ThreeSixFiveCompetitorTransfers = { in: [], out: [] };
        await redisCacheService.set(cacheKey, empty, 3_600_000);
        return { data: empty, source: '365scores' };
      }

      const athletesById = new Map(
        (payload.athletes ?? []).map((a) => [a.id, a] as const),
      );
      const competitorsById = new Map(
        (payload.competitors ?? []).map((c) => [c.id, c] as const),
      );

      const map = (t: NonNullable<TransfersPayload['transfers']>[number]) => {
        const athlete = t.athleteId != null ? athletesById.get(t.athleteId) : undefined;
        // Arrival → the "other" club is the origin; departure → the target.
        const otherClubId = t.isArrival ? t.origin : t.target;
        const club = otherClubId != null ? competitorsById.get(otherClubId) : undefined;
        return {
          athleteId: t.athleteId ?? 0,
          athleteName: athlete?.name ?? '—',
          athletePhoto:
            t.athleteId != null ? buildScores365AthletePhotoUrl(t.athleteId, 80) : null,
          positionName: null,
          isArrival: t.isArrival === true,
          price: t.price && t.price !== '-' ? t.price : null,
          date: t.time ?? null,
          clubId: otherClubId ?? null,
          clubName: club?.name ?? athlete?.clubName ?? null,
          clubLogo:
            otherClubId != null ? buildCompetitorLogoUrl(otherClubId, club?.imageVersion) : null,
        } satisfies ThreeSixFiveCompetitorTransfer;
      };

      const byDateDesc = (a: ThreeSixFiveCompetitorTransfer, b: ThreeSixFiveCompetitorTransfer) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();

      const result: ThreeSixFiveCompetitorTransfers = {
        in: payload.transfers.filter((t) => t.isArrival).map(map).sort(byDateDesc),
        out: payload.transfers.filter((t) => !t.isArrival).map(map).sort(byDateDesc),
      };

      await redisCacheService.set(cacheKey, result, 3_600_000);
      return { data: result, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getCompetitorTransfers(${competitorId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  /**
   * Recent transfers for one or more 365 competitions (`/web/transfers/?competitions=`).
   */
  async getTransfersByCompetitions(
    competitionIds: number[],
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitionTransfers[]>> {
    const ids = [...new Set(competitionIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (!ids.length) return { data: [], source: '365scores' };
    try {
      const langId = resolveScores365LangId(language);
      const groups: ThreeSixFiveCompetitionTransfers[] = [];
      for (const competitionId of ids) {
        const cacheKey = `365:competition:${competitionId}:transfers:v1:${langId}`;
        const cached = await redisCacheService.get<ThreeSixFiveCompetitionTransfers>(cacheKey);
        if (cached) {
          groups.push(cached);
          continue;
        }
        const payload = await this.fetchJson<
          TransfersPayload & {
            competitions?: Array<{ id: number; name?: string; imageVersion?: number }>;
          }
        >(
          `/web/transfers/?${this.commonParams(langId)}&competitions=${competitionId}`,
          `competition-transfers:${competitionId}`,
          3_600_000,
        );
        const athletesById = new Map((payload?.athletes ?? []).map((a) => [a.id, a] as const));
        const competitorsById = new Map((payload?.competitors ?? []).map((c) => [c.id, c] as const));
        const meta = payload?.competitions?.find((c) => c.id === competitionId);
        const mapped: ThreeSixFiveLeagueTransfer[] = (payload?.transfers ?? []).map((t) => {
          const athlete = t.athleteId != null ? athletesById.get(t.athleteId) : undefined;
          const from = t.origin != null ? competitorsById.get(t.origin) : undefined;
          const to = t.target != null ? competitorsById.get(t.target) : undefined;
          return {
            athleteId: t.athleteId ?? 0,
            athleteName: athlete?.name ?? '—',
            athletePhoto:
              t.athleteId != null ? buildScores365AthletePhotoUrl(t.athleteId, 80) : null,
            date: t.time ?? null,
            price: t.price && t.price !== '-' ? t.price : null,
            typeName: t.statusName ?? null,
            fromClubId: t.origin ?? null,
            fromClubName: from?.name ?? null,
            fromClubLogo:
              t.origin != null ? buildCompetitorLogoUrl(t.origin, from?.imageVersion) : null,
            toClubId: t.target ?? null,
            toClubName: to?.name ?? null,
            toClubLogo:
              t.target != null ? buildCompetitorLogoUrl(t.target, to?.imageVersion) : null,
          };
        });
        const group: ThreeSixFiveCompetitionTransfers = {
          competitionId,
          competitionName: meta?.name ?? `Competition ${competitionId}`,
          competitionLogo: buildLeagueLogoUrl(competitionId, meta?.imageVersion ?? null),
          transfers: mapped,
        };
        await redisCacheService.set(cacheKey, group, 3_600_000);
        groups.push(group);
      }
      return { data: groups, source: '365scores' };
    } catch (err: unknown) {
      logger.error('[365Scores] getTransfersByCompetitions failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  /**
   * Competition-scoped player leaderboards (goals, assists, …) for a competitor.
   * 365 returns club players ranked within the competition (incl. recently-left,
   * flagged via `leftClub`). Cached 10m in Redis.
   */
  async getCompetitorStats(
    competitorId: number,
    competitionId: number,
    language?: string | null,
    options?: { roster?: boolean },
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorStats>> {
    if (
      !Number.isFinite(competitorId) ||
      competitorId <= 0 ||
      !Number.isFinite(competitionId) ||
      competitionId <= 0
    ) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const roster = options?.roster === true;
      const cacheKey = `365:competitor:${competitorId}:stats${roster ? ':roster' : ''}:${competitionId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCompetitorStats>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<StatsPayload>(
        `/web/stats/?${this.commonParams(langId)}&competitors=${competitorId}&competitions=${competitionId}`,
        `competitor-stats:${competitorId}:${competitionId}`,
        600_000,
      );
      const boards = payload?.stats?.athletesStats ?? [];
      if (!boards.length) return { data: null, source: null };

      const maxBoards = roster ? 20 : 6;
      const maxRows = roster ? 50 : 10;
      const leaderboards: ThreeSixFiveStatLeaderboard[] = boards
        .slice(0, maxBoards)
        .map((board) => ({
          key: board.id,
          name: board.name ?? '—',
          rows: (board.rows ?? [])
            .slice(0, maxRows)
            .map((r) => ({
              rank: r.position,
              athleteId: r.entity?.id ?? 0,
              name: r.entity?.name ?? '—',
              photo: r.entity?.id ? buildScores365AthletePhotoUrl(r.entity.id, 68) : null,
              value: r.stats?.[0]?.value ?? '',
              competitorId: r.entity?.competitorId ?? null,
              leftClub: r.entity?.isLeftClub === true,
              positionName: r.entity?.positionName ?? null,
            }))
            .filter((row) => row.athleteId > 0),
        }))
        .filter((board) => board.rows.length > 0);

      const result: ThreeSixFiveCompetitorStats = { competitionId, leaderboards };
      await redisCacheService.set(cacheKey, result, 600_000);
      return { data: result, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getCompetitorStats(${competitorId}, ${competitionId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  /**
   * Official 365 roster from `/web/squads/` (includes players + staff/coach).
   * Shared by squad tab and coach lookup so we don't double-fetch.
   */
  private async fetchCompetitorSquadRoster(
    competitorId: number,
    langId: number,
  ): Promise<{
    athletes: SquadsAthlete[];
    teamName: string | null;
    countriesById: Map<number, string>;
  } | null> {
    const inflightKey = `squads-raw:${competitorId}:${langId}`;
    const existing = this.inFlight.get(inflightKey);
    if (existing) {
      return (await existing) as {
        athletes: SquadsAthlete[];
        teamName: string | null;
        countriesById: Map<number, string>;
      } | null;
    }

    const promise = this.loadCompetitorSquadRoster(competitorId, langId);
    this.inFlight.set(inflightKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(inflightKey);
    }
  }

  private async loadCompetitorSquadRoster(
    competitorId: number,
    langId: number,
  ): Promise<{
    athletes: SquadsAthlete[];
    teamName: string | null;
    countriesById: Map<number, string>;
  } | null> {
    const cacheKey = `365:competitor:${competitorId}:squads-raw:v1:${langId}`;
    const cached = await redisCacheService.get<{
      athletes: SquadsAthlete[];
      teamName: string | null;
      countries: Array<[number, string]>;
    }>(cacheKey);
    if (cached?.athletes?.length) {
      return {
        athletes: cached.athletes,
        teamName: cached.teamName,
        countriesById: new Map(cached.countries ?? []),
      };
    }

    const payload = await this.fetchJson<SquadsPayload>(
      `/web/squads/?${this.commonParams(langId)}&competitors=${competitorId}`,
      `competitor-squads:${competitorId}`,
      0,
    );
    const squad =
      payload?.squads?.find((s) => s.competitorId === competitorId) ?? payload?.squads?.[0];
    const athletes = squad?.athletes ?? [];
    if (!athletes.length) return null;

    const countriesById = new Map<number, string>();
    for (const country of payload?.countries ?? []) {
      if (country.id != null && country.name) countriesById.set(country.id, country.name);
    }
    const teamName =
      payload?.competitors?.find((c) => c.id === competitorId)?.name ??
      payload?.competitors?.[0]?.name ??
      null;

    await redisCacheService.set(
      cacheKey,
      {
        athletes,
        teamName,
        countries: [...countriesById.entries()],
      },
      3_600_000,
    );
    return { athletes, teamName, countriesById };
  }

  /**
   * Current squad for a competitor, keyed by competitorId (never by name).
   * Primary source: `/web/squads/`. Fallback: recent lineups + stats + arrivals.
   */
  async getCompetitorSquad(
    competitorId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorSquad>> {
    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:competitor:${competitorId}:squad:v4:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCompetitorSquad>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const byAthlete = new Map<number, ThreeSixFiveSquadPlayer>();
      const upsert = (player: ThreeSixFiveSquadPlayer) => {
        if (player.athleteId <= 0 || isSquadStaff(player.position)) return;
        const prev = byAthlete.get(player.athleteId);
        if (!prev) {
          byAthlete.set(player.athleteId, player);
          return;
        }
        byAthlete.set(player.athleteId, {
          ...prev,
          name: prev.name !== '—' ? prev.name : player.name,
          shortName: prev.shortName !== '—' ? prev.shortName : player.shortName,
          position: prev.position ?? player.position,
          positionGroup:
            prev.positionGroup !== 'other' ? prev.positionGroup : player.positionGroup,
          jerseyNumber: prev.jerseyNumber ?? player.jerseyNumber,
          photo: prev.photo ?? player.photo,
          age: prev.age ?? player.age,
          height: prev.height ?? player.height,
          nationality: prev.nationality ?? player.nationality,
        });
      };

      const roster = await this.fetchCompetitorSquadRoster(competitorId, langId);
      if (roster) {
        for (const athlete of roster.athletes) {
          if (isSquadsStaffAthlete(athlete)) continue;
          const jersey = athlete.jerseyNum != null && athlete.jerseyNum > 0 ? athlete.jerseyNum : null;
          upsert({
            athleteId: athlete.id,
            name: athlete.name ?? '—',
            shortName: athlete.shortName ?? athlete.name ?? '—',
            position: athlete.formationPosition?.name ?? athlete.position?.name ?? null,
            positionGroup: classifySquadPositionFrom365(athlete),
            jerseyNumber: jersey,
            photo: athlete.id > 0 ? buildScores365AthletePhotoUrl(athlete.id, 80) : null,
            age: athlete.age != null && athlete.age > 0 ? athlete.age : null,
            height:
              athlete.height != null && String(athlete.height).trim()
                ? String(athlete.height)
                : null,
            nationality:
              athlete.nationalityId != null
                ? (roster.countriesById.get(athlete.nationalityId) ?? null)
                : null,
          });
        }
      }
      const fromSquads = byAthlete.size > 0;

      let lineupHits = 0;
      let statsRows = 0;
      let transferArrivals = 0;
      let gamesCount = 0;

      if (byAthlete.size === 0) {
        const matches = await this.getCompetitorMatches(competitorId, language);
        const games = [
          ...(matches.data?.live ?? []).slice(0, 1),
          ...(matches.data?.finished ?? []).slice(0, 12),
        ];
        gamesCount = games.length;
        const LINEUP_BATCH = 4;
        for (let offset = 0; offset < games.length; offset += LINEUP_BATCH) {
          const batch = games.slice(offset, offset + LINEUP_BATCH);
          const lineupResults = await Promise.all(
            batch.map((fixture) =>
              this.getLineupsWithNames(fixture.fixture.id, language, {
                bypassExperimentGate: true,
              }),
            ),
          );
          for (let i = 0; i < batch.length; i++) {
            const fixture = batch[i];
            const lineups = lineupResults[i]?.data ?? [];
            if (!lineups.length) continue;
            lineupHits += 1;
            const side: 'home' | 'away' =
              fixture.teams?.home?.id === competitorId ? 'home' : 'away';
            for (const p of lineups) {
              if (p.side !== side) continue;
              upsert({
                athleteId: p.athleteId,
                name: p.name,
                shortName: p.shortName,
                position: p.position,
                positionGroup: classifySquadPosition(p.position, p.formation),
                jerseyNumber: p.jerseyNumber,
                photo: p.athleteId > 0 ? buildScores365AthletePhotoUrl(p.athleteId, 80) : p.imageUrl,
              });
            }
          }
        }

        const info = await this.getCompetitorInfo(competitorId, language);
        const statsCompetitionIds = [
          ...new Set(
            [
              ...(info.data?.competitions ?? []).filter((c) => c.hasStats).map((c) => c.id),
              info.data?.mainCompetitionId,
            ].filter((id): id is number => typeof id === 'number' && id > 0),
          ),
        ];
        const statsResults = await Promise.all(
          statsCompetitionIds.map((competitionId) =>
            this.getCompetitorStats(competitorId, competitionId, language, { roster: true }),
          ),
        );
        for (const stats of statsResults) {
          for (const board of stats.data?.leaderboards ?? []) {
            for (const row of board.rows) {
              if (row.leftClub && row.competitorId !== competitorId) continue;
              statsRows += 1;
              upsert({
                athleteId: row.athleteId,
                name: row.name,
                shortName: row.name,
                position: row.positionName ?? null,
                positionGroup: classifySquadPosition(row.positionName, null),
                jerseyNumber: null,
                photo: row.athleteId > 0 ? buildScores365AthletePhotoUrl(row.athleteId, 80) : row.photo,
              });
            }
          }
        }

        if (info.data && !info.data.isNationalTeam && info.data.hasTransfers) {
          const transfers = await this.getCompetitorTransfers(competitorId, language);
          for (const arrival of transfers.data?.in ?? []) {
            transferArrivals += 1;
            upsert({
              athleteId: arrival.athleteId,
              name: arrival.athleteName,
              shortName: arrival.athleteName,
              position: arrival.positionName,
              positionGroup: classifySquadPosition(arrival.positionName, null),
              jerseyNumber: null,
              photo:
                arrival.athleteId > 0
                  ? buildScores365AthletePhotoUrl(arrival.athleteId, 80)
                  : arrival.athletePhoto,
            });
          }
        }
      }

      const players = [...byAthlete.values()].sort((a, b) => {
        const numA = a.jerseyNumber ?? 999;
        const numB = b.jerseyNumber ?? 999;
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name);
      });
      const groups = emptySquadGroups();
      for (const player of players) groups[player.positionGroup].push(player);

      const result: ThreeSixFiveCompetitorSquad = { competitorId, players, groups };
      const logLine =
        `[365Scores] squad ${competitorId}: source=${fromSquads ? 'squads' : 'fallback'} ` +
        `games=${gamesCount} lineupHits=${lineupHits} statsRows=${statsRows} ` +
        `transfersIn=${transferArrivals} players=${players.length}`;
      if (competitorId === 8200) logger.info(logLine);
      else logger.debug(logLine);

      await redisCacheService.set(
        cacheKey,
        result,
        players.length > 0 ? 3_600_000 : 60_000,
      );
      return { data: result, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getCompetitorSquad(${competitorId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  /**
   * Head (or assistant) coach from `/web/squads/` (formationPosition 16/17),
   * enriched with `/web/athletes/?fullDetails=true` (bio, nationality, trophies).
   */
  async getCompetitorCoach(
    competitorId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCoach>> {
    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:competitor:${competitorId}:coach:v3:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCoach | { empty: true }>(cacheKey);
      if (cached && 'athleteId' in cached && cached.athleteId > 0) {
        return { data: cached, source: '365scores' };
      }
      if (cached && 'empty' in cached) {
        return { data: null, source: '365scores' };
      }

      const roster = await this.fetchCompetitorSquadRoster(competitorId, langId);
      const head =
        roster?.athletes.find((a) => a.formationPosition?.id === 16) ??
        roster?.athletes.find((a) => a.formationPosition?.id === 17) ??
        null;

      if (head?.id) {
        const role: ThreeSixFiveCoach['role'] =
          head.formationPosition?.id === 17 ? 'assistant_coach' : 'head_coach';
        const nationality =
          head.nationalityId != null
            ? (roster?.countriesById.get(head.nationalityId) ?? undefined)
            : undefined;
        const coach = await this.enrichCoachProfile(
          {
            athleteId: head.id,
            teamId: competitorId,
            teamName: roster?.teamName ?? '—',
            name: head.name ?? '—',
            shortName: head.shortName,
            nationality,
            age: head.age ?? null,
            imageUrl: buildScores365CoachPhotoUrl(head.id, 80, head.imageVersion ?? null),
            imageVersion: head.imageVersion ?? null,
            role,
          },
          langId,
          competitorId,
        );
        await redisCacheService.set(cacheKey, coach, 21_600_000);
        return { data: coach, source: '365scores' };
      }

      await redisCacheService.set(cacheKey, { empty: true }, 600_000);
      return { data: null, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getCompetitorCoach(${competitorId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  private async enrichCoachProfile(
    base: ThreeSixFiveCoach,
    langId: number,
    competitorId: number,
  ): Promise<ThreeSixFiveCoach> {
    const payload = await this.fetchJson<{ athletes?: any[] }>(
      `/web/athletes/?${this.commonParams(langId)}&athletes=${base.athleteId}&fullDetails=true`,
      `competitor-coach-athlete:${base.athleteId}`,
      21_600_000,
    );
    const athlete = payload?.athletes?.[0];
    if (!athlete) return base;

    const trophies = this.parse365Trophies(athlete.trophies);
    const nationality =
      (athlete.nationalityName as string | undefined) ??
      base.nationality;
    const imageVersion =
      this.num365(athlete.imageVersion) ?? base.imageVersion ?? null;
    return {
      ...base,
      name: (athlete.name as string | undefined) ?? base.name,
      shortName: (athlete.shortName as string | undefined) ?? base.shortName,
      nationality,
      bio: (athlete.shortBio as string | undefined) ?? base.bio,
      age: this.num365(athlete.age) ?? base.age ?? null,
      contractUntil: (athlete.contractUntil as string | undefined) ?? base.contractUntil ?? null,
      imageVersion,
      imageUrl: buildScores365CoachPhotoUrl(base.athleteId, 80, imageVersion),
      trophies,
      teamId: competitorId,
    };
  }

  /**
   * Full athlete/coach profile from `/web/athletes/?fullDetails=true`.
   */
  async getAthleteProfile(
    athleteId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveAthleteProfile>> {
    if (!Number.isFinite(athleteId) || athleteId <= 0) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:athlete-profile:v1:${athleteId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveAthleteProfile>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<{
        athletes?: any[];
        competitors?: Array<{ id: number; name?: string }>;
      }>(
        `/web/athletes/?${this.commonParams(langId)}&athletes=${athleteId}&fullDetails=true`,
        `athlete-profile:${athleteId}`,
        21_600_000,
      );
      const athlete = payload?.athletes?.[0];
      if (!athlete) return { data: null, source: null };

      const competitorNames = new Map<number, string>(
        (payload?.competitors ?? [])
          .filter((c) => c?.id != null && c?.name)
          .map((c) => [c.id, c.name as string]),
      );
      const clubId = this.num365(athlete.clubId);
      const posId = this.num365(athlete.position?.id ?? athlete.positionId);
      const formId = this.num365(athlete.formationPosition?.id);
      const isCoach = posId === 0 || formId === 16 || formId === 17 || isIndexedCoachId(athleteId);
      const imageVersion = this.num365(athlete.imageVersion);
      const profile: ThreeSixFiveAthleteProfile = {
        athleteId,
        name: (athlete.name as string) ?? '—',
        shortName: athlete.shortName as string | undefined,
        nationality: (athlete.nationalityName as string | undefined) ?? null,
        bio: (athlete.shortBio as string | undefined) ?? null,
        age: this.num365(athlete.age),
        dateOfBirth: this.parse365DateOfBirth(athlete),
        height: this.parse365Height(athlete),
        contractUntil: (athlete.contractUntil as string | undefined) ?? null,
        imageVersion,
        imageUrl: isCoach
          ? buildScores365CoachPhotoUrl(athleteId, 80, imageVersion)
          : buildScores365AthletePhotoUrl(athleteId, 80),
        teamId: clubId,
        teamName:
          (clubId != null ? competitorNames.get(clubId) : undefined) ??
          (athlete.clubName as string | undefined) ??
          null,
        position: (athlete.position?.name as string | undefined) ?? null,
        role: isCoach ? (formId === 17 ? 'assistant_coach' : 'head_coach') : 'player',
        trophies: this.parse365Trophies(athlete.trophies),
        transfers: this.parse365AthleteTransfers(athlete, competitorNames),
      };
      await redisCacheService.set(cacheKey, profile, 21_600_000);
      return { data: profile, source: '365scores' };
    } catch (err: unknown) {
      logger.error(`[365Scores] getAthleteProfile(${athleteId}) failed:`, (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  async getCompetitionProfile(
    competitionId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitionProfile>> {
    if (!Number.isFinite(competitionId) || competitionId <= 0) {
      return { data: null, source: null };
    }
    try {
      const langId = resolveScores365LangId(language);
      const cacheKey = `365:competition-profile:v1:${competitionId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFiveCompetitionProfile>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const leagueId = scores365CompetitionToLeagueId(competitionId);
      const row = await prisma.cachedLeague.findUnique({
        where: { leagueId },
        select: { name: true, country: true, logo: true, fullData: true },
      });
      const fromIndex = competitionIndexRecords().find((r) => r.entityId === competitionId);
      const full = row?.fullData as { hasStandings?: boolean; name?: string } | null;
      const catalog = await redisCacheService.get<ThreeSixFiveSearchCompetition[]>(
        COMPETITIONS_SEARCH_INDEX_KEY(langId),
      );
      const fromCatalog = catalog?.find((c) => c.competitionId === competitionId);
      const profile: ThreeSixFiveCompetitionProfile = {
        competitionId,
        name: fromCatalog?.name ?? row?.name ?? fromIndex?.canonicalName ?? `Competition ${competitionId}`,
        country: fromCatalog?.country ?? row?.country ?? null,
        logo: fromCatalog?.logo ?? row?.logo ?? buildLeagueLogoUrl(competitionId, null),
        hasStandings: fromCatalog?.hasStandings ?? full?.hasStandings ?? true,
      };
      await redisCacheService.set(cacheKey, profile, 3_600_000);
      return { data: profile, source: '365scores' };
    } catch (err: unknown) {
      logger.error(
        `[365Scores] getCompetitionProfile(${competitionId}) failed:`,
        (err as Error)?.message,
      );
      return { data: null, source: null };
    }
  }

  // ─── 5d. Combined entity search (clubs / national teams / players) ────────

  /**
   * Text search across clubs, national teams and players (football only).
   *
   * Pipeline: normalize → expand aliases (entity-id index) → fetch 365 →
   * merge by ID → rank (canonical / alias / prefix / token / fuzzy + popularity).
   * Entity IDs are the source of truth; names never rewrite IDs.
   */
  async searchEntities(
    query: string,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFiveSearchResults>> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { data: emptySearchResults(), source: '365scores' };
    }

    try {
      const primaryLangId = resolveScores365SearchLangId(trimmed, language);
      const arLangId = parseInt(process.env.SCORES365_LANG_ID_AR || '27', 10);
      const enLangId = parseInt(process.env.SCORES365_LANG_ID_EN || '1', 10);
      const fallbackLangId = primaryLangId === arLangId ? enLangId : arLangId;
      const preferredCountryId =
        queryHasArabic(trimmed) || (language ?? '').toLowerCase().startsWith('ar')
          ? DEFAULT_ARABIC_COUNTRY_ID
          : null;
      const queryNorm = normalizeSearchText(trimmed);
      let expansion = expandSearchQueries(trimmed);
      const rankedCacheKey = `365:searchall:ranked:v3:${primaryLangId}:${queryNorm}:${preferredCountryId ?? 0}`;
      const cachedRanked = await redisCacheService.get<ThreeSixFiveSearchResults>(rankedCacheKey);
      if (cachedRanked) return { data: this.withSearchDefaults(cachedRanked), source: '365scores' };

      const otherLang = await this.findOtherLangRanked(queryNorm, fallbackLangId);
      if (otherLang && !this.searchIsEmpty(otherLang)) {
        expansion = {
          queries: [trimmed],
          boostedEntityIds: this.collectSearchEntityIds(otherLang),
        };
      }

      const existing = this.inFlight.get(rankedCacheKey);
      if (existing) {
        const ranked = (await existing) as ThreeSixFiveSearchResults | null;
        return ranked
          ? { data: ranked, source: '365scores' }
          : { data: null, source: null };
      }

      const promise = this.buildRankedSearchEntities(
        trimmed,
        expansion,
        primaryLangId,
        fallbackLangId,
        preferredCountryId,
        rankedCacheKey,
        language,
      );
      this.inFlight.set(rankedCacheKey, promise);
      try {
        const ranked = await promise;
        return ranked
          ? { data: ranked, source: '365scores' }
          : { data: null, source: null };
      } finally {
        this.inFlight.delete(rankedCacheKey);
      }
    } catch (err: unknown) {
      logger.error('[365Scores] searchEntities failed:', (err as Error)?.message);
      return { data: null, source: null };
    }
  }

  private withSearchDefaults(results: ThreeSixFiveSearchResults): ThreeSixFiveSearchResults {
    return {
      clubs: results.clubs ?? [],
      nationalTeams: results.nationalTeams ?? [],
      players: results.players ?? [],
      coaches: results.coaches ?? [],
      competitions: results.competitions ?? [],
    };
  }

  private searchIsEmpty(results: ThreeSixFiveSearchResults): boolean {
    const r = this.withSearchDefaults(results);
    return (
      !r.clubs.length &&
      !r.nationalTeams.length &&
      !r.players.length &&
      !r.coaches.length &&
      !r.competitions.length
    );
  }

  private search365Empty(results: ThreeSixFiveSearchResults): boolean {
    const r = this.withSearchDefaults(results);
    return !r.clubs.length && !r.nationalTeams.length && !r.players.length && !r.coaches.length;
  }

  private collectSearchEntityIds(results: ThreeSixFiveSearchResults): Set<number> {
    const r = this.withSearchDefaults(results);
    return new Set<number>([
      ...r.clubs.map((c) => c.competitorId),
      ...r.nationalTeams.map((c) => c.competitorId),
      ...r.players.map((p) => p.athleteId),
      ...r.coaches.map((p) => p.athleteId),
      ...r.competitions.map((c) => c.competitionId),
    ]);
  }

  private async findOtherLangRanked(
    queryNorm: string,
    fallbackLangId: number,
  ): Promise<ThreeSixFiveSearchResults | null> {
    for (const country of [0, DEFAULT_ARABIC_COUNTRY_ID]) {
      const key = `365:searchall:ranked:v3:${fallbackLangId}:${queryNorm}:${country}`;
      const hit = await redisCacheService.get<ThreeSixFiveSearchResults>(key);
      if (hit && !this.searchIsEmpty(hit)) return this.withSearchDefaults(hit);
    }
    return null;
  }

  private async writeRankedSearchCache(
    ranked: ThreeSixFiveSearchResults,
    primaryLangId: number,
    preferredCountryId: number | null,
    expansion: ReturnType<typeof expandSearchQueries>,
    rankedCacheKey: string,
    ttlMs: number,
  ): Promise<void> {
    await redisCacheService.set(rankedCacheKey, ranked, ttlMs);
    if (this.searchIsEmpty(ranked)) return;
    for (const q of expansion.queries) {
      const aliasKey = `365:searchall:ranked:v3:${primaryLangId}:${normalizeSearchText(q)}:${preferredCountryId ?? 0}`;
      if (aliasKey === rankedCacheKey) continue;
      await redisCacheService.set(aliasKey, ranked, ttlMs);
    }
  }

  private async buildRankedSearchEntities(
    trimmed: string,
    expansion: ReturnType<typeof expandSearchQueries>,
    primaryLangId: number,
    fallbackLangId: number,
    preferredCountryId: number | null,
    rankedCacheKey: string,
    language?: string | null,
  ): Promise<ThreeSixFiveSearchResults | null> {
    let results = await this.fetchSearchEntities(expansion.queries[0] ?? trimmed, primaryLangId);
    if (
      !results.upstreamFailed &&
      this.searchNeedsExpansion(results, expansion.boostedEntityIds) &&
      expansion.queries.length > 1
    ) {
      const extras = await Promise.all(
        expansion.queries.slice(1).map((q) => this.fetchSearchEntities(q, primaryLangId)),
      );
      results = this.mergeSearchResults([results, ...extras]);
    }

    if (this.search365Empty(results) && fallbackLangId !== primaryLangId) {
      let fallback = await this.fetchSearchEntities(expansion.queries[0] ?? trimmed, fallbackLangId);
      if (
        !fallback.upstreamFailed &&
        this.searchNeedsExpansion(fallback, expansion.boostedEntityIds) &&
        expansion.queries.length > 1
      ) {
        const extras = await Promise.all(
          expansion.queries.slice(1).map((q) => this.fetchSearchEntities(q, fallbackLangId)),
        );
        fallback = this.mergeSearchResults([fallback, ...extras]);
      }
      if (!this.search365Empty(fallback) || !fallback.upstreamFailed) {
        results = fallback;
      }
    }

    const competitions = await this.searchCompetitionsLocal(trimmed, expansion.boostedEntityIds, language);
    results = { ...this.withSearchDefaults(results), competitions, upstreamFailed: results.upstreamFailed };

    if (this.searchIsEmpty(results) && results.upstreamFailed) {
      return null;
    }

    const ranked = this.rankSearchResults(
      results,
      trimmed,
      expansion.boostedEntityIds,
      preferredCountryId,
    );
    const rankedEmpty = this.searchIsEmpty(ranked);
    await this.writeRankedSearchCache(
      ranked,
      primaryLangId,
      preferredCountryId,
      expansion,
      rankedCacheKey,
      rankedEmpty ? 20_000 : 300_000,
    );
    return ranked;
  }

  private searchNeedsExpansion(
    results: SearchEntitiesFetch,
    boosted: Set<number>,
  ): boolean {
    if (results.upstreamFailed) return false;
    const empty = this.search365Empty(results);
    if (empty) return true;
    if (boosted.size === 0) return false;
    const ids = this.collectSearchEntityIds(results);
    for (const id of boosted) {
      if (!ids.has(id)) return true;
    }
    return false;
  }

  private mergeSearchResults(parts: SearchEntitiesFetch[]): SearchEntitiesFetch {
    const clubs = new Map<number, ThreeSixFiveSearchCompetitor>();
    const nationalTeams = new Map<number, ThreeSixFiveSearchCompetitor>();
    const players = new Map<number, ThreeSixFiveSearchAthlete>();
    const coaches = new Map<number, ThreeSixFiveSearchAthlete>();
    for (const part of parts) {
      const p = this.withSearchDefaults(part);
      for (const c of p.clubs) {
        if (!clubs.has(c.competitorId)) clubs.set(c.competitorId, c);
      }
      for (const c of p.nationalTeams) {
        if (!nationalTeams.has(c.competitorId)) nationalTeams.set(c.competitorId, c);
      }
      for (const a of p.players) {
        if (!players.has(a.athleteId)) players.set(a.athleteId, a);
      }
      for (const a of p.coaches) {
        if (!coaches.has(a.athleteId)) coaches.set(a.athleteId, a);
      }
    }
    const merged: SearchEntitiesFetch = {
      clubs: [...clubs.values()],
      nationalTeams: [...nationalTeams.values()],
      players: [...players.values()],
      coaches: [...coaches.values()],
      competitions: [],
    };
    merged.upstreamFailed =
      this.search365Empty(merged) && parts.length > 0 && parts.every((p) => p.upstreamFailed);
    return merged;
  }

  private rankSearchResults(
    results: ThreeSixFiveSearchResults,
    rawQuery: string,
    boosted: Set<number>,
    preferredCountryId: number | null,
  ): ThreeSixFiveSearchResults {
    const queryNorm = normalizeSearchText(rawQuery);
    const playerQuery = isPlayerOrientedBoost(boosted);
    const src = this.withSearchDefaults(results);
    const clubs = rankByScore(src.clubs, (c) =>
      scoreCompetitor(c, queryNorm, boosted, preferredCountryId),
    );
    const nationalTeams = rankByScore(src.nationalTeams, (c) =>
      scoreCompetitor(c, queryNorm, boosted, preferredCountryId),
    );
    return {
      clubs: playerQuery
        ? clubs.filter(
            (c) => scoreSearchName(queryNorm, c.name, [c.longName, c.symbolicName]) >= 780,
          )
        : clubs,
      nationalTeams: playerQuery
        ? nationalTeams.filter(
            (c) => scoreSearchName(queryNorm, c.name, [c.longName, c.symbolicName]) >= 780,
          )
        : nationalTeams,
      players: rankByScore(src.players, (p) => scoreAthlete(p, queryNorm, boosted)),
      coaches: rankByScore(src.coaches, (p) => scoreAthlete(p, queryNorm, boosted)),
      competitions: rankByScore(src.competitions, (c) => scoreCompetition(c, queryNorm, boosted)),
    };
  }

  private async searchCompetitionsLocal(
    rawQuery: string,
    boosted: Set<number>,
    language?: string | null,
  ): Promise<ThreeSixFiveSearchCompetition[]> {
    const queryNorm = normalizeSearchText(rawQuery);
    if (!queryNorm) return [];
    const langId = resolveScores365LangId(language);
    let catalog =
      (await redisCacheService.get<ThreeSixFiveSearchCompetition[]>(
        COMPETITIONS_SEARCH_INDEX_KEY(langId),
      )) ?? [];
    if (!catalog.length) {
      const rows = await prisma.cachedLeague.findMany({
        where: { leagueId: { gte: SCORES365_LEAGUE_ID_OFFSET } },
        select: { leagueId: true, name: true, country: true, logo: true, fullData: true },
      });
      catalog = rows.map((row) => {
        const full = row.fullData as { competitionId?: number; hasStandings?: boolean } | null;
        return {
          competitionId: full?.competitionId ?? row.leagueId - SCORES365_LEAGUE_ID_OFFSET,
          name: row.name,
          country: row.country ?? null,
          logo: row.logo ?? null,
          hasStandings: full?.hasStandings === true,
        };
      });
    }

    const byId = new Map<number, ThreeSixFiveSearchCompetition>();
    for (const item of catalog) {
      if (item.competitionId > 0) byId.set(item.competitionId, item);
    }
    for (const rec of competitionIndexRecords()) {
      if (!byId.has(rec.entityId)) {
        byId.set(rec.entityId, {
          competitionId: rec.entityId,
          name: rec.canonicalName,
          country: null,
          logo: buildLeagueLogoUrl(rec.entityId, null),
          hasStandings: true,
        });
      }
    }

    const scored = [...byId.values()]
      .map((item) => ({ item, score: scoreCompetition(item, queryNorm, boosted) }))
      .filter((row) => row.score >= 220 || boosted.has(row.item.competitionId))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((row) => row.item);
    return scored;
  }

  private async fetchSearchEntities(
    query: string,
    langId: number,
  ): Promise<SearchEntitiesFetch> {
    const cacheKey = `365:searchall:v5:${langId}:${normalizeSearchText(query)}`;
    const cached = await redisCacheService.get<ThreeSixFiveSearchResults>(cacheKey);
    if (cached) {
      return { ...this.withSearchDefaults(cached) };
    }

    const path = `/web/search/?${this.commonParams(langId)}&query=${encodeURIComponent(query)}`;
    const payload = await this.fetchJson<SearchAllPayload>(path, `searchall:${langId}:${query}`, 60_000);
    if (!payload) {
      return { ...emptySearchResults(), upstreamFailed: true };
    }

    const countriesById = new Map<number, string>();
    for (const country of payload?.countries ?? []) {
      if (country.id != null && country.name) countriesById.set(country.id, country.name);
    }

    const competitors = (payload?.competitors ?? []).filter(
      (c) => (c.sportId == null || c.sportId === 1) && c.hideOnSearch !== true,
    );
    const toCompetitor = (c: NonNullable<SearchAllPayload['competitors']>[number]) => ({
      competitorId: c.id,
      name: c.name ?? '—',
      type: c.type ?? 1,
      countryId: c.countryId ?? null,
      country: c.countryId != null ? (countriesById.get(c.countryId) ?? null) : null,
      logo: buildCompetitorLogoUrl(c.id, c.imageVersion, 64),
      isNationalTeam: c.type === 2,
      popularityRank: c.popularityRank ?? null,
      longName: c.longName ?? null,
      symbolicName: c.symbolicName ?? null,
    });

    const clubs = competitors.filter((c) => (c.type ?? 1) === 1).map(toCompetitor);
    const nationalTeams = competitors.filter((c) => c.type === 2).map(toCompetitor);
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
        imageUrl: isCoachSearchAthlete(a)
          ? buildScores365CoachPhotoUrl(a.id, 68, a.imageVersion)
          : buildScores365AthletePhotoUrl(a.id, 68),
        positionId: a.position?.id ?? null,
        formationPositionId: a.formationPosition?.id ?? null,
      }));
    const coaches = athletes.filter((a) => isCoachSearchAthlete(a));
    const coachIds = new Set(coaches.map((a) => a.athleteId));
    const players = athletes.filter((a) => !coachIds.has(a.athleteId));

    const results: SearchEntitiesFetch = {
      clubs,
      nationalTeams,
      players,
      coaches,
      competitions: [],
    };
    await redisCacheService.set(cacheKey, results, this.search365Empty(results) ? 20_000 : 300_000);
    return results;
  }

  // ─── 6. Player match report ──────────────────────────────────────────────
  // athleteId can also come from searchAthletes() or a game lineup.

  private async fetchPlayerMatchReportForLang(
    athleteId: number,
    gameId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerMatchReport>> {
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
  }

  async getPlayerMatchReport(
    athleteId: number,
    gameId: number,
    language?: string | null,
  ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerMatchReport>> {
    if (!this.isEnabled()) return { data: null, source: null };

    try {
      const primary = await this.fetchPlayerMatchReportForLang(athleteId, gameId, language);
      const primaryStats = primary.data?.stats?.length ?? 0;
      if (primary.data && primaryStats > 0) return primary;

      const appLang = resolveScores365AppLanguage(language);
      if (appLang === 'en') return primary;

      const fallback = await this.fetchPlayerMatchReportForLang(athleteId, gameId, 'en');
      if (!fallback.data) return primary;

      if (primary.data?.name && fallback.data) {
        fallback.data = {
          ...fallback.data,
          name: primary.data.name,
          shortName: primary.data.shortName ?? primary.data.name,
        };
      }

      logger.debug(
        `[365Scores] player report ${athleteId}/${gameId}: EN fallback (${fallback.data.stats?.length ?? 0} stats)`,
      );
      return fallback;
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
      const cacheKey = `365:player-info:v2:${athleteId}:${langId}`;
      const cached = await redisCacheService.get<ThreeSixFivePlayerBasicInfo>(cacheKey);
      if (cached) return { data: cached, source: '365scores' };

      const payload = await this.fetchJson<NextGamePayload>(
        `/web/athletes/nextGame?${this.commonParams(langId)}&athletes=${athleteId}&fullDetails=true`,
        `player-info:${athleteId}`,
        86_400_000,
      );
      const raw = payload?.athletes?.[0] as any;
      if (!raw) return { data: null, source: null };

      const data: ThreeSixFivePlayerBasicInfo = {
        athleteId,
        name: (raw.name as string) ?? '—',
        shortName: raw.shortName as string | undefined,
        club: (raw.clubName as string) ?? (raw.competitorName as string),
        nationality:
          (raw.nationalityName as string | undefined) ?? (raw.countryName as string | undefined),
        position:
          (raw.position?.name as string | undefined) ??
          (raw.positionName as string | undefined) ??
          (typeof raw.position === 'string' ? raw.position : undefined),
        imageUrl: buildScores365AthletePhotoUrl(athleteId, 68),
        dateOfBirth: this.parse365DateOfBirth(raw),
        height: this.parse365Height(raw),
        age: this.num365(raw.age),
        transfers: this.parse365AthleteTransfers(raw, undefined),
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
    options?: { langId?: number },
  ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerCareer>> {
    try {
      /*
       * An explicit langId wins over the app-language mapping. Without it a
       * caller cannot ask for a specific language at all: SCORES365_FORCE_ENGLISH
       * rewrites every request to English inside resolveScores365LangId, which
       * is right for a viewer (one language for the whole session) and wrong for
       * anything that has to fill a per-language cache (Football Grid).
       */
      const langId = options?.langId ?? resolveScores365LangId(language);
      const cacheKey = `365:player-career:v6:${athleteId}:${langId}`;
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
      await redisCacheService.del(`365:player-career:v5:${athleteId}:${lid}`);
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

  private parse365DateOfBirth(raw: any): string | null {
    const direct =
      (raw?.birthdate as string | undefined) ??
      (raw?.birthDate as string | undefined) ??
      (raw?.dateOfBirth as string | undefined);
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const details = Array.isArray(raw?.playerDetails) ? raw.playerDetails : [];
    for (const row of details) {
      const title = String(row?.title ?? '');
      const value = String(row?.value ?? '');
      if (/\d{2}[\/.-]\d{2}[\/.-]\d{4}/.test(title)) return title;
      if (/birth|dob|ميلاد/i.test(title) && value) return value;
    }
    return null;
  }

  private parse365Height(raw: any): string | null {
    const direct = raw?.height;
    if (typeof direct === 'number' && direct > 0) return String(direct);
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const details = Array.isArray(raw?.playerDetails) ? raw.playerDetails : [];
    for (const row of details) {
      const title = String(row?.title ?? '');
      const value = String(row?.value ?? '');
      if (/height|طول/i.test(title) && value) return value;
    }
    return null;
  }

  private parse365AthleteTransfers(
    raw: any,
    competitorNames?: Map<number, string>,
  ): ThreeSixFivePlayerTransfer[] {
    const list = Array.isArray(raw?.transfers) ? raw.transfers : [];
    return list
      .map((t: any) => {
        const competitorId = this.num365(t?.competitorId);
        return {
          competitorId,
          competitorName:
            (competitorId != null ? competitorNames?.get(competitorId) : undefined) ??
            (t?.competitorName as string | undefined) ??
            null,
          competitorLogo:
            competitorId != null ? buildCompetitorLogoUrl(competitorId, t?.imageVersion ?? null) : null,
          date: (t?.date as string | undefined) ?? null,
          transferTitle: (t?.transferTitle as string | undefined) ?? null,
          price: t?.price && t.price !== '-' ? String(t.price) : null,
          active: t?.active === true,
        } satisfies ThreeSixFivePlayerTransfer;
      })
      .filter((t: ThreeSixFivePlayerTransfer) => t.competitorId != null || t.date != null);
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
      dateOfBirth: this.parse365DateOfBirth(raw),
      height: this.parse365Height(raw),
      imageUrl: buildScores365AthletePhotoUrl(
        athleteId,
        80,
        this.num365(raw?.imageVersion),
      ),
      transfers: this.parse365AthleteTransfers(raw, competitorNames),
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
    const today = calendarTodayKey();
    const minDate = offsetCalendarDateKey(today, -2);
    const maxDate = offsetCalendarDateKey(today, 45);
    const pageCap = fixturesHotPageCap();
    const add = (games?: Scores365Game[]) => {
      for (const g of games ?? []) {
        const date = calendarDateFromKickoff(g.startTime);
        if (date && date >= minDate && date <= maxDate && !seen.has(g.id)) {
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
    for (let step = 0; prev && step < pageCap; step++) {
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
    for (let step = 0; next && step < pageCap; step++) {
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
    timeoutMs = 12_000,
  ): Promise<T | null> {
    if (!skipRateLimit && minIntervalMs > 0 && !this.canFetchUpstream(rateKey, minIntervalMs)) {
      return null;
    }

    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;

    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(Math.max(5_000, timeoutMs)),
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

      setBoundedMapEntry(
        this.lastUpstreamFetch,
        rateKey,
        Date.now(),
        scores365RateLimitMapMaxEntries(),
      );
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
    const gameIds = [...new Set(items.map((item) => item.gameId))];
    const exactRows = await prisma.cachedFixture.findMany({
      where: { fixtureId: { in: gameIds } },
      select: CACHED_FIXTURE_PERSIST_SELECT,
    });
    const exactByFixtureId = new Map(exactRows.map((row) => [row.fixtureId, row]));
    const needsAlignment = items.some((item) => !exactByFixtureId.has(item.gameId));
    const alignmentRows = needsAlignment
      ? await prisma.cachedFixture.findMany({
          where: { leagueId, leagueSeason: season },
          orderBy: { matchDate: 'asc' },
          select: CACHED_FIXTURE_PERSIST_SELECT,
        })
      : [];
    const dbRows = [...exactRows, ...alignmentRows.filter((row) => !exactByFixtureId.has(row.fixtureId))];
    const finishedItems = items.filter((item) => item.phase === 'finished');
    const finishedKeys = finishedItems.map(
      (item) => `${FINISHED_UPSERTED_KEY_PREFIX}${item.gameId}`,
    );
    const finishedMarkers = await redisCacheService.getMany<boolean>(finishedKeys);
    const finishedMarkerByGameId = new Map(
      finishedItems.map((item, index) => [item.gameId, finishedMarkers[index] === true]),
    );

    const toUpsert: FixtureFromAPI[] = [];
    const markersToSet: string[] = [];

    for (const item of items) {
      // Finished fixtures are immutable — upsert once, then skip on later ticks.
      // Upcoming/live fixtures change (score, status, lineups) — refresh every tick.
      const isFinished = item.phase === 'finished';
      const upsertedKey = `${FINISHED_UPSERTED_KEY_PREFIX}${item.gameId}`;
      if (isFinished && finishedMarkerByGameId.get(item.gameId)) continue;

      const dbRow = exactByFixtureId.get(item.gameId) ?? this.resolveDbRow(item.raw, dbRows);
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
        if (isFinished) markersToSet.push(upsertedKey);
      }
    }

    if (toUpsert.length > 0) {
      const count = await matchCacheService.upsertFixtures(toUpsert);
      if (count === toUpsert.length) {
        await redisCacheService.setMany(
          markersToSet.map((key) => ({ key, value: true, ttlMs: FINISHED_MARKER_TTL_MS })),
        );
      } else {
        logger.warn('[365Scores] skipped finished markers after partial fixture persistence');
      }
      logger.debug(`[365Scores] upserted ${count} WC fixtures to DB (all phases)`);
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
   * Fetch /allscores/ without persisting. Returns null on upstream failure so
   * callers can avoid wiping the live Redis list.
   */
  private async loadAllScoresItems(
    startDate: string,
    endDate: string,
    language?: string | null,
    options?: { force?: boolean },
  ): Promise<{
    items: ThreeSixFiveFixtureItem[];
    competitionMeta: CompetitionMetaMap;
    fromCache: boolean;
  } | null> {
    const langId = resolveScores365LangId(language);
    const majorOnly = useOnlyMajorGames();
    const queryStart = toScores365QueryDate(startDate);
    const queryEnd = toScores365QueryDate(endDate);
    const cacheKey = `365:allscores:dmy:${startDate}:${endDate}:${langId}:${majorOnly ? 'major' : 'all'}`;
    if (!options?.force) {
      const cached = await redisCacheService.get<ThreeSixFiveFixtureItem[]>(cacheKey);
      if (cached) {
        return { items: cached, competitionMeta: new Map(), fromCache: true };
      }
    }

    const path =
      `/web/games/allscores/?${this.commonParams(langId)}` +
      `&sports=1&startDate=${encodeURIComponent(queryStart)}` +
      `&endDate=${encodeURIComponent(queryEnd)}&showOdds=true&onlyMajorGames=${majorOnly}&withTop=true`;

    const payload = await this.fetchJson<AllScoresPayload>(
      path,
      `allscores:${queryStart}:${queryEnd}`,
      options?.force ? 0 : 120_000,
      options?.force === true,
      25_000,
    );
    if (!payload) return null;

    const competitionMeta = this.buildCompetitionMeta(payload);
    const items = (payload.games ?? []).map((g) => this.toFixtureItem(g));
    await redisCacheService.set(cacheKey, items, 120_000);
    return { items, competitionMeta, fromCache: false };
  }

  /**
   * League-agnostic persistence for the /allscores/ feed (non-WC competitions).
   * Processes one calendar day at a time with paged DB loads so a multi-day
   * window cannot explode RSS in a single unbounded findMany.
   */
  private async persistAllScoresFixtures(
    items: ThreeSixFiveFixtureItem[],
    competitionMeta?: CompetitionMetaMap,
    options?: { refreshLiveDetails?: boolean },
  ): Promise<{ liveFixtures: FixtureFromAPI[]; retiredIds: number[] }> {
    if (!items.length) return { liveFixtures: [], retiredIds: [] };

    const byDay = new Map<string, ThreeSixFiveFixtureItem[]>();
    for (const item of items) {
      const day = calendarDateFromKickoff(item.raw.startTime);
      if (!day) continue;
      const list = byDay.get(day);
      if (list) list.push(item);
      else byDay.set(day, [item]);
    }

    const liveFixtures: FixtureFromAPI[] = [];
    const retiredIds: number[] = [];
    for (const [day, dayItems] of byDay) {
      const result = await this.persistAllScoresFixturesForDay(day, dayItems, competitionMeta);
      liveFixtures.push(...result.liveFixtures);
      retiredIds.push(...result.retiredIds);
    }

    if (options?.refreshLiveDetails !== false) {
      const liveGameIds = items.filter((i) => i.phase === 'live').map((i) => i.gameId);
      if (liveGameIds.length > 0) {
        void sync365SyntheticLiveSnapshots({ gameIds: liveGameIds, language: 'en' });
      }
    }

    return { liveFixtures, retiredIds: [...new Set(retiredIds)] };
  }

  /** Page CachedFixture rows for a date range — never one unbounded query. */
  private async loadCachedFixturesPaged(
    gte: Date,
    lte: Date,
  ): Promise<CachedFixturePersistenceRow[]> {
    const PAGE = Math.max(
      200,
      Math.min(2000, parseInt(process.env.ALLSCORES_DB_PAGE_SIZE || '1000', 10) || 1000),
    );
    const out: CachedFixturePersistenceRow[] = [];
    let cursorId: string | undefined;

    for (;;) {
      const page = await prisma.cachedFixture.findMany({
        where: { matchDate: { gte, lte } },
        orderBy: [{ matchDate: 'asc' }, { id: 'asc' }],
        select: CACHED_FIXTURE_PERSIST_SELECT,
        take: PAGE,
        ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      });
      if (!page.length) break;
      out.push(...page);
      cursorId = page[page.length - 1]?.id;
      if (page.length < PAGE) break;
    }

    return out;
  }

  private async persistAllScoresFixturesForDay(
    day: string,
    items: ThreeSixFiveFixtureItem[],
    competitionMeta?: CompetitionMetaMap,
  ): Promise<{ liveFixtures: FixtureFromAPI[]; retiredIds: number[] }> {
    if (!items.length) return { liveFixtures: [], retiredIds: [] };

    const dayStart = new Date(`${day}T00:00:00.000Z`);
    const dayEnd = new Date(`${day}T23:59:59.999Z`);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
      return { liveFixtures: [], retiredIds: [] };
    }

    const WINDOW_MS = 3 * 60 * 60 * 1000;
    const gameIds = [...new Set(items.map((item) => item.gameId))];
    const exactRows = await prisma.cachedFixture.findMany({
      where: { fixtureId: { in: gameIds } },
      select: CACHED_FIXTURE_PERSIST_SELECT,
    });
    const exactByFixtureId = new Map(exactRows.map((row) => [row.fixtureId, row]));
    const needsAlignment = items.some((item) => !exactByFixtureId.has(item.gameId));
    const alignmentRows = needsAlignment
      ? await this.loadCachedFixturesPaged(
          new Date(dayStart.getTime() - WINDOW_MS),
          new Date(dayEnd.getTime() + WINDOW_MS),
        )
      : [];
    const dbRows = [
      ...exactRows,
      ...alignmentRows.filter((row) => !exactByFixtureId.has(row.fixtureId)),
    ];

    if (competitionMeta) {
      await this.reconcileSyntheticLeagueMeta(dbRows, competitionMeta);
    }

    const toUpsert: FixtureFromAPI[] = [];
    const liveFixtures: FixtureFromAPI[] = [];
    const retiredIds: number[] = [];
    const competitions = new Set<number>();
    const finishedItems = items.filter((item) => item.phase === 'finished');
    const finishedKeys = finishedItems.map(
      (item) => `${FINISHED_UPSERTED_KEY_PREFIX}${item.gameId}`,
    );
    const markerValues = await redisCacheService.getMany<boolean>(finishedKeys);
    const finishedMarkerByGameId = new Map(
      finishedItems.map((item, index) => [item.gameId, markerValues[index] === true]),
    );
    const markersToSet: string[] = [];

    for (const item of items) {
      const isFinished = item.phase === 'finished';
      const upsertedKey = `${FINISHED_UPSERTED_KEY_PREFIX}${item.gameId}`;
      const replaced = findReplacedSyntheticFixture(
        {
          gameId: item.gameId,
          startTime: item.raw.startTime,
          homeName: item.raw.homeCompetitor?.name ?? item.homeName,
          awayName: item.raw.awayCompetitor?.name ?? item.awayName,
          competitionId: item.competitionId ?? item.raw.competitionId,
        },
        dbRows,
      );

      if (isFinished && finishedMarkerByGameId.get(item.gameId)) {
          const candidateRow =
            exactByFixtureId.get(item.gameId) ?? this.resolveDbRow(item.raw, dbRows);
          const stillLiveInDb =
            !!candidateRow &&
            candidateRow.leagueId >= SCORES365_LEAGUE_ID_OFFSET &&
            LIVE_STATUSES.includes(candidateRow.status);
          if (!stillLiveInDb) {
            if (replaced && LIVE_STATUSES.includes(replaced.status ?? '')) {
              retiredIds.push(replaced.fixtureId);
            }
            continue;
          }
      }

      const target = this.resolveAllScoresPersistTarget(
        item,
        exactByFixtureId,
        dbRows,
        competitionMeta,
        replaced,
      );
      if (!target) continue;
      if (target.retiredId != null) retiredIds.push(target.retiredId);

      const mapped = await mapScores365ToApiFootballFixture(
        item.raw as Parameters<typeof mapScores365ToApiFootballFixture>[0],
        target.base,
        target.fixtureId,
      );
      if (mapped) {
        toUpsert.push(mapped);
        registerScores365FixtureMapping(target.fixtureId, item.gameId);
        const compId = item.competitionId ?? item.raw.competitionId;
        if (compId) competitions.add(compId);
        if (isFinished) markersToSet.push(upsertedKey);
        if (LIVE_STATUSES.includes(mapped.fixture?.status?.short ?? '')) {
          liveFixtures.push(mapped);
        }
      }
    }

    if (toUpsert.length > 0) {
      const count = await matchCacheService.upsertFixtures(toUpsert);
      if (count === toUpsert.length) {
        await redisCacheService.setMany(
          markersToSet.map((key) => ({ key, value: true, ttlMs: FINISHED_MARKER_TTL_MS })),
        );
      } else {
        logger.warn('[OtherLeagues-365] skipped finished markers after partial fixture persistence');
      }
      logger.info(
        `[OtherLeagues-365] upserted ${count} fixtures across ${competitions.size} competitions (day=${day})`,
      );

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

    const uniqueRetired = [...new Set(retiredIds)];
    if (uniqueRetired.length > 0) {
      await this.retireReplacedSyntheticFixtures(uniqueRetired);
    }

    return { liveFixtures, retiredIds: uniqueRetired };
  }

  private buildSyntheticAllScoresBase(
    item: ThreeSixFiveFixtureItem,
    competitionMeta?: CompetitionMetaMap,
  ): FixtureFromAPI | null {
    const competitionId = item.competitionId ?? item.raw.competitionId;
    if (!competitionId) {
      logger.debug(
        `[OtherLeagues-365] game ${item.gameId}: no competitionId — skipping synthetic build`,
      );
      return null;
    }
    const kickoff = item.raw.startTime ? new Date(item.raw.startTime) : new Date();
    const meta = competitionMeta?.get(competitionId);
    return synthesizeBaseFrom365Game(
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
  }

  private resolveAllScoresPersistTarget(
    item: ThreeSixFiveFixtureItem,
    exactByFixtureId: Map<number, CachedFixturePersistenceRow>,
    dbRows: CachedFixturePersistenceRow[],
    competitionMeta: CompetitionMetaMap | undefined,
    replaced: ReturnType<typeof findReplacedSyntheticFixture>,
  ): { base: FixtureFromAPI; fixtureId: number; retiredId: number | null } | null {
    const exact = exactByFixtureId.get(item.gameId);
    const aligned = exact ?? this.resolveDbRow(item.raw, dbRows);
    const retiredId =
      replaced && replaced.fixtureId !== item.gameId ? replaced.fixtureId : null;

    if (exact) {
      return {
        base: matchCacheService.convertDbMatchToApiFormat(exact),
        fixtureId: exact.fixtureId,
        retiredId,
      };
    }

    if (aligned && aligned.leagueId < SCORES365_LEAGUE_ID_OFFSET) {
      return {
        base: matchCacheService.convertDbMatchToApiFormat(aligned),
        fixtureId: aligned.fixtureId,
        retiredId: null,
      };
    }

    if (aligned && aligned.leagueId >= SCORES365_LEAGUE_ID_OFFSET && aligned.fixtureId !== item.gameId) {
      const base = this.buildSyntheticAllScoresBase(item, competitionMeta);
      if (!base) return null;
      return { base, fixtureId: item.gameId, retiredId: aligned.fixtureId };
    }

    if (aligned) {
      return {
        base: matchCacheService.convertDbMatchToApiFormat(aligned),
        fixtureId: aligned.fixtureId,
        retiredId,
      };
    }

    const base = this.buildSyntheticAllScoresBase(item, competitionMeta);
    if (!base) return null;
    return { base, fixtureId: item.gameId, retiredId };
  }

  private async mapAllScoresItemToLiveFixture(
    item: ThreeSixFiveFixtureItem,
    competitionMeta?: CompetitionMetaMap,
  ): Promise<FixtureFromAPI | null> {
    const base = this.buildSyntheticAllScoresBase(item, competitionMeta);
    const mapped = await mapScores365ToApiFootballFixture(
      item.raw as Parameters<typeof mapScores365ToApiFootballFixture>[0],
      base,
      item.gameId,
    );
    if (!mapped) return null;
    return coerceAllScoresLiveStatus(mapped, item.raw);
  }

  private async retireReplacedSyntheticFixtures(ids: number[]): Promise<void> {
    const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
    if (!unique.length) return;
    const rows = await prisma.cachedFixture.findMany({
      where: { fixtureId: { in: unique } },
      select: CACHED_FIXTURE_PERSIST_SELECT,
    });
    const terminals: FixtureFromAPI[] = [];
    for (const row of rows) {
      if (row.leagueId < SCORES365_LEAGUE_ID_OFFSET) continue;
      terminals.push(asTerminalFinishedFixture(matchCacheService.convertDbMatchToApiFormat(row)));
    }
    if (!terminals.length) return;
    await matchCacheService.upsertFixtures(terminals);
    const { writeTerminalFixtureSnapshot } = await import('./live-fixture-cache.service');
    await Promise.all(terminals.map((fixture) => writeTerminalFixtureSnapshot(fixture, '365')));
  }

  /**
   * Correct drifted league metadata (country / logo) on already-stored
   * synthetic 365 fixtures. Only rows whose country or logo actually differ
   * from the authoritative competition meta are written, so this is a no-op on
   * a healthy DB and cheap on a drifted one.
   */
  private async reconcileSyntheticLeagueMeta(
    dbRows: CachedFixturePersistenceRow[],
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
    dbRows: CachedFixturePersistenceRow[],
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
