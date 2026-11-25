import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl();

export type SeedXpTarget = {
  id: string;
  clerkUserId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  xp: number;
  level: number;
};

export type SeedXpAdjustResult = {
  username: string;
  delta: number;
  awarded: number;
  xp: number;
  level: number;
  previousXp: number;
  previousLevel: number;
  reason: string;
};

async function authHeaders(token: string | null | undefined): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchSeedXpTarget(
  token: string | null | undefined,
): Promise<SeedXpTarget | null> {
  const res = await fetch(`${API_URL}/admin/xp/seed-target`, {
    method: 'GET',
    headers: await authHeaders(token),
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`seed-target ${res.status}`);
  }
  const json = await res.json();
  return (json?.data as SeedXpTarget) ?? null;
}

export async function adjustSeedXp(
  token: string | null | undefined,
  delta: number,
): Promise<SeedXpAdjustResult> {
  const res = await fetch(`${API_URL}/admin/xp/adjust`, {
    method: 'POST',
    headers: await authHeaders(token),
    body: JSON.stringify({ delta }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `adjust ${res.status}`);
  }
  return json.data as SeedXpAdjustResult;
}
