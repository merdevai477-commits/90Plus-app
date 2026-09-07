import { getApiUrl } from '../../config/api.config';
import {
  fetchWithClerkAuth,
  type GetTokenFn,
} from '../../utils/clerkAuthToken';

export const NOTIFICATION_PREFS_QUERY_KEY = ['notification-preferences'] as const;

export interface NotificationPreferences {
  matchGoals: boolean;
  matchStart: boolean;
  matchEnd: boolean;
  matchHalftime: boolean;
  matchCards: boolean;
  matchSubs: boolean;
  matchVar: boolean;
  matchLineups: boolean;
  leagueMatches: boolean;
  socialFollow: boolean;
  socialLike: boolean;
  socialComment: boolean;
  socialReply: boolean;
  socialMention: boolean;
  socialShare: boolean;
  predictionResults: boolean;
  luckyWheel: boolean;
  gifts: boolean;
  dailyQuiz: boolean;
  cooldown: boolean;
  levelUp: boolean;
  reportUpdates: boolean;
  avatarUpload: boolean;
  videoProcessed: boolean;
  leaderboard: boolean;
  aiCoach: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  matchGoals: true,
  matchStart: true,
  matchEnd: true,
  matchHalftime: true,
  matchCards: true,
  matchSubs: true,
  matchVar: true,
  matchLineups: true,
  leagueMatches: true,
  socialFollow: true,
  socialLike: true,
  socialComment: true,
  socialReply: true,
  socialMention: true,
  socialShare: true,
  predictionResults: true,
  luckyWheel: true,
  gifts: true,
  dailyQuiz: true,
  cooldown: true,
  levelUp: true,
  reportUpdates: true,
  avatarUpload: true,
  videoProcessed: true,
  leaderboard: true,
  aiCoach: false,
};

export async function fetchNotificationPreferences(
  getToken: GetTokenFn,
): Promise<NotificationPreferences> {
  const res = await fetchWithClerkAuth(
    getToken,
    `${getApiUrl()}/notifications/preferences`,
  );
  if (!res) throw new Error('NOT_AUTHENTICATED');
  if (!res.ok) throw new Error('NOTIF_PREFS_FETCH_FAILED');
  const data = await res.json();
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(data?.data?.preferences ?? {}) };
}

export async function updateNotificationPreferences(
  getToken: GetTokenFn,
  updates: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const res = await fetchWithClerkAuth(
    getToken,
    `${getApiUrl()}/notifications/preferences`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
  );
  if (!res) throw new Error('NOT_AUTHENTICATED');
  if (!res.ok) throw new Error('NOTIF_PREFS_UPDATE_FAILED');
  const data = await res.json();
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(data?.data?.preferences ?? {}) };
}
