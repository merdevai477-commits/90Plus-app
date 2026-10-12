/**
 * Compact feed for the home-screen widgets (iOS WidgetKit + Android AppWidget).
 * The native widgets fetch this on their own, so the shape stays flat and stable.
 */

import prisma from '../lib/prisma';
import { footballDataCacheService } from './football-data-cache.service';
import { readLiveFixtureById } from './live-fixture-cache.service';
import { matchCacheService, type FixtureFromAPI } from './match-cache.service';
import { logger } from '../utils/logger';

export const WIDGET_MAX_TEAMS = 8;
const TOP_PLAYERS = 3;
const MOMENTUM_BUCKETS = 12;
const FIXTURE_LIST_CAP = 6;
const FEATURED_SIDE_BUDGET_MS = 2_000;
/** A finished match stays on the widget this long before the next fixture takes over. */
const RECENT_FINISH_WINDOW_SEC = 3 * 60 * 60;

const LIVE_SHORT = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_SHORT = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const OFF_SHORT = new Set(['PST', 'CANC', 'ABD']);

export type WidgetMatchStatus = 'live' | 'ht' | 'upcoming' | 'ft' | 'off';

export interface WidgetSide {
  id: number;
  name: string;
  logo: string | null;
}

export interface WidgetMatch {
  fixtureId: number;
  status: WidgetMatchStatus;
  statusShort: string;
  kickoffTs: number;
  elapsed: number | null;
  extra: number | null;
  home: WidgetSide;
  away: WidgetSide;
  score: { home: number; away: number } | null;
  league: { id: number; name: string; logo: string | null };
}

export interface WidgetTeam {
  teamId: number;
  name: string;
  logo: string | null;
  match: WidgetMatch | null;
}

export interface WidgetTopPlayer {
  id: number | null;
  name: string;
  rating: number;
  side: 'home' | 'away';
  photo: string | null;
}

export interface WidgetLineupPlayer {
  id: number | null;
  name: string;
  photo: string | null;
  pos: string | null;
  grid: string | null;
  /** Null when the provider sent no rating. Zero is never invented. */
  rating: number | null;
  number: number | null;
}

export interface WidgetLineup {
  homeFormation: string | null;
  awayFormation: string | null;
  home: WidgetLineupPlayer[];
  away: WidgetLineupPlayer[];
}

export interface WidgetStatPair {
  home: number;
  away: number;
}

export interface WidgetStats {
  possession: WidgetStatPair | null;
  shots: WidgetStatPair | null;
  shotsOn: WidgetStatPair | null;
  corners: WidgetStatPair | null;
  xg: WidgetStatPair | null;
}

export interface WidgetFeatured {
  fixtureId: number;
  topPlayers: WidgetTopPlayer[];
  momentum: Array<{ minute: number; home: number; away: number }>;
  lineup: WidgetLineup | null;
  stats: WidgetStats | null;
}

export type WidgetPrimaryReason = 'favorite' | 'live' | null;

export interface WidgetFeedPayload {
  generatedAt: number;
  hasLive: boolean;
  teams: WidgetTeam[];
  /** The card that must stay on top. Null when the fixtures list is the whole story. */
  primary: WidgetMatch | null;
  primaryReason: WidgetPrimaryReason;
  /** Other live matches, then upcoming ones. Deduped, chronological, excluding `primary`. */
  fixtures: WidgetMatch[];
  featured: WidgetFeatured | null;
}

export function parseWidgetTeamIds(raw: unknown): number[] {
  const text = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : '';
  const ids: number[] = [];
  for (const part of text.split(',')) {
    const id = Number.parseInt(part.trim(), 10);
    if (Number.isFinite(id) && id > 0 && !ids.includes(id)) ids.push(id);
    if (ids.length >= WIDGET_MAX_TEAMS) break;
  }
  return ids;
}

function toWidgetStatus(short: string): WidgetMatchStatus {
  if (short === 'HT') return 'ht';
  if (LIVE_SHORT.has(short)) return 'live';
  if (FINISHED_SHORT.has(short)) return 'ft';
  if (OFF_SHORT.has(short)) return 'off';
  return 'upcoming';
}

export function toWidgetMatch(f: FixtureFromAPI): WidgetMatch {
  const short = f.fixture?.status?.short ?? 'NS';
  const status = toWidgetStatus(short);
  const hasScore = status !== 'upcoming' && status !== 'off';
  return {
    fixtureId: f.fixture.id,
    status,
    statusShort: short,
    kickoffTs: f.fixture.timestamp ?? Math.floor(new Date(f.fixture.date).getTime() / 1000),
    elapsed: f.fixture.status?.elapsed ?? null,
    extra: f.fixture.status?.extra ?? null,
    home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo || null },
    away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo || null },
    score: hasScore ? { home: f.goals?.home ?? 0, away: f.goals?.away ?? 0 } : null,
    league: { id: f.league?.id ?? 0, name: f.league?.name ?? '', logo: f.league?.logo || null },
  };
}

function kickoffOf(f: FixtureFromAPI): number {
  return f.fixture?.timestamp ?? Math.floor(new Date(f.fixture?.date ?? 0).getTime() / 1000);
}

/** Live first, else a match that finished in the last few hours, else the nearest upcoming one. */
export function pickNearestFixture(
  matches: { live: FixtureFromAPI[]; upcoming: FixtureFromAPI[]; finished: FixtureFromAPI[] },
  nowSec: number,
): FixtureFromAPI | null {
  if (matches.live.length > 0) return matches.live[0];

  const recentFinish = [...matches.finished]
    .filter((f) => nowSec - kickoffOf(f) <= RECENT_FINISH_WINDOW_SEC)
    .sort((a, b) => kickoffOf(b) - kickoffOf(a))[0];
  if (recentFinish) return recentFinish;

  const upcoming = [...matches.upcoming].sort((a, b) => kickoffOf(a) - kickoffOf(b));
  return upcoming[0] ?? null;
}

/** Competitor lists are cached for minutes; the live snapshot carries the current clock and score. */
async function overlayLiveState(f: FixtureFromAPI, nowSec: number): Promise<FixtureFromAPI> {
  const short = f.fixture?.status?.short ?? 'NS';
  const mayBeLive = LIVE_SHORT.has(short) || short === 'HT' || kickoffOf(f) <= nowSec + 15 * 60;
  if (!mayBeLive || FINISHED_SHORT.has(short)) return f;
  const live = await readLiveFixtureById(f.fixture.id).catch(() => null);
  if (!live?.fixture?.status) return f;
  return { ...f, fixture: { ...f.fixture, status: live.fixture.status }, goals: live.goals ?? f.goals };
}

function sideOf(f: WidgetMatch, teamId: number): WidgetSide | null {
  if (f.home.id === teamId) return f.home;
  if (f.away.id === teamId) return f.away;
  return null;
}

const STATUS_ORDER: Record<WidgetMatchStatus, number> = { live: 0, ht: 0, upcoming: 1, ft: 2, off: 3 };

function compareTeams(a: WidgetTeam, b: WidgetTeam): number {
  if (!a.match && !b.match) return 0;
  if (!a.match) return 1;
  if (!b.match) return -1;
  const order = STATUS_ORDER[a.match.status] - STATUS_ORDER[b.match.status];
  if (order !== 0) return order;
  return a.match.kickoffTs - b.match.kickoffTs;
}

export function pickTopPlayers(lineups: any[], homeTeamId: number): WidgetTopPlayer[] {
  const seen = new Set<string>();
  const players: WidgetTopPlayer[] = [];
  for (const lineup of lineups ?? []) {
    const side: 'home' | 'away' = lineup?.team?.id === homeTeamId ? 'home' : 'away';
    for (const item of [...(lineup?.startXI ?? []), ...(lineup?.substitutes ?? [])]) {
      const p = item?.player ?? {};
      const rating = typeof p.rating === 'number' ? p.rating : Number.parseFloat(p.rating);
      if (!Number.isFinite(rating) || rating <= 0) continue;
      const id = (p.id ?? p.athleteId ?? null) as number | null;
      const key = id != null ? `id:${id}` : `name:${p.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({ id, name: String(p.name ?? ''), rating, side, photo: p.photo || null });
    }
  }
  return players.sort((a, b) => b.rating - a.rating).slice(0, TOP_PLAYERS);
}

export function compressMomentum(
  series: Array<{ minute: number; home: number; away: number }>,
  buckets = MOMENTUM_BUCKETS,
): Array<{ minute: number; home: number; away: number }> {
  if (!series?.length) return [];
  const size = Math.max(1, Math.ceil(series.length / buckets));
  const out: Array<{ minute: number; home: number; away: number }> = [];
  for (let i = 0; i < series.length; i += size) {
    const chunk = series.slice(i, i + size);
    const avg = (key: 'home' | 'away') =>
      Math.round(chunk.reduce((sum, p) => sum + (p[key] ?? 0), 0) / chunk.length);
    out.push({ minute: chunk[chunk.length - 1].minute, home: avg('home'), away: avg('away') });
  }
  return out;
}

function withBudget<T>(work: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), FEATURED_SIDE_BUDGET_MS);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function ratingOrNull(raw: unknown): number | null {
  const rating = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''));
  return Number.isFinite(rating) && rating > 0 ? rating : null;
}

function mapStarter(item: any): WidgetLineupPlayer {
  const player = item?.player ?? {};
  const number = Number(player.number);
  return {
    id: (player.id ?? player.athleteId ?? null) as number | null,
    name: String(player.name ?? ''),
    photo: player.photo || null,
    pos: player.pos || null,
    grid: typeof player.grid === 'string' && player.grid ? player.grid : null,
    rating: ratingOrNull(player.rating),
    number: Number.isFinite(number) ? number : null,
  };
}

/** Official XI only. Ratings never invent a lineup, and an incomplete row is not shown as the XI. */
export function pickOfficialLineup(lineups: any[], homeTeamId: number): WidgetLineup | null {
  if (!Array.isArray(lineups) || lineups.length < 2) return null;
  const home = lineups.find((row) => row?.team?.id === homeTeamId) ?? lineups[0];
  const away = lineups.find((row) => row !== home);
  if (!home || !away) return null;
  if (home._incomplete || away._incomplete) return null;
  const homeXI = Array.isArray(home.startXI) ? home.startXI : [];
  const awayXI = Array.isArray(away.startXI) ? away.startXI : [];
  if (homeXI.length === 0 || awayXI.length === 0) return null;
  const confirmed = home._lineupsConfirmed === true || away._lineupsConfirmed === true;
  const full = homeXI.length >= 11 && awayXI.length >= 11;
  if (!confirmed && !full) return null;
  return {
    homeFormation: home.formation || null,
    awayFormation: away.formation || null,
    home: homeXI.map(mapStarter),
    away: awayXI.map(mapStarter),
  };
}

function statNumber(rows: any[] | undefined, type: string): number | null {
  const row = (rows ?? []).find((stat) => stat?.type === type);
  if (row == null || row.value == null || row.value === '') return null;
  const value = typeof row.value === 'number' ? row.value : Number.parseFloat(String(row.value).replace('%', ''));
  return Number.isFinite(value) ? value : null;
}

function statPair(statistics: any[], type: string, homeTeamId: number): WidgetStatPair | null {
  if (!Array.isArray(statistics) || statistics.length < 2) return null;
  const home = statistics.find((row) => row?.team?.id === homeTeamId) ?? statistics[0];
  const away = statistics.find((row) => row !== home);
  if (!home || !away) return null;
  const homeValue = statNumber(home.statistics, type);
  const awayValue = statNumber(away.statistics, type);
  if (homeValue == null || awayValue == null) return null;
  return { home: homeValue, away: awayValue };
}

export function pickWidgetStats(statistics: any[], homeTeamId: number): WidgetStats | null {
  const stats: WidgetStats = {
    possession: statPair(statistics, 'Ball Possession', homeTeamId),
    shots: statPair(statistics, 'Total Shots', homeTeamId),
    shotsOn: statPair(statistics, 'Shots on Goal', homeTeamId),
    corners: statPair(statistics, 'Corner Kicks', homeTeamId),
    xg: statPair(statistics, 'expected_goals', homeTeamId),
  };
  return Object.values(stats).some((pair) => pair != null) ? stats : null;
}

async function buildFeatured(match: WidgetMatch, language: string): Promise<WidgetFeatured> {
  const [lineups, momentum, statistics] = await Promise.all([
    footballDataCacheService.getMatchLineups(match.fixtureId, { language }).catch(() => []),
    footballDataCacheService.getMatchMomentum(match.fixtureId, { language }).catch(() => null),
    withBudget(
      footballDataCacheService.getMatchStatistics(match.fixtureId, { language }).catch(() => []),
      [],
    ),
  ]);
  return {
    fixtureId: match.fixtureId,
    topPlayers: pickTopPlayers(lineups, match.home.id),
    momentum: momentum?.available ? compressMomentum(momentum.series) : [],
    lineup: pickOfficialLineup(lineups, match.home.id),
    stats: pickWidgetStats(statistics, match.home.id),
  };
}

function isLiveStatus(status: WidgetMatchStatus): boolean {
  return status === 'live' || status === 'ht';
}

function byKickoff(a: WidgetMatch, b: WidgetMatch): number {
  if (a.kickoffTs !== b.kickoffTs) return a.kickoffTs - b.kickoffTs;
  return a.fixtureId - b.fixtureId;
}

/**
 * Favorite (live, else upcoming, else most recently finished) beats every followed-team match.
 * A followed-team finish within the recent window is only used when nothing is upcoming.
 */
export function choosePrimary(
  favorites: WidgetMatch[],
  followed: WidgetMatch[],
  nowSec: number,
): { primary: WidgetMatch | null; reason: WidgetPrimaryReason } {
  const favoriteLive = favorites.filter((match) => isLiveStatus(match.status)).sort(byKickoff)[0];
  if (favoriteLive) return { primary: favoriteLive, reason: 'favorite' };
  const favoriteUpcoming = favorites.filter((match) => match.status === 'upcoming').sort(byKickoff)[0];
  if (favoriteUpcoming) return { primary: favoriteUpcoming, reason: 'favorite' };
  const favoriteDone = [...favorites]
    .filter((match) => match.status === 'ft' || match.status === 'off')
    .sort((a, b) => b.kickoffTs - a.kickoffTs || a.fixtureId - b.fixtureId)[0];
  if (favoriteDone) return { primary: favoriteDone, reason: 'favorite' };

  const live = followed.filter((match) => isLiveStatus(match.status)).sort(byKickoff)[0];
  if (live) return { primary: live, reason: 'live' };
  if (followed.some((match) => match.status === 'upcoming')) return { primary: null, reason: null };

  const recent = followed
    .filter((match) => match.status === 'ft' && nowSec - match.kickoffTs <= RECENT_FINISH_WINDOW_SEC)
    .sort((a, b) => b.kickoffTs - a.kickoffTs)[0];
  return recent ? { primary: recent, reason: null } : { primary: null, reason: null };
}

/** One card per followed club: its live match, else its next kickoff. A club on the primary card gets no extra card. */
function listFixtures(
  matches: WidgetMatch[],
  teamIds: number[],
  primary: WidgetMatch | null,
  nowSec: number,
): WidgetMatch[] {
  const stillAhead = nowSec - 3 * 60 * 60;
  const followed = new Set(teamIds);
  const covered = new Set<number>();
  if (primary) [primary.home.id, primary.away.id].forEach((id) => covered.add(id));

  const candidates = matches
    .filter((match) => match.fixtureId !== primary?.fixtureId)
    .filter((match) => isLiveStatus(match.status) || match.status === 'upcoming' || match.status === 'off')
    .filter((match) => isLiveStatus(match.status) || match.kickoffTs >= stillAhead)
    .sort((a, b) => {
      const rank = (match: WidgetMatch) => (isLiveStatus(match.status) ? 0 : 1);
      return rank(a) - rank(b) || byKickoff(a, b);
    });

  const picked: WidgetMatch[] = [];
  for (const match of candidates) {
    const clubs = [match.home.id, match.away.id].filter((id) => followed.has(id));
    if (clubs.length === 0 || clubs.every((id) => covered.has(id))) continue;
    clubs.forEach((id) => covered.add(id));
    picked.push(match);
    if (picked.length >= FIXTURE_LIST_CAP) break;
  }
  return picked;
}

/** One followed team with its nearest match, live clock and score overlaid. */
export async function resolveTeamMatch(teamId: number, language: string, nowSec: number): Promise<WidgetTeam> {
  try {
    const result = await footballDataCacheService.getCached365CompetitorMatches(teamId, language);
    const picked = result.data ? pickNearestFixture(result.data, nowSec) : null;
    const match = picked ? toWidgetMatch(await overlayLiveState(picked, nowSec)) : null;
    const side = match ? sideOf(match, teamId) : null;
    return { teamId, name: side?.name ?? '', logo: side?.logo ?? null, match };
  } catch (err) {
    logger.warn(`[WidgetFeed] competitor ${teamId} failed:`, err);
    return { teamId, name: '', logo: null, match: null };
  }
}

interface CompetitorPool {
  live: FixtureFromAPI[];
  upcoming: FixtureFromAPI[];
  finished: FixtureFromAPI[];
}

async function loadPool(teamId: number, language: string): Promise<CompetitorPool | null> {
  try {
    const result = await footballDataCacheService.getCached365CompetitorMatches(teamId, language);
    return result.data ?? null;
  } catch (err) {
    logger.warn(`[WidgetFeed] competitor ${teamId} failed:`, err);
    return null;
  }
}

function poolFixtures(pool: CompetitorPool | null, nowSec: number): FixtureFromAPI[] {
  if (!pool) return [];
  const recentFinished = pool.finished.filter((fixture) => nowSec - kickoffOf(fixture) <= RECENT_FINISH_WINDOW_SEC);
  return [...pool.live, ...pool.upcoming, ...recentFinished];
}

async function fixtureFromStore(fixtureId: number): Promise<FixtureFromAPI | null> {
  const live = await readLiveFixtureById(fixtureId).catch(() => null);
  if (live?.fixture?.id) return live as FixtureFromAPI;
  const row = await prisma.cachedFixture.findUnique({ where: { fixtureId } }).catch(() => null);
  if (!row) return null;
  try {
    return matchCacheService.convertDbMatchToApiFormat(row);
  } catch (err) {
    logger.warn(`[WidgetFeed] favorite ${fixtureId} could not be read:`, err);
    return null;
  }
}

export async function buildWidgetFeed(
  teamIds: number[],
  language: string,
  now: number = Date.now(),
  favoriteIds: number[] = [],
): Promise<WidgetFeedPayload> {
  const nowSec = Math.floor(now / 1000);
  const pools = await Promise.all(teamIds.map(async (teamId) => ({ teamId, pool: await loadPool(teamId, language) })));

  const byId = new Map<number, FixtureFromAPI>();
  for (const { pool } of pools) {
    for (const fixture of poolFixtures(pool, nowSec)) byId.set(fixture.fixture.id, fixture);
  }

  const teams: WidgetTeam[] = [];
  for (const { teamId, pool } of pools) {
    if (!pool) {
      teams.push({ teamId, name: '', logo: null, match: null });
      continue;
    }
    const picked = pickNearestFixture(pool, nowSec);
    const match = picked ? toWidgetMatch(await overlayLiveState(picked, nowSec)) : null;
    const side = match ? sideOf(match, teamId) : null;
    teams.push({ teamId, name: side?.name ?? '', logo: side?.logo ?? null, match });
  }

  // Two followed teams playing each other would otherwise show the same match twice.
  const seenFixtures = new Set<number>();
  const unique = teams.filter((team) => {
    if (!team.match) return true;
    if (seenFixtures.has(team.match.fixtureId)) return false;
    seenFixtures.add(team.match.fixtureId);
    return true;
  });
  unique.sort(compareTeams);

  const favorites: WidgetMatch[] = [];
  for (const fixtureId of favoriteIds) {
    const known = byId.get(fixtureId) ?? (await fixtureFromStore(fixtureId));
    if (!known) continue;
    favorites.push(toWidgetMatch(await overlayLiveState(known, nowSec)));
  }

  const followedMatches: WidgetMatch[] = [];
  const seenFollowed = new Set<number>();
  for (const fixture of byId.values()) {
    if (seenFollowed.has(fixture.fixture.id)) continue;
    seenFollowed.add(fixture.fixture.id);
    followedMatches.push(toWidgetMatch(await overlayLiveState(fixture, nowSec)));
  }

  const { primary, reason } = choosePrimary(favorites, followedMatches, nowSec);
  const showFeatured = primary != null && (isLiveStatus(primary.status) || primary.status === 'ft');
  const featured = showFeatured ? await buildFeatured(primary, language) : null;
  const hasLive =
    (primary != null && isLiveStatus(primary.status)) || followedMatches.some((match) => isLiveStatus(match.status));

  return {
    generatedAt: now,
    hasLive,
    teams: unique,
    primary,
    primaryReason: reason,
    fixtures: listFixtures(followedMatches, teamIds, primary, nowSec),
    featured,
  };
}
