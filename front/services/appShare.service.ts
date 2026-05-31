import { getApiUrl } from '../config/api.config';

export interface AppShareStatus {
  eligible: boolean;
  rewardXp: number;
  nextEligibleAt: string | null;
}

export interface AppShareClaimResult {
  awarded: number;
  reason?: string;
  xpEvents: Array<{
    action: string;
    amount: number;
    leveledUp: boolean;
    newLevel: number;
    newTitle?: string;
  }>;
  nextEligibleAt: string | null;
  rewardXp: number;
}

function timezoneHeader(): Record<string, string> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? { 'x-user-timezone': tz } : {};
  } catch {
    return {};
  }
}

export async function fetchAppShareStatus(token: string): Promise<AppShareStatus | null> {
  const res = await fetch(`${getApiUrl()}/xp/app-share/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...timezoneHeader(),
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

export async function claimAppShareReward(token: string): Promise<AppShareClaimResult | null> {
  const res = await fetch(`${getApiUrl()}/xp/app-share/claim`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...timezoneHeader(),
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

/** Hours/minutes until next eligible share reward. */
export function formatShareCooldown(iso: string | null): { hours: number; minutes: number } | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.ceil((diff % 3_600_000) / 60_000);
  return { hours, minutes: minutes >= 60 ? 59 : minutes };
}
