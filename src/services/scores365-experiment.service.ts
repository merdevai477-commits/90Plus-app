/**
 * 365Scores live experiment — single-match feed for all users.
 * Maps webws.365scores.com game payload → API-Football shapes the app already consumes.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { matchCacheService } from './match-cache.service';
import type { FixtureFromAPI } from './match-cache.service';

const SCORES365_BASE = 'https://webws.365scores.com/web/game/';

interface Scores365GamePayload {
  ttl?: number;
  game?: Scores365Game;
}

interface Scores365Game {
  id: number;
  sportId: number;
  competitionId: number;
  statusId: number;
  statusGroup: number;
  statusText?: string;
  shortStatusText?: string;
  startTime?: string;
  gameTime?: number;
  gameTimeDisplay?: string;
  competitionDisplayName?: string;
  roundName?: string;
  groupName?: string;
  homeCompetitor?: Scores365Competitor;
  awayCompetitor?: Scores365Competitor;
  events?: Scores365Event[];
  members?: Scores365Member[];
  venue?: { id?: number; name?: string; shortName?: string; capacity?: number };
  hasStats?: boolean;
}

interface Scores365Competitor {
  id: number;
  name: string;
  score?: number;
  lineups?: {
    status?: string;
    formation?: string;
    members?: Scores365LineupMember[];
  };
  color?: string;
  nameForURL?: string;
}

interface Scores365LineupMember {
  id: number;
  status: number;
  statusText?: string;
  competitorId?: number;
  formation?: { shortName?: string };
  yardFormation?: { line?: number; fieldPosition?: number };
}

interface Scores365Member {
  id: number;
  competitorId: number;
  name: string;
  shortName?: string;
  jerseyNumber?: number;
}

interface Scores365Event {
  competitorId: number;
  gameTime?: number;
  gameTimeDisplay?: string;
  playerId?: number;
  isMajor?: boolean;
  eventType?: { id: number; name?: string; subTypeName?: string };
}

export interface Scores365ExperimentConfig {
  enabled: boolean;
  gameId: number;
  fixtureId: number;
  leagueId: number;
  season: number;
}

let cachedGame: { fetchedAt: number; game: Scores365Game | null } | null = null;

export function isScores365ExperimentEnabled(): boolean {
  const raw = process.env.SCORES365_EXPERIMENT_ENABLED?.trim();
  return raw === 'true' || raw === '1';
}

export function getScores365ExperimentConfig(): Scores365ExperimentConfig {
  return {
    enabled: isScores365ExperimentEnabled(),
    gameId: parseInt(process.env.SCORES365_EXPERIMENT_GAME_ID || '4627937', 10),
    fixtureId: parseInt(process.env.SCORES365_EXPERIMENT_FIXTURE_ID || '1489387', 10),
    leagueId: parseInt(process.env.WORLD_CUP_LEAGUE_ID || '1', 10),
    season: parseInt(process.env.WORLD_CUP_SEASON || '2026', 10),
  };
}

export function isScores365ExperimentFixture(fixtureId: number): boolean {
  if (!isScores365ExperimentEnabled()) return false;
  return fixtureId === getScores365ExperimentConfig().fixtureId;
}

function scores365Url(gameId: number): string {
  const tz = encodeURIComponent(process.env.SCORES365_TIMEZONE || 'Africa/Cairo');
  const langId = process.env.SCORES365_LANG_ID || '27';
  const countryId = process.env.SCORES365_USER_COUNTRY_ID || '131';
  return `${SCORES365_BASE}?appTypeId=5&langId=${langId}&timezoneName=${tz}&userCountryId=${countryId}&gameId=${gameId}`;
}

export async function fetchScores365Game(force = false): Promise<Scores365Game | null> {
  if (!isScores365ExperimentEnabled()) return null;

  const { gameId } = getScores365ExperimentConfig();
  const ttlMs = Math.max(3_000, parseInt(process.env.SCORES365_CACHE_MS || '5000', 10) || 5_000);

  if (!force && cachedGame && Date.now() - cachedGame.fetchedAt < ttlMs) {
    return cachedGame.game;
  }

  try {
    const res = await fetch(scores365Url(gameId), {
      headers: {
        Accept: 'application/json',
        'User-Agent': '90Plus-Scores365-Experiment/1.0',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      logger.warn(`[Scores365Experiment] HTTP ${res.status} for game ${gameId}`);
      return cachedGame?.game ?? null;
    }
    const payload = (await res.json()) as Scores365GamePayload;
    const game = payload?.game ?? null;
    cachedGame = { fetchedAt: Date.now(), game };
    if (game) {
      logger.debug(
        `[Scores365Experiment] game ${gameId}: ${game.homeCompetitor?.name} ${game.homeCompetitor?.score ?? 0}-${game.awayCompetitor?.score ?? 0} ${game.awayCompetitor?.name} (${game.gameTimeDisplay ?? game.statusText})`,
      );
    }
    return game;
  } catch (err: any) {
    logger.warn(`[Scores365Experiment] fetch failed for game ${gameId}:`, err?.message);
    return cachedGame?.game ?? null;
  }
}

function map365Status(game: Scores365Game): { short: string; long: string; elapsed: number | null } {
  const minute = Math.floor(game.gameTime ?? 0) || null;
  const text = (game.statusText ?? '').toLowerCase();
  const shortCode = (game.shortStatusText ?? '').trim();

  if (game.statusGroup !== 3) {
    if (text.includes('انته') || shortCode === 'FT') {
      return { short: 'FT', long: 'Match Finished', elapsed: 90 };
    }
    return { short: 'NS', long: 'Not Started', elapsed: null };
  }

  if (text.includes('استراح') || shortCode === 'HT') {
    return { short: 'HT', long: 'Halftime', elapsed: 45 };
  }
  if (text.includes('الثاني') || shortCode === '2') {
    return { short: '2H', long: 'Second Half', elapsed: minute != null ? Math.max(minute, 46) : 46 };
  }
  return { short: '1H', long: 'First Half', elapsed: minute };
}

function is365Live(game: Scores365Game): boolean {
  return game.statusGroup === 3;
}

function calendarDateFromStart(startTime?: string): string | null {
  if (!startTime) return null;
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadBaseFixture(): Promise<FixtureFromAPI | null> {
  const { fixtureId } = getScores365ExperimentConfig();
  const dbRow = await prisma.cachedFixture.findUnique({ where: { fixtureId } });
  if (dbRow) {
    return matchCacheService.convertDbMatchToApiFormat(dbRow);
  }
  return null;
}

function memberNameLookup(game: Scores365Game): Map<number, Scores365Member> {
  const map = new Map<number, Scores365Member>();
  for (const m of game.members ?? []) {
    map.set(m.id, m);
  }
  return map;
}

function posFrom365(shortName?: string): string | null {
  if (!shortName) return null;
  const s = shortName.toLowerCase();
  if (s.includes('goalkeeper') || s.includes('حارس')) return 'G';
  if (s.includes('back') || s.includes('defender') || s.includes('دفاع') || s.includes('مداف')) return 'D';
  if (s.includes('mid') || s.includes('وسط')) return 'M';
  if (s.includes('forward') || s.includes('attacker') || s.includes('هجوم') || s.includes('مهاج')) return 'F';
  return null;
}

export function mapScores365Events(game: Scores365Game, base: FixtureFromAPI): any[] {
  const home365 = game.homeCompetitor?.id;
  const members = memberNameLookup(game);

  return (game.events ?? []).map((ev) => {
    const isHome = ev.competitorId === home365;
    const team = isHome ? base.teams.home : base.teams.away;
    const player = ev.playerId ? members.get(ev.playerId) : undefined;
    const elapsed = Math.floor(ev.gameTime ?? 0);
    const typeId = ev.eventType?.id;

    let type = 'Var';
    let detail = ev.eventType?.name ?? 'Event';
    if (typeId === 1) {
      type = 'Goal';
      detail = ev.eventType?.subTypeName ?? 'Normal Goal';
    } else if (typeId === 2) {
      type = 'Card';
      detail = 'Yellow Card';
    } else if (typeId === 3) {
      type = 'Card';
      detail = 'Red Card';
    } else if (typeId === 4) {
      type = 'subst';
      detail = 'Substitution 1';
    }

    return {
      time: { elapsed, extra: null },
      team: { id: team.id, name: team.name, logo: team.logo },
      player: {
        id: ev.playerId ?? 0,
        name: player?.shortName || player?.name || '—',
      },
      assist: { id: null, name: null },
      type,
      detail,
      comments: null,
      _source: 'scores365-experiment',
    };
  });
}

export function mapScores365Lineups(game: Scores365Game, base: FixtureFromAPI): any[] {
  const members = memberNameLookup(game);

  const mapSide = (side: Scores365Competitor | undefined, team: FixtureFromAPI['teams']['home']) => {
    if (!side?.lineups?.members?.length) return null;
    const starters = side.lineups.members.filter((m) => m.status === 1);
    return {
      team: { id: team.id, name: team.name, logo: team.logo, colors: null },
      coach: { id: null, name: null, photo: null },
      formation: side.lineups.formation ?? null,
      startXI: starters.map((m) => {
        const meta = members.get(m.id);
        const grid =
          m.yardFormation?.line != null && m.yardFormation?.fieldPosition != null
            ? `${m.yardFormation.line}:${m.yardFormation.fieldPosition}`
            : null;
        return {
          player: {
            id: m.id,
            name: meta?.name ?? meta?.shortName ?? '—',
            number: meta?.jerseyNumber ?? 0,
            pos: posFrom365(m.formation?.shortName),
            grid,
            photo: null,
          },
        };
      }),
      substitutes: side.lineups.members
        .filter((m) => m.status === 2)
        .map((m) => {
          const meta = members.get(m.id);
          return {
            player: {
              id: m.id,
              name: meta?.name ?? meta?.shortName ?? '—',
              number: meta?.jerseyNumber ?? 0,
              pos: posFrom365(m.formation?.shortName),
              grid: null,
              photo: null,
            },
          };
        }),
      _source: 'scores365-experiment',
    };
  };

  const home = mapSide(game.homeCompetitor, base.teams.home);
  const away = mapSide(game.awayCompetitor, base.teams.away);
  return [home, away].filter(Boolean);
}

export async function mapScores365ToApiFootballFixture(
  game: Scores365Game,
  baseInput?: FixtureFromAPI | null,
): Promise<FixtureFromAPI | null> {
  const base = baseInput ?? (await loadBaseFixture());
  if (!base) return null;

  const status = map365Status(game);
  const homeScore = game.homeCompetitor?.score ?? base.goals.home ?? 0;
  const awayScore = game.awayCompetitor?.score ?? base.goals.away ?? 0;
  const kickoff = game.startTime ?? base.fixture.date;

  return {
    ...base,
    fixture: {
      ...base.fixture,
      id: getScores365ExperimentConfig().fixtureId,
      date: kickoff,
      timestamp: Math.floor(new Date(kickoff).getTime() / 1000),
      status: {
        long: status.long,
        short: status.short,
        elapsed: status.elapsed,
      },
      venue: {
        id: game.venue?.id ?? base.fixture.venue?.id ?? null,
        name: game.venue?.name ?? base.fixture.venue?.name ?? null,
        city: base.fixture.venue?.city ?? null,
      },
    },
    goals: {
      home: homeScore,
      away: awayScore,
    },
    teams: {
      home: {
        ...base.teams.home,
        winner:
          status.short === 'FT'
            ? homeScore > awayScore
              ? true
              : homeScore < awayScore
                ? false
                : null
            : null,
      },
      away: {
        ...base.teams.away,
        winner:
          status.short === 'FT'
            ? awayScore > homeScore
              ? true
              : awayScore < homeScore
                ? false
                : null
            : null,
      },
    },
    league: {
      ...base.league,
      round: game.groupName ? `${game.roundName ?? ''} - ${game.groupName}`.trim() : base.league.round,
    },
  };
}

export async function getScores365ExperimentFixture(): Promise<FixtureFromAPI | null> {
  const game = await fetchScores365Game();
  if (!game) return null;
  return mapScores365ToApiFootballFixture(game);
}

export async function getScores365ExperimentBundle(): Promise<{
  fixture: FixtureFromAPI | null;
  lineups: any[];
  statistics: any[];
  events: any[];
  venue: any | null;
  source: 'scores365-experiment';
} | null> {
  const game = await fetchScores365Game();
  if (!game) return null;

  const base = await loadBaseFixture();
  if (!base) return null;

  const fixture = await mapScores365ToApiFootballFixture(game, base);
  if (!fixture) return null;

  return {
    fixture,
    lineups: mapScores365Lineups(game, base),
    events: mapScores365Events(game, base),
    statistics: (base as any).statistics ?? [],
    venue: fixture.fixture.venue ?? null,
    source: 'scores365-experiment',
  };
}

/** Inject / overlay the experiment fixture into a World Cup day list. */
export async function applyScores365ExperimentToWorldCupList(
  matches: any[],
  dateString: string,
): Promise<any[]> {
  if (!isScores365ExperimentEnabled()) return matches;

  const game = await fetchScores365Game();
  if (!game) return matches;

  const fixture = await mapScores365ToApiFootballFixture(game);
  if (!fixture) return matches;

  const matchDate = calendarDateFromStart(game.startTime);
  const todayKey = new Date().toISOString().split('T')[0];
  const live = is365Live(game);
  const shouldShow =
    dateString === matchDate || (live && dateString === todayKey);

  if (!shouldShow) return matches;

  const id = getScores365ExperimentConfig().fixtureId;
  const without = matches.filter((m) => m?.fixture?.id !== id);
  const pinned = [{ ...fixture, _experiment: 'scores365' }, ...without];

  logger.info(
    `[Scores365Experiment] pinned fixture ${id} on ${dateString} (${fixture.teams.home.name} vs ${fixture.teams.away.name}, ${fixture.fixture.status.short} ${fixture.fixture.status.elapsed ?? ''}')`,
  );

  return pinned;
}

export function getScores365ExperimentFeatureState(): {
  enabled: boolean;
  fixtureId: number;
  gameId: number;
  label: string;
} {
  const cfg = getScores365ExperimentConfig();
  return {
    enabled: cfg.enabled,
    fixtureId: cfg.fixtureId,
    gameId: cfg.gameId,
    label: '365Scores Live Experiment',
  };
}
