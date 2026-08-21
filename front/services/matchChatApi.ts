import { getApiUrl } from '../config/api.config';
import type { MatchChatPublicMessage, MatchChatReportReason } from '../types/matchChat';

export async function fetchMatchChatHistory(
  token: string,
  matchId: number,
  before?: string,
): Promise<{ messages: MatchChatPublicMessage[]; hasMore: boolean }> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : '';
  const res = await fetch(`${getApiUrl()}/match-chat/${matchId}/messages${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`history_${res.status}`);
  }
  return res.json() as Promise<{ messages: MatchChatPublicMessage[]; hasMore: boolean }>;
}

export async function reportMatchChatMessage(
  token: string,
  messageId: string,
  reason: MatchChatReportReason,
): Promise<void> {
  const res = await fetch(`${getApiUrl()}/match-chat/messages/${messageId}/report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`report_${res.status}`);
  }
}
