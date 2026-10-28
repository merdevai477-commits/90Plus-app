/**
 * King of Coaches ("ملك المدربين") API client.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl();

export type CkLine = 'GK' | 'DEF' | 'MID' | 'FWD';
export type CkPoolKind = CkLine | 'COACH';

/** Same order as the picker chips: England, Spain, Italy, Germany, France. */
export const CK_LEAGUE_KEYS = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'] as const;
export type CkLeagueKey = (typeof CK_LEAGUE_KEYS)[number];

/**
 * Keep in step with CK_SLOT_POSITIONS in src/services/coach-king-scoring.ts.
 * The pitch slot, not the whole line, decides who can be picked.
 */
export const CK_SLOT_POSITIONS: Record<string, readonly string[]> = {
  lw: ['LW'],
  st: ['CF', 'ST', 'SS'],
  rw: ['RW'],
  cm1: ['CM', 'AM', 'DM'],
  cm2: ['CM', 'AM', 'DM'],
  cm3: ['CM', 'AM', 'DM'],
  lb: ['LB'],
  cb1: ['CB'],
  cb2: ['CB'],
  rb: ['RB'],
  gk: ['GK'],
};

export function coachKingSlotAccepts(slotKey: string, position: string | null | undefined): boolean {
  const allowed = CK_SLOT_POSITIONS[slotKey];
  if (!allowed) return false;
  return allowed.includes((position ?? '').trim().toUpperCase());
}

export interface CkPlayer {
  id: string;
  leagueKey?: string | null;
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
  leagueKey?: string | null;
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
  leagueKey?: string | null;
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

type PoolRows = Array<CkPlayer | CkCoach>;

const POOL_TTL_MS = 5 * 60_000;
const DISK_TTL_MS = 12 * 60 * 60_000;
type PoolEntry = { at: number; rows: Promise<PoolRows> };
const pools = new Map<string, PoolEntry>();
const diskKey = (key: string) => `ck:pool:v2:${key}`;

function loadPool(token: string, kind: CkPoolKind, lang: string): Promise<PoolRows> {
  return kind === 'COACH'
    ? request<CkCoach[]>(`/coaches?lang=${lang}`, token)
    : request<CkPlayer[]>(`/players?line=${kind}&lang=${lang}`, token);
}

async function readDiskPool(key: string): Promise<PoolRows | null> {
  try {
    const raw = await AsyncStorage.getItem(diskKey(key));
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at: number; rows: PoolRows };
    return Date.now() - saved.at < DISK_TTL_MS && saved.rows?.length ? saved.rows : null;
  } catch {
    return null;
  }
}

export const coachKingService = {
  getHome: (token: string, lang: string) => request<CkHome>(`/me?lang=${lang}`, token),

  /**
   * Whole line, cached in memory and on disk so the picker opens without a
   * round trip; a disk copy is served at once while the network refreshes it.
   */
  getPool(token: string, kind: CkPoolKind, lang: string): Promise<PoolRows> {
    const key = `${kind}:${lang}`;
    const hit = pools.get(key);
    if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.rows;
    const network = loadPool(token, kind, lang).then((rows) => {
      if (rows.length) {
        void AsyncStorage.setItem(diskKey(key), JSON.stringify({ at: Date.now(), rows })).catch(() => undefined);
      }
      return rows;
    });
    const entry: PoolEntry = {
      at: Date.now(),
      rows: hit ? network : readDiskPool(key).then((saved) => saved ?? network),
    };
    pools.set(key, entry);
    network
      .then((rows) => {
        if (pools.get(key) === entry) pools.set(key, { at: Date.now(), rows: Promise.resolve(rows) });
      })
      .catch(() => {
        if (pools.get(key) === entry) pools.delete(key);
      });
    return entry.rows;
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
