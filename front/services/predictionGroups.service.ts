/**
 * Prediction Groups API client — ملك التوقعات
 */

import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

const API_URL = getApiUrl();

export interface PredictionGroupInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  inviteCode: string;
  ownerId: string;
  membersCount: number;
  createdAt: string;
  isPrivate: boolean;
}

export interface GroupMembershipInfo {
  id: string;
  role: 'OWNER' | 'MEMBER';
  groupXpTotal: number;
  joinedAt: string;
  isOwner: boolean;
}

export interface MyGroupState {
  hasGroup: boolean;
  group: PredictionGroupInfo | null;
  membership: GroupMembershipInfo | null;
  groupBan?: { until: string } | null;
}

export interface GroupMemberRow {
  rank: number;
  userId: string;
  username: string;
  name: string;
  avatar: string | null;
  /** Primary display value — today's points (daily ranking). */
  points: number;
  /** Today's points (same as `points`, explicit). */
  dailyPoints?: number;
  /** All-time group XP total. */
  totalPoints?: number;
  isMe: boolean;
  isAdmin: boolean;
  correct?: number;
  wrong?: number;
  accuracy?: number;
}

export interface GroupDailyInsight {
  rank: number | null;
  points: number;
  pointsToNextRank: number | null;
  nextRank: number | null;
  isLeading: boolean;
}

export interface GroupStandings {
  members: GroupMemberRow[];
  period: 'daily';
  dayStart: string;
  insight: GroupDailyInsight;
  groupStats: { totalPredictions: number; correctPredictions: number; wrongPredictions: number };
}

export interface GroupRoundMatch {
  apiMatchId: number;
  home: { name: string; logo: string | null; short: string };
  away: { name: string; logo: string | null; short: string };
  day: string;
  time: string;
  status: string;
  leagueName: string | null;
  result?: { home: number; away: number };
  prediction?: {
    mode: 'WINNER' | 'EXACT';
    predictedWinner: string | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
    isCorrect: boolean | null;
    xpAwarded: number;
  } | null;
}

export interface RankedGroupRow {
  rank: number;
  id: string;
  name: string;
  avatarUrl: string | null;
  inviteCode: string;
  points: number;
  members: number;
  isMine?: boolean;
  hasScores?: boolean;
}

async function parseError(response: Response): Promise<Error> {
  try {
    const data = await response.json();
    return new Error(data?.message || response.statusText);
  } catch {
    return new Error(response.statusText);
  }
}

async function authFetch(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}/prediction-groups${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw await parseError(response);
  const json = await response.json();
  return json.data;
}

export const PredictionGroupsService = {
  getMe: (token: string, bustCache = false) =>
    authFetch(token, bustCache ? `/me?_=${Date.now()}` : '/me') as Promise<MyGroupState>,

  createGroup: (token: string, name: string, avatarUrl?: string | null) =>
    authFetch(token, '/', {
      method: 'POST',
      body: JSON.stringify({ name, avatarUrl }),
    }) as Promise<MyGroupState>,

  previewByCode: (token: string, code: string) =>
    authFetch(token, `/preview/${encodeURIComponent(code)}`) as Promise<{
      id: string;
      name: string;
      avatarUrl: string | null;
      inviteCode: string;
      membersCount: number;
    }>,

  join: (token: string, opts: { code?: string; inviteId?: string }) =>
    authFetch(token, '/join', {
      method: 'POST',
      body: JSON.stringify(opts),
    }) as Promise<MyGroupState>,

  leave: (token: string) =>
    authFetch(token, '/leave', { method: 'POST' }) as Promise<{
      success: boolean;
      groupBan?: { until: string } | null;
      state: MyGroupState;
    }>,

  deleteGroup: (token: string, groupId: string) =>
    authFetch(token, `/${groupId}`, { method: 'DELETE' }) as Promise<{
      success: boolean;
      groupBan?: { until: string } | null;
      state: MyGroupState;
    }>,

  updateGroup: (token: string, groupId: string, data: { name?: string; avatarUrl?: string | null }) =>
    authFetch(token, `/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }) as Promise<MyGroupState>,

  getMembers: (token: string, groupId: string) =>
    authFetch(token, `/${groupId}/members`) as Promise<GroupMemberRow[]>,

  getStandings: (token: string, groupId: string) =>
    authFetch(token, `/${groupId}/standings`) as Promise<GroupStandings>,

  kickMember: (token: string, groupId: string, userId: string) =>
    authFetch(token, `/${groupId}/members/${userId}`, { method: 'DELETE' }),

  inviteUser: (token: string, groupId: string, userId: string) =>
    authFetch(token, `/${groupId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  getCurrentRound: (token: string, groupId: string) =>
    authFetch(token, `/${groupId}/round/current`) as Promise<{
      round: { id: string; date: string; status: string };
      matches: GroupRoundMatch[];
    }>,

  savePredictions: (
    token: string,
    groupId: string,
    predictions: Array<{
      apiMatchId: number;
      mode: 'WINNER' | 'EXACT';
      predictedWinner?: 'home' | 'draw' | 'away';
      predictedHomeScore?: number;
      predictedAwayScore?: number;
    }>,
  ) =>
    authFetch(token, `/${groupId}/predictions`, {
      method: 'POST',
      body: JSON.stringify({ predictions }),
    }),

  getLeaderboard: (token: string, period: 'all' | 'week' | 'month' = 'all') =>
    authFetch(token, `/leaderboard?period=${period}`) as Promise<RankedGroupRow[]>,
};

export function mapRoundMatchToCard(m: GroupRoundMatch) {
  return {
    id: String(m.apiMatchId),
    apiMatchId: m.apiMatchId,
    status: m.status,
    prediction: m.prediction,
    home: {
      name: m.home.name,
      crest: ['#7C3AED', '#5B21B6'] as [string, string],
      short: m.home.short,
      logo: m.home.logo,
    },
    away: {
      name: m.away.name,
      crest: ['#7C3AED', '#5B21B6'] as [string, string],
      short: m.away.short,
      logo: m.away.logo,
    },
    day: m.day,
    time: m.time,
    result: m.result,
  };
}

export function buildGroupJoinShareUrl(code: string): string {
  const base = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.replace(/\/$/, '') || 'https://90plus.pro';
  const normalized = code.trim().toUpperCase();
  return `${base}/groups/join/${normalized}`;
}

export function parseGroupCodeFromUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const custom = trimmed.match(/ninetyplus:\/\/group\/join\/([A-Z0-9]+)/i);
  if (custom?.[1]) return custom[1].toUpperCase();
  const https = trimmed.match(/\/groups\/join\/([A-Z0-9]+)/i);
  if (https?.[1]) return https[1].toUpperCase();
  if (/^90PLUS[A-Z0-9]+$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}
