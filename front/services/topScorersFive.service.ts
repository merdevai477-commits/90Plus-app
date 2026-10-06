/**
 * Top Scorers Five ("خماسي الهدافين") API client.
 */

import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl(); // Already includes /api

export type TsfApiLeague = 'pl' | 'laliga' | 'bundesliga' | 'seriea' | 'ligue1';

/** Leagues whose pool and scoring come from the backend; the rest stay placeholder. */
export const TSF_LIVE_LEAGUES: readonly TsfApiLeague[] = ['laliga'];

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
}

export interface TsfApiGameweek {
  id: string;
  weekKey: string;
  startAt: string;
  endAt: string;
  lockAt: string;
  status: 'OPEN' | 'LOCKED' | 'LIVE' | 'CALCULATING' | 'COMPLETED';
  locked: boolean;
}

export interface TsfApiSelection {
  leagueKey: string;
  gameweek: TsfApiGameweek;
  selection: null | {
    player: TsfApiPlayer;
    score: {
      goals: number;
      assists: number;
      points: number;
      fixtures: { fixtureId: number; fixtureDate: string; goals: number; assists: number; points: number }[];
    };
    updatedAt: string;
  };
}

export interface TsfApiFixture {
  fixtureId: number;
  kickoff: string;
  status: string;
  home: { id: number; name: string; logo: string | null };
  away: { id: number; name: string; logo: string | null };
}

export interface TsfApiLeaderboard {
  period: 'week' | 'all';
  entries: {
    rank: number;
    userId: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    xp: number;
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
  getPlayers: (league: TsfApiLeague, lang: string) =>
    request<TsfApiPlayer[]>(`/leagues/${league}/players?lang=${lang}`),

  getSelection: (token: string, league: TsfApiLeague, lang: string) =>
    request<TsfApiSelection>(`/leagues/${league}/selection?lang=${lang}`, { token }),

  saveSelection: (token: string, league: TsfApiLeague, playerId: string, lang: string) =>
    request<TsfApiSelection>(`/leagues/${league}/selection?lang=${lang}`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ playerId }),
    }),

  clearSelection: (token: string, league: TsfApiLeague) =>
    request<null>(`/leagues/${league}/selection`, { token, method: 'DELETE' }),

  getPlayerFixtures: (playerId: string) =>
    request<TsfApiFixture[]>(`/players/${encodeURIComponent(playerId)}/fixtures`),

  getLeaderboard: (token: string, period: 'week' | 'all', limit = 50) =>
    request<TsfApiLeaderboard>(`/leaderboard?period=${period}&limit=${limit}`, { token }),
};
