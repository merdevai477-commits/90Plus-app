/**
 * Share & Win API client — شارك واربح
 *
 * Thin wrapper over `/api/share-win/*`. The backend owns every number here:
 * share count, participants, score and rank are read-only for the app.
 */

import { getApiUrl } from '../config/api.config';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface ShareWinCycleInfo {
  id: string;
  weekKey: string;
  startAt: string;
  endAt: string;
  status: 'ACTIVE' | 'COMPLETED';
  endsInMs: number;
}

export interface ShareWinLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  participants: number;
  shares: number;
  score: number;
}

export interface ShareWinPrize {
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  imageUrl: string | null;
}

export interface ShareWinLastWinner {
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  participants: number;
  score: number;
  rank: number;
  weekKey: string;
  closedAt: string | null;
}

export interface ShareWinOverview {
  referralCode: string;
  referralLink: string;
  shareCount: number;
  participants: number;
  score: number;
  rank: number;
  totalShareCount: number;
  cycle: ShareWinCycleInfo;
  leaderboard: ShareWinLeaderboardEntry[];
  prizes: ShareWinPrize[];
  lastWinner: ShareWinLastWinner | null;
  scoring: { perParticipant: number; perShare: number };
}

export interface RecordShareResult {
  counted: boolean;
  reason?: 'throttled' | 'daily_limit';
  shareCount: number;
  participantCount: number;
  score: number;
  totalShareCount: number;
}

export type ReferralClaimReason =
  | 'attributed'
  | 'invalid_code'
  | 'unknown_code'
  | 'self_referral'
  | 'already_attributed'
  | 'not_a_new_user';

export interface ReferralClaimResult {
  attributed: boolean;
  reason: ReferralClaimReason;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** Full Share & Win payload for the current user. */
export async function fetchShareWinOverview(token: string): Promise<ShareWinOverview> {
  const res = await fetchWithTimeout(`${getApiUrl()}/share-win/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`share-win/me failed: ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error('share-win/me returned no data');
  return json.data as ShareWinOverview;
}

/**
 * Tell the backend a share happened. Returns null on network failure so the
 * caller can degrade quietly — the native share sheet already succeeded and
 * must not be blocked by our bookkeeping.
 */
export async function recordShareEvent(
  token: string,
  channel: string,
): Promise<RecordShareResult | null> {
  try {
    const res = await fetchWithTimeout(`${getApiUrl()}/share-win/share`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ channel }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as RecordShareResult) ?? null;
  } catch {
    return null;
  }
}

/** Attach a captured referral code to the freshly registered account. */
export async function claimReferralCode(
  token: string,
  code: string,
): Promise<ReferralClaimResult | null> {
  try {
    const res = await fetchWithTimeout(`${getApiUrl()}/share-win/referral/claim`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as ReferralClaimResult) ?? null;
  } catch {
    return null;
  }
}

export interface ShareWinLeaderboardPage {
  cycle: Omit<ShareWinCycleInfo, 'endsInMs'>;
  entries: ShareWinLeaderboardEntry[];
  /** The caller's own row, sent on the first page only. */
  me: ShareWinLeaderboardEntry | null;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Rows per request. Small enough that the first page paints immediately. */
export const LEADERBOARD_PAGE_SIZE = 25;

/**
 * One page of the full leaderboard — current cycle, or an archived week via
 * `weekKey`. Throws on failure so React Query can drive retry/error states
 * rather than the caller having to special-case a null.
 */
export async function fetchShareWinLeaderboard(
  token: string,
  options: { weekKey?: string; limit?: number; offset?: number } = {},
): Promise<ShareWinLeaderboardPage> {
  const params = new URLSearchParams();
  if (options.weekKey) params.set('weekKey', options.weekKey);
  params.set('limit', String(options.limit ?? LEADERBOARD_PAGE_SIZE));
  params.set('offset', String(options.offset ?? 0));

  const res = await fetchWithTimeout(
    `${getApiUrl()}/share-win/leaderboard?${params.toString()}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`share-win/leaderboard failed: ${res.status}`);

  const json = await res.json();
  if (!json?.data) throw new Error('share-win/leaderboard returned no data');
  return json.data as ShareWinLeaderboardPage;
}
