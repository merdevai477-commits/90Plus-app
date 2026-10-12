/**
 * Compact feed for the home-screen widgets (iOS WidgetKit + Android AppWidget).
 * The native widgets fetch this on their own, so the shape stays flat and stable.
 */

import { footballDataCacheService } from './football-data-cache.service';
import { readLiveFixtureById } from './live-fixture-cache.service';
import type { FixtureFromAPI } from './match-cache.service';
import { logger } from '../utils/logger';

export const WIDGET_MAX_TEAMS = 8;
const TOP_PLAYERS = 3;
const MOMENTUM_BUCKETS = 12;
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

export interface WidgetFeatured {
  fixtureId: number;
  topPlayers: WidgetTopPlayer[];
  momentum: Array<{ minute: number; home: number; away: number }>;
}

export interface WidgetFeedPayload {
  generatedAt: number;
  hasLive: boolean;
  teams: WidgetTeam[];
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

async function buildFeatured(match: WidgetMatch, language: string): Promise<WidgetFeatured> {
  const [lineups, momentum] = await Promise.all([
    footballDataCacheService.getMatchLineups(match.fixtureId, { language }).catch(() => []),
    footballDataCacheService.getMatchMomentum(match.fixtureId, { language }).catch(() => null),
  ]);
  return {
    fixtureId: match.fixtureId,
    topPlayers: pickTopPlayers(lineups, match.home.id),
    momentum: momentum?.available ? compressMomentum(momentum.series) : [],
  };
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

export async function buildWidgetFeed(
  teamIds: number[],
  language: string,
  now: number = Date.now(),
): Promise<WidgetFeedPayload> {
  const nowSec = Math.floor(now / 1000);

  const teams = await Promise.all(teamIds.map((teamId) => resolveTeamMatch(teamId, language, nowSec)));

  // Two followed teams playing each other would otherwise show the same match twice.
  const seenFixtures = new Set<number>();
  const unique = teams.filter((t) => {
    if (!t.match) return true;
    if (seenFixtures.has(t.match.fixtureId)) return false;
    seenFixtures.add(t.match.fixtureId);
    return true;
  });
  unique.sort(compareTeams);

  const liveMatch = unique.find((t) => t.match?.status === 'live' || t.match?.status === 'ht')?.match;
  const featured = liveMatch ? await buildFeatured(liveMatch, language) : null;

  return { generatedAt: now, hasLive: Boolean(liveMatch), teams: unique, featured };
}
