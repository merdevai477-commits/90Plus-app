/**
 * Compact feed for the home-screen widgets (iOS WidgetKit + Android AppWidget).
 * The native widgets fetch this on their own, so the shape stays flat and stable.
 */

import prisma from '../lib/prisma';
import { footballDataCacheService } from './football-data-cache.service';
import { readLiveFixtureById } from './live-fixture-cache.service';
import { matchCacheService, type FixtureFromAPI } from './match-cache.service';
import { resolveVenueImage } from './stadium-image.service';
import { logger } from '../utils/logger';

export const WIDGET_MAX_TEAMS = 8;
const TOP_PLAYERS = 3;
const MOMENTUM_BUCKETS = 12;
const FIXTURE_LIST_CAP = 6;
/** Enough for every scorer of a lopsided game; the widget trims rows to the space it has. */
const WIDGET_EVENT_LIMIT = 10;
const FEATURED_SIDE_BUDGET_MS = 2_000;
/** Match minutes a goal stays the widget's lead page. */
const GOAL_FLASH_MINUTES = 3;
const FORM_GAMES = 5;
const H2H_MEETINGS = 3;
/** Venue, table and form barely move during a match; a partial answer is retried sooner. */
const MATCH_INFO_TTL_MS = 15 * 60 * 1000;
const MATCH_INFO_RETRY_MS = 2 * 60 * 1000;
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

export type WidgetEventKind = 'goal' | 'penalty' | 'own_goal' | 'red' | 'yellow';

export interface WidgetEvent {
  minute: number;
  extra: number | null;
  kind: WidgetEventKind;
  side: 'home' | 'away';
  player: string;
}

export type WidgetFormResult = 'W' | 'D' | 'L';

export interface WidgetTeamInfo {
  rank: number | null;
  points: number | null;
  played: number | null;
  /** Last finished games, oldest first. */
  form: WidgetFormResult[];
}

/** Goals are oriented to this fixture: `homeGoals` belong to today's home side. */
export interface WidgetMeeting {
  ts: number;
  homeGoals: number;
  awayGoals: number;
}

export interface WidgetMatchInfo {
  venue: string | null;
  city: string | null;
  venueImage: string | null;
  referee: string | null;
  home: WidgetTeamInfo;
  away: WidgetTeamInfo;
  h2h: { homeWins: number; draws: number; awayWins: number; meetings: WidgetMeeting[] } | null;
}

/** The latest goal while it is still news, so the widget can lead with it. */
export interface WidgetGoal {
  minute: number;
  extra: number | null;
  kind: 'goal' | 'penalty' | 'own_goal';
  side: 'home' | 'away';
  player: string;
  photo: string | null;
}

export interface WidgetFeatured {
  fixtureId: number;
  topPlayers: WidgetTopPlayer[];
  momentum: Array<{ minute: number; home: number; away: number }>;
  lineup: WidgetLineup | null;
  stats: WidgetStats | null;
  /** Goals and red cards always; yellow cards only fill spare rows. Chronological. */
  events: WidgetEvent[];
  goal: WidgetGoal | null;
  info: WidgetMatchInfo | null;
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

function eventKind(event: any): WidgetEventKind | null {
  const type = String(event?.type ?? '');
  const detail = String(event?.detail ?? '');
  if (type === 'Goal') {
    if (/missed/i.test(detail)) return null;
    if (/own/i.test(detail)) return 'own_goal';
    if (/penalty/i.test(detail)) return 'penalty';
    return 'goal';
  }
  if (type === 'Card') {
    if (/red|second yellow/i.test(detail)) return 'red';
    if (/yellow/i.test(detail)) return 'yellow';
  }
  return null;
}

export function pickKeyEvents(events: any[], match: WidgetMatch, limit = WIDGET_EVENT_LIMIT): WidgetEvent[] {
  const all: WidgetEvent[] = [];
  for (const event of events ?? []) {
    const kind = eventKind(event);
    const minute = Number(event?.time?.elapsed);
    if (!kind || !Number.isFinite(minute)) continue;
    const teamId = event?.team?.id;
    if (teamId !== match.home.id && teamId !== match.away.id) continue;
    const extra = Number(event?.time?.extra);
    all.push({
      minute,
      extra: Number.isFinite(extra) && extra > 0 ? extra : null,
      kind,
      side: teamId === match.home.id ? 'home' : 'away',
      player: String(event?.player?.name ?? '').trim(),
    });
  }
  const order = (e: WidgetEvent) => e.minute * 100 + (e.extra ?? 0);
  const key = all.filter((e) => e.kind !== 'yellow').sort((a, b) => order(a) - order(b)).slice(-limit);
  const spare = limit - key.length;
  const yellows = spare > 0 ? all.filter((e) => e.kind === 'yellow').sort((a, b) => order(a) - order(b)).slice(-spare) : [];
  return [...key, ...yellows].sort((a, b) => order(a) - order(b));
}

/**
 * Upstream detail feeds can go empty for a while (often right at full time). Without this the
 * widget would drop its scorers and detail pages exactly when the result matters most.
 */
const lastFeatured = new Map<string, { at: number; featured: WidgetFeatured }>();
const FEATURED_MEMORY_MS = 4 * 60 * 60 * 1000;
const FEATURED_MEMORY_CAP = 300;

export function clearFeaturedMemory(): void {
  lastFeatured.clear();
}

export function keepLastFeatured(featured: WidgetFeatured, language: string, nowMs = Date.now()): WidgetFeatured {
  const key = `${featured.fixtureId}:${language}`;
  const remembered = lastFeatured.get(key);
  const previous = remembered && nowMs - remembered.at < FEATURED_MEMORY_MS ? remembered.featured : null;
  const merged: WidgetFeatured = previous
    ? {
        ...featured,
        topPlayers: featured.topPlayers.length ? featured.topPlayers : previous.topPlayers,
        momentum: featured.momentum.length ? featured.momentum : previous.momentum,
        lineup: featured.lineup ?? previous.lineup,
        stats: featured.stats ?? previous.stats,
        events: featured.events.length ? featured.events : previous.events,
        info: featured.info ?? previous.info,
      }
    : featured;
  lastFeatured.delete(key);
  lastFeatured.set(key, { at: nowMs, featured: merged });
  if (lastFeatured.size > FEATURED_MEMORY_CAP) {
    const oldest = lastFeatured.keys().next().value;
    if (oldest !== undefined) lastFeatured.delete(oldest);
  }
  return merged;
}

/**
 * Event player ids are 365 member ids, not athlete ids, so the photo comes from the lineup
 * entry with the same member id (name match as a fallback).
 */
function scorerPhoto(event: any, lineups: any[]): string | null {
  const memberId = event?.player?.id;
  const name = String(event?.player?.name ?? '').trim().toLowerCase();
  for (const lineup of lineups ?? []) {
    for (const item of [...(lineup?.startXI ?? []), ...(lineup?.substitutes ?? [])]) {
      const p = item?.player ?? {};
      const sameMember = memberId != null && (p.scores365MemberId === memberId || p.id === memberId);
      const sameName = name !== '' && String(p.name ?? '').trim().toLowerCase() === name;
      if ((sameMember || sameName) && p.photo) return String(p.photo);
    }
  }
  return null;
}

export function pickRecentGoal(events: any[], lineups: any[], match: WidgetMatch): WidgetGoal | null {
  if (match.status !== 'live' || match.elapsed == null) return null;
  let latest: { event: any; kind: WidgetGoal['kind']; minute: number; extra: number } | null = null;
  for (const event of events ?? []) {
    const kind = eventKind(event);
    if (kind !== 'goal' && kind !== 'penalty' && kind !== 'own_goal') continue;
    const teamId = event?.team?.id;
    if (teamId !== match.home.id && teamId !== match.away.id) continue;
    const minute = Number(event?.time?.elapsed);
    if (!Number.isFinite(minute)) continue;
    const extra = Number(event?.time?.extra) > 0 ? Number(event.time.extra) : 0;
    if (!latest || minute * 100 + extra >= latest.minute * 100 + latest.extra) latest = { event, kind, minute, extra };
  }
  if (!latest) return null;
  const clock = match.elapsed + (match.extra ?? 0);
  if (clock - (latest.minute + latest.extra) > GOAL_FLASH_MINUTES) return null;
  return {
    minute: latest.minute,
    extra: latest.extra || null,
    kind: latest.kind,
    side: latest.event.team.id === match.home.id ? 'home' : 'away',
    player: String(latest.event?.player?.name ?? '').trim(),
    photo: scorerPhoto(latest.event, lineups),
  };
}

function gameTs(game: any): number {
  const ms = Date.parse(String(game?.startTime ?? ''));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/** Finished 365 games before this fixture, newest first. */
function finishedBefore(games: any[], match: WidgetMatch): any[] {
  return (games ?? [])
    .filter((game) => {
      if (Number(game?.id) === match.fixtureId) return false;
      const home = Number(game?.homeCompetitor?.score);
      const away = Number(game?.awayCompetitor?.score);
      const ts = gameTs(game);
      return home >= 0 && away >= 0 && ts > 0 && ts < match.kickoffTs;
    })
    .sort((a, b) => gameTs(b) - gameTs(a));
}

export function pickForm(games: any[], teamId: number, match: WidgetMatch): WidgetFormResult[] {
  return finishedBefore(games, match)
    .slice(0, FORM_GAMES)
    .reverse()
    .map((game) => {
      const home = Number(game.homeCompetitor.score);
      const away = Number(game.awayCompetitor.score);
      const mine = game.homeCompetitor?.id === teamId ? home : away;
      const theirs = game.homeCompetitor?.id === teamId ? away : home;
      return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
    });
}

export function pickHeadToHead(meetings: any[], match: WidgetMatch): WidgetMatchInfo['h2h'] {
  const games = finishedBefore(meetings, match).filter((game) => {
    const ids = [game.homeCompetitor?.id, game.awayCompetitor?.id];
    return ids.includes(match.home.id) && ids.includes(match.away.id);
  });
  if (games.length === 0) return null;
  const oriented = games.map((game) => {
    const flipped = game.homeCompetitor.id !== match.home.id;
    const home = Number(game.homeCompetitor.score);
    const away = Number(game.awayCompetitor.score);
    return { ts: gameTs(game), homeGoals: flipped ? away : home, awayGoals: flipped ? home : away };
  });
  return {
    homeWins: oriented.filter((m) => m.homeGoals > m.awayGoals).length,
    draws: oriented.filter((m) => m.homeGoals === m.awayGoals).length,
    awayWins: oriented.filter((m) => m.homeGoals < m.awayGoals).length,
    meetings: oriented.slice(0, H2H_MEETINGS),
  };
}

function tableEntry(rows: any[], teamId: number): Pick<WidgetTeamInfo, 'rank' | 'points' | 'played'> {
  const row = (rows ?? []).find((r) => r?.team?.id === teamId);
  const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : null);
  return { rank: num(row?.rank), points: num(row?.points), played: num(row?.all?.played) };
}

/** Upstream venue names arrive HTML-escaped ("T&#252;rk Telekom Arena"). */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Wikipedia hands back 3840px originals; the widget only needs a card-sized thumbnail. */
export function widgetImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/\/\d+px-([^/?]+)/, '/960px-$1');
}

const matchInfoCache = new Map<string, { expires: number; info: WidgetMatchInfo }>();

export function clearMatchInfoCache(): void {
  matchInfoCache.clear();
}

async function buildMatchInfo(match: WidgetMatch, language: string): Promise<WidgetMatchInfo | null> {
  const key = `${match.fixtureId}:${language}`;
  const cached = matchInfoCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.info;

  const [bundle, form] = await Promise.all([
    withBudget(footballDataCacheService.getFixtureDetailsBundle(match.fixtureId, { language }).catch(() => null), null),
    withBudget(footballDataCacheService.getCached365FixtureForm(match.fixtureId, language).catch(() => null), null),
  ]);
  const fixture = bundle?.fixture ?? null;
  const venueRaw = bundle?.venue ?? fixture?.fixture?.venue ?? null;
  const venue = venueRaw?.name ? decodeEntities(String(venueRaw.name)).trim() : null;
  const season = Number(fixture?.league?.season) || new Date(match.kickoffTs * 1000).getUTCFullYear();

  const [table, image] = await Promise.all([
    withBudget(
      footballDataCacheService.getStandingsParsed(match.league.id, season, language).catch(() => null),
      null,
    ),
    venueRaw?.image
      ? Promise.resolve(String(venueRaw.image))
      : withBudget(
          resolveVenueImage({ venueId: venueRaw?.id ?? null, venueName: venue, fast: true })
            .then((lookup) => (lookup.isPlaceholder ? null : lookup.imageUrl))
            .catch(() => null),
          null,
        ),
  ]);

  const data = form?.data ?? null;
  const info: WidgetMatchInfo = {
    venue,
    city: venueRaw?.city ? decodeEntities(String(venueRaw.city)) : null,
    venueImage: widgetImageUrl(image),
    referee: fixture?.fixture?.referee ? decodeEntities(String(fixture.fixture.referee)).trim() || null : null,
    home: { ...tableEntry(table?.flat ?? [], match.home.id), form: pickForm(data?.home?.recentGames ?? [], match.home.id, match) },
    away: { ...tableEntry(table?.flat ?? [], match.away.id), form: pickForm(data?.away?.recentGames ?? [], match.away.id, match) },
    h2h: pickHeadToHead(data?.meetings ?? [], match),
  };
  const hasAnything =
    info.venue || info.referee || info.home.rank != null || info.home.form.length > 0 || info.h2h != null;
  if (!hasAnything) return null;
  const complete = info.venue != null && info.home.form.length > 0 && info.home.rank != null;
  matchInfoCache.set(key, { expires: Date.now() + (complete ? MATCH_INFO_TTL_MS : MATCH_INFO_RETRY_MS), info });
  if (matchInfoCache.size > FEATURED_MEMORY_CAP) {
    const oldest = matchInfoCache.keys().next().value;
    if (oldest !== undefined) matchInfoCache.delete(oldest);
  }
  return info;
}

/** Before kick-off only the venue, table, form and head-to-head exist. */
async function buildPreview(match: WidgetMatch, language: string): Promise<WidgetFeatured | null> {
  const info = await buildMatchInfo(match, language);
  if (!info) return null;
  return { fixtureId: match.fixtureId, topPlayers: [], momentum: [], lineup: null, stats: null, events: [], goal: null, info };
}

async function buildFeatured(match: WidgetMatch, language: string): Promise<WidgetFeatured> {
  const [lineups, momentum, statistics, events, info] = await Promise.all([
    footballDataCacheService.getMatchLineups(match.fixtureId, { language }).catch(() => []),
    footballDataCacheService.getMatchMomentum(match.fixtureId, { language }).catch(() => null),
    withBudget(
      footballDataCacheService.getMatchStatistics(match.fixtureId, { language }).catch(() => []),
      [],
    ),
    withBudget(
      footballDataCacheService.getMatchEvents(match.fixtureId, { language }).catch(() => []),
      [],
    ),
    buildMatchInfo(match, language).catch(() => null),
  ]);
  return keepLastFeatured(
    {
      fixtureId: match.fixtureId,
      topPlayers: pickTopPlayers(lineups, match.home.id),
      momentum: momentum?.available ? compressMomentum(momentum.series) : [],
      lineup: pickOfficialLineup(lineups, match.home.id),
      stats: pickWidgetStats(statistics, match.home.id),
      events: pickKeyEvents(events, match),
      goal: pickRecentGoal(events, lineups, match),
      info,
    },
    language,
  );
}

function isLiveStatus(status: WidgetMatchStatus): boolean {
  return status === 'live' || status === 'ht';
}

function byKickoff(a: WidgetMatch, b: WidgetMatch): number {
  if (a.kickoffTs !== b.kickoffTs) return a.kickoffTs - b.kickoffTs;
  return a.fixtureId - b.fixtureId;
}

/**
 * A live match always leads: live favorite, then a live followed-team match.
 * With nothing live, a favorite (upcoming, else most recently finished) leads.
 * A followed-team finish within the recent window is only used when nothing is upcoming.
 */
export function choosePrimary(
  favorites: WidgetMatch[],
  followed: WidgetMatch[],
  nowSec: number,
): { primary: WidgetMatch | null; reason: WidgetPrimaryReason } {
  const favoriteLive = favorites.filter((match) => isLiveStatus(match.status)).sort(byKickoff)[0];
  if (favoriteLive) return { primary: favoriteLive, reason: 'favorite' };
  const followedLive = followed.filter((match) => isLiveStatus(match.status)).sort(byKickoff)[0];
  if (followedLive) return { primary: followedLive, reason: 'live' };
  const favoriteUpcoming = favorites.filter((match) => match.status === 'upcoming').sort(byKickoff)[0];
  if (favoriteUpcoming) return { primary: favoriteUpcoming, reason: 'favorite' };
  const favoriteDone = [...favorites]
    .filter((match) => match.status === 'ft' || match.status === 'off')
    .sort((a, b) => b.kickoffTs - a.kickoffTs || a.fixtureId - b.fixtureId)[0];
  if (favoriteDone) return { primary: favoriteDone, reason: 'favorite' };

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
  const featured = showFeatured
    ? await buildFeatured(primary, language)
    : primary?.status === 'upcoming'
      ? await buildPreview(primary, language).catch(() => null)
      : null;
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
