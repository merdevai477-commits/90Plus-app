/**
 * King of Coaches ("ملك المدربين") API client.
 */

import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl();

export type CkLine = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface CkPlayer {
  id: string;
  name: string;
  club: string;
  teamId: number;
  teamLogo: string | null;
  photo: string | null;
  position: string | null;
  line?: CkLine;
  shirtNumber: number | null;
  priceMilli: number;
  priceLabel: string;
}

export interface CkCoach {
  id: string;
  name: string;
  club: string;
  teamId: number;
  photo: string | null;
  priceMilli: number;
  priceLabel: string;
}

export interface CkHome {
  user: { displayName: string; avatar: string | null; level: number; rank: number | null };
  wallet: {
    balanceMilli: number;
    remainingMilli: number;
    balanceLabel: string;
    remainingLabel: string;
  };
  gameweek: { id: string; status: string; locked: boolean };
  squad: {
    confirmed: boolean;
    spentMilli: number;
    points: number;
    coach: CkCoach | null;
    slots: Array<{ slotKey: string; label: string; player: CkPlayer }>;
  };
}

export interface CkFixture {
  fixtureId: number;
  kickoffAt: string;
  status: string;
  homeName: string;
  awayName: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface CkBoardRow {
  rank: number;
  name: string;
  avatar: string | null;
  points: number;
  isMe: boolean;
}

export class CkApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly reason: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'CkApiError';
  }
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/coach-king${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CkApiError(
      body?.error ?? 'E010',
      body?.details?.reason ?? null,
      body?.message ?? `Request failed (${response.status})`,
    );
  }
  return (body?.data ?? null) as T;
}

export const coachKingService = {
  getHome: (token: string, lang: string) => request<CkHome>(`/me?lang=${lang}`, token),

  getPlayers: (token: string, line: CkLine, lang: string, q = '') =>
    request<CkPlayer[]>(`/players?line=${line}&lang=${lang}&q=${encodeURIComponent(q)}`, token),

  getCoaches: (token: string, lang: string, q = '') =>
    request<CkCoach[]>(`/coaches?lang=${lang}&q=${encodeURIComponent(q)}`, token),

  saveSquad: (
    token: string,
    lang: string,
    body: { coachId: string | null; slots: Array<{ slotKey: string; playerId: string }> },
  ) =>
    request<CkHome>(`/me/squad?lang=${lang}`, token, { method: 'PUT', body: JSON.stringify(body) }),

  confirm: (token: string, lang: string) =>
    request<CkHome>(`/me/squad/confirm?lang=${lang}`, token, { method: 'POST', body: '{}' }),

  getFixtures: (token: string, lang: string) => request<CkFixture[]>(`/me/fixtures?lang=${lang}`, token),

  getLeaderboard: (token: string, period: 'week' | 'all') =>
    request<CkBoardRow[]>(`/leaderboard?period=${period}&limit=50`, token),
};
