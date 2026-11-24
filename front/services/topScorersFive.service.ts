/**
 * Top Scorers Five ("خماسي الهدافين") API client.
 */

import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl(); // Already includes /api

export type TsfApiTournament = 'europe' | 'egypt';

export type TsfApiEuropeLeague = 'pl' | 'laliga' | 'bundesliga' | 'seriea' | 'ligue1';
export type TsfApiEgyptSlot = 'egypt1' | 'egypt2' | 'egypt3' | 'egypt4' | 'egypt5';
export type TsfApiLeague = TsfApiEuropeLeague | TsfApiEgyptSlot;
export type TsfCompetitionKey = 'egypt' | TsfApiEuropeLeague;

export const TSF_COMPETITIONS: readonly TsfCompetitionKey[] = [
  'egypt',
  'pl',
  'laliga',
  'seriea',
  'bundesliga',
  'ligue1',
];

export function tsfSlotKey(competition: TsfCompetitionKey, index: number): string {
  return `${competition}${index}`;
}

/** Europe: one pick per big-five league. */
export const TSF_EUROPE_LIVE_LEAGUES: readonly TsfApiEuropeLeague[] = [
  'pl',
  'laliga',
  'seriea',
  'bundesliga',
  'ligue1',
];

/** Egypt: five slots that share the Egyptian Premier attackers pool. */
export const TSF_EGYPT_LIVE_SLOTS: readonly TsfApiEgyptSlot[] = [
  'egypt1',
  'egypt2',
  'egypt3',
  'egypt4',
  'egypt5',
];

/** @deprecated Prefer tournament-scoped lists. */
export const TSF_LIVE_LEAGUES: readonly TsfApiLeague[] = TSF_EUROPE_LIVE_LEAGUES;

export function tsfLiveLeaguesFor(tournament: TsfApiTournament): readonly TsfApiLeague[] {
  return tournament === 'egypt' ? TSF_EGYPT_LIVE_SLOTS : TSF_EUROPE_LIVE_LEAGUES;
}

export interface TsfApiPlayer {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string | null;
  club: string;
  teamId: number | null;
  teamLogo: string | null;
  photo: string | null;
  position: string | null;
  externalPlayerId: number | null;
  goals: number;
  assists: number;
  points: number;
  seasonGoals: number;
  seasonAssists: number;
  /** Finished, Live, Upcoming, or Postponed. Never hides the player. */
  fixtureStatus?: 'FINISHED' | 'LIVE' | 'UPCOMING' | 'POSTPONED' | null;
}

export interface TsfApiGameweek {
  id: string;
  weekKey: string;
  /** ISO week number for the Tuesday window — "الجولة N". */
  round?: number;
  startAt: string;
  endAt: string;
  /** One hour after `endAt` — when the formation reopens. */
  reopenAt?: string;
  lockAt: string;
  status: 'OPEN' | 'LOCKED' | 'LIVE' | 'CALCULATING' | 'COMPLETED';
  locked: boolean;
}

export type TsfPickState = 'PICKING' | 'CONFIRMED' | 'WAITING_FOR_MATCHES' | 'CALCULATING' | 'COMPLETED';

export type TsfParticipation = 'STARTED' | 'SUBBED_ON' | 'BENCH' | 'UNAVAILABLE' | 'NOT_IN_SQUAD' | 'UNKNOWN';

export interface TsfApiSquadLock {
  scopeKey: string;
  locked: boolean;
  unlocksAt: string | null;
  confirmedAt: string | null;
  dirty: boolean;
  readyToEdit: boolean;
}

export interface TsfApiLineup {
  leagueKey: TsfCompetitionKey;
  gameweek: TsfApiGameweek;
  points: number;
  slots: {
    slotKey: string;
    locked: boolean;
    lockedUntil: string | null;
    player: TsfApiPlayer | null;
    score: { goals: number; assists: number; points: number };
  }[];
}

export interface TsfApiSelection {
  leagueKey: string;
  gameweek: TsfApiGameweek;
  state: TsfPickState;
  squad?: TsfApiSquadLock;
  selection: null | {
    player: TsfApiPlayer;
    score: {
      goals: number;
      assists: number;
      points: number;
      fixtures: { fixtureId: number; fixtureDate: string; goals: number; assists: number; points: number }[];
    };
    /** Confirmed picks are final for the gameweek. */
    confirmed: boolean;
    confirmedAt: string | null;
    /** Cannot be changed or removed any more (confirmed, or the gameweek has started). */
    locked: boolean;
    updatedAt: string;
  };
}

export interface TsfApiFixture {
  fixtureId: number;
  kickoff: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  elapsed?: number | null;
  home: { id: number; name: string; logo: string | null };
  away: { id: number; name: string; logo: string | null };
}

export interface TsfApiMyFixture extends TsfApiFixture {
  leagueKey: TsfApiLeague;
  season: number | null;
  finished: boolean;
  /** Stats stored — the player lines are final. */
  processed: boolean;
  players: {
    playerId: string;
    name: string;
    photo: string | null;
    teamId: number | null;
    participation: TsfParticipation | null;
    goals: number | null;
    assists: number | null;
    points: number | null;
  }[];
}

export interface TsfApiMyFixtures {
  state: TsfPickState;
  leagues: { leagueKey: TsfApiLeague; state: TsfPickState; gameweek: TsfApiGameweek; playerId: string | null }[];
  fixtures: TsfApiMyFixture[];
}

export interface TsfApiLeaderboard {
  period: 'week' | 'all';
  entries: {
    rank: number;
    userId: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    isVerified?: boolean;
    isDeveloper?: boolean;
    xp: number;
    identity?: {
      isVerified: boolean;
      isDeveloper: boolean;
      badge: { key: string; title: string; accent: string; nameAr: string; nameEn: string } | null;
    };
  }[];
  me: { rank: number | null; xp: number; userId: string } | null;
}

export class TsfApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly reason: string | null,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TsfApiError';
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const response = await fetch(`${API_URL}/top-scorers-five${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new TsfApiError(
      body?.error ?? 'E010',
      body?.details?.reason ?? null,
      body?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }
  return (body?.data ?? null) as T;
}

export const topScorersFiveService = {
  getPlayers: (league: string, lang: string) =>
    request<TsfApiPlayer[]>(`/leagues/${league}/players?lang=${lang}`),

  getLineup: (token: string, league: string, lang: string) =>
    request<TsfApiLineup>(`/leagues/${league}/lineup?lang=${lang}`, { token }),

  getSelection: (token: string, league: string, lang: string) =>
    request<TsfApiSelection>(`/leagues/${league}/selection?lang=${lang}`, { token }),

  /** Confirms the pick — final for the gameweek (GAMEWEEK_PICK_LOCKED afterwards). */
  saveSelection: (token: string, league: string, playerId: string, lang: string) =>
    request<TsfApiSelection>(`/leagues/${league}/selection?lang=${lang}`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ playerId }),
    }),

  clearSelection: (token: string, league: string) =>
    request<null>(`/leagues/${league}/selection`, { token, method: 'DELETE' }),

  getUpcoming: (league: string, lang: string) =>
    request<{ fixtures: TsfApiFixture[] }>(`/leagues/${league}/fixtures/upcoming?lang=${lang}`),

  /** Egypt: commit the draft and start the 7-day lock. Europe confirms on save. */
  confirmSquad: (token: string, leagueKey: string, lang: string) =>
    request<TsfApiSelection>(`/squad/confirm?lang=${lang}`, {
      token,
      method: 'POST',
      body: JSON.stringify({ leagueKey }),
    }),

  getPlayerFixtures: (playerId: string, lang: string) =>
    request<TsfApiFixture[]>(`/players/${encodeURIComponent(playerId)}/fixtures?lang=${lang}`),

  /** Only the fixtures of my picked players this gameweek, with results once stored. */
  getMyFixtures: (
    token: string,
    lang: string,
    tournament: TsfApiTournament = 'europe',
    leagueKey?: string,
  ) =>
    request<TsfApiMyFixtures>(
      `/me/fixtures?lang=${lang}&tournament=${tournament}${leagueKey ? `&leagueKey=${leagueKey}` : ''}`,
      { token },
    ),

  getScore: (token: string, tournament: TsfApiTournament = 'europe') =>
    request<{ total: number; week: number; leagues: { leagueKey: string; total: number; week: number }[] }>(
      `/me/score?tournament=${tournament}`,
      { token },
    ),

  getLeaderboard: (
    token: string,
    period: 'week' | 'all',
    limit = 50,
    tournament: TsfApiTournament = 'europe',
    leagueKey?: string,
    allLeagues = false,
  ) =>
    request<TsfApiLeaderboard>(
      `/leaderboard?period=${period}&limit=${limit}&tournament=${tournament}${leagueKey ? `&leagueKey=${leagueKey}` : ''}${allLeagues ? '&all=1' : ''}`,
      { token },
    ),
};
