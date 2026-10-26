/**
 * King of Coaches ("ملك المدربين") API client.
 */

import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl();

export type CkLine = 'GK' | 'DEF' | 'MID' | 'FWD';
export type CkPoolKind = CkLine | 'COACH';

export interface CkPlayer {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string | null;
  club: string;
  teamId: number;
  teamLogo: string | null;
  photo: string | null;
  position: string | null;
  line?: CkLine;
  shirtNumber: number | null;
  priceMilli: number;
  priceLabel: string;
  externalPlayerId?: number;
}

export interface CkCoach {
  id: string;
  name: string;
  club: string;
  teamId: number;
  teamLogo?: string | null;
  photo: string | null;
  priceMilli: number;
  priceLabel: string;
}

export interface CkSquadSlot {
  slotKey: string;
  label: string;
  locked: boolean;
  pricePaidMilli: number;
  points: number;
  player: CkPlayer;
}

export interface CkSquadCoach extends CkCoach {
  locked: boolean;
  pricePaidMilli: number;
  points: number;
}

export interface CkSquad {
  confirmed: boolean;
  spentMilli: number;
  points: number;
  lockedUntil?: string;
  coach: CkSquadCoach | null;
  slots: CkSquadSlot[];
}

export interface CkHome {
  user: {
    id?: string;
    username?: string;
    displayName: string;
    avatar: string | null;
    level: number;
    rank: number | null;
  };
  wallet: {
    balanceMilli: number;
    remainingMilli: number;
    balanceLabel: string;
    remainingLabel: string;
  };
  gameweek: { id: string; status: string; locked: boolean; endAt?: string };
  squad: CkSquad;
}

export interface CkUserSquad {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    level: number;
    rank: number | null;
    points: number;
    weekPoints: number;
  };
  gameweek: { id: string; weekKey: string; current: boolean } | null;
  squad: CkSquad | null;
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
  userId: string;
  username: string;
  name: string;
  avatar: string | null;
  level: number;
  points: number;
  weekPoints: number;
  totalPoints: number;
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

const POOL_TTL_MS = 5 * 60_000;
type PoolEntry = { at: number; rows: Promise<Array<CkPlayer | CkCoach>> };
const pools = new Map<string, PoolEntry>();

function loadPool(token: string, kind: CkPoolKind, lang: string): Promise<Array<CkPlayer | CkCoach>> {
  return kind === 'COACH'
    ? request<CkCoach[]>(`/coaches?lang=${lang}`, token)
    : request<CkPlayer[]>(`/players?line=${kind}&lang=${lang}`, token);
}

export const coachKingService = {
  getHome: (token: string, lang: string) => request<CkHome>(`/me?lang=${lang}`, token),

  /** Whole line, cached in memory so the picker opens without a round trip. */
  getPool(token: string, kind: CkPoolKind, lang: string): Promise<Array<CkPlayer | CkCoach>> {
    const key = `${kind}:${lang}`;
    const hit = pools.get(key);
    if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.rows;
    const rows = loadPool(token, kind, lang);
    pools.set(key, { at: Date.now(), rows });
    rows.catch(() => {
      if (pools.get(key)?.rows === rows) pools.delete(key);
    });
    return rows;
  },

  prefetchPools(token: string, lang: string): void {
    for (const kind of ['FWD', 'MID', 'DEF', 'GK', 'COACH'] as const) {
      void coachKingService.getPool(token, kind, lang).catch(() => undefined);
    }
  },

  pickSlot: (token: string, lang: string, slotKey: string, playerId: string) =>
    request<CkHome>(`/me/slot?lang=${lang}`, token, { method: 'POST', body: JSON.stringify({ slotKey, playerId }) }),

  pickCoach: (token: string, lang: string, coachId: string) =>
    request<CkHome>(`/me/coach?lang=${lang}`, token, { method: 'POST', body: JSON.stringify({ coachId }) }),

  getUserSquad: (token: string, userId: string, lang: string) =>
    request<CkUserSquad>(`/users/${encodeURIComponent(userId)}/squad?lang=${lang}`, token),

  getFixtures: (token: string, lang: string) => request<CkFixture[]>(`/me/fixtures?lang=${lang}`, token),

  getLeaderboard: (token: string, period: 'week' | 'all') =>
    request<CkBoardRow[]>(`/leaderboard?period=${period}&limit=50`, token),
};

/** `18.5` and the unit, kept apart so the coin badge can style them. */
export function ckMoneyParts(milli: number, lang: string): { value: string; unit: string } {
  const rounded = Math.round(milli) / 10;
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return { value, unit: lang === 'ar' ? 'مليون' : 'M' };
}
