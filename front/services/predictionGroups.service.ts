import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl();

export type GroupVisibility = 'PRIVATE' | 'PUBLIC';

export interface PredictionGroupListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  inviteCode: string;
  visibility: GroupVisibility;
  membersCount: number;
  role: 'OWNER' | 'MEMBER';
}

export interface GroupLeaderboardItem {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  totalPoints: number;
  weeklyPoints: number;
  todayPoints: number;
  totalAccuracy: number;
  weeklyAccuracy: number;
  totalCorrect: number;
}

export interface PredictionGroupDetails {
  group: {
    id: string;
    name: string;
    imageUrl: string | null;
    inviteCode: string;
    visibility: GroupVisibility;
    membersCount: number;
  };
  summary: {
    leaderboard: GroupLeaderboardItem[];
    currentUser: GroupLeaderboardItem | null;
    userInsight: {
      rank: number | null;
      pointsToNextRank: number | null;
      nextRank: number | null;
    };
    tabs: {
      overall: GroupLeaderboardItem[];
      weekly: GroupLeaderboardItem[];
      bestPrecisePrediction: GroupLeaderboardItem | null;
      topPointsToday: GroupLeaderboardItem | null;
    };
  };
  upcomingRoundMatches: Array<{
    fixtureId: number;
    homeTeamName: string;
    awayTeamName: string;
    matchDate: string;
    round: string | null;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    isFinished: boolean;
    canSubmitPrediction: boolean;
    myPrediction: 'home' | 'draw' | 'away' | null;
    predictions: Array<{
      userId: string;
      username: string;
      displayName: string | null;
      avatar: string | null;
      prediction: 'home' | 'draw' | 'away' | null;
      predictedHomeScore: number | null;
      predictedAwayScore: number | null;
      isCorrect: boolean | null;
      isCurrentUser: boolean;
    }>;
  }>;
}

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.message || body?.error || `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  if (body?.success && body?.data !== undefined) {
    return body.data as T;
  }

  return body as T;
}

export const PredictionGroupsService = {
  listMyGroups(token: string): Promise<PredictionGroupListItem[]> {
    return request<PredictionGroupListItem[]>('/prediction-groups/my', token, {
      cache: 'no-store',
    });
  },

  createGroup(
    token: string,
    payload: { name: string; imageUrl?: string | null; visibility: GroupVisibility },
  ): Promise<PredictionGroupListItem> {
    return request<PredictionGroupListItem>('/prediction-groups', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  joinGroup(token: string, payload: { inviteCode?: string; groupId?: string }): Promise<{ id: string; name: string; alreadyMember?: boolean }> {
    return request<{ id: string; name: string; alreadyMember?: boolean }>('/prediction-groups/join', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getGroupDetails(token: string, groupId: string): Promise<PredictionGroupDetails> {
    return request<PredictionGroupDetails>(`/prediction-groups/${encodeURIComponent(groupId)}`, token);
  },
};
