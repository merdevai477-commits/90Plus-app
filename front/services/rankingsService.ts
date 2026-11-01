/**
 * Profile badges earned before the rank leaderboard was removed.
 * Reads stored medals only — it does not rank users.
 */

import { getApiUrl } from '../config/api.config';
import { cacheService } from './cacheService';

const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const MEMORY_CACHE_TTL = 2 * 60 * 1000;

function getFromMemoryCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setMemoryCache(key: string, data: unknown): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeType: string;
  category: string;
  period: string;
  rank: number;
  earnedAt: string;
  monthYear?: string;
}

export interface BadgesSummary {
  gold: number;
  silver: number;
  bronze: number;
  diamond: number;
  ranked: number;
  total: number;
}

export interface StreakInfo {
  consecutiveMonths: number;
  diamondAwarded: boolean;
  diamondAwardedAt: string | null;
}

export interface UserBadgesResponse {
  badges: UserBadge[];
  summary: BadgesSummary;
  streak: StreakInfo | null;
}

const BADGES_CACHE_KEY = 'user_badges';
const BADGES_CACHE_TTL = 5 * 60 * 1000;
const badgesRateLimitCache = new Map<string, { timestamp: number; retryAfter: number }>();

export async function getUserBadges(token: string | null, userId: string): Promise<UserBadgesResponse | null> {
  try {
    const cacheKey = `${BADGES_CACHE_KEY}_${userId}`;

    const memoryCached = getFromMemoryCache<UserBadgesResponse>(cacheKey);
    if (memoryCached) return memoryCached;

    const cached = await cacheService.get<UserBadgesResponse>(cacheKey);
    if (cached) {
      setMemoryCache(cacheKey, cached);
      void refreshBadgesInBackground(token, userId, cacheKey);
      return cached;
    }

    const rateLimitKey = `badges_${userId}`;
    const rateLimitInfo = badgesRateLimitCache.get(rateLimitKey);
    if (rateLimitInfo && Date.now() - rateLimitInfo.timestamp < rateLimitInfo.retryAfter) {
      return null;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${getApiUrl()}/reels/rankings/user/${userId}/badges`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        badgesRateLimitCache.set(rateLimitKey, {
          timestamp: Date.now(),
          retryAfter: (Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 60) * 1000,
        });
      }
      return null;
    }

    const data = await response.json();
    const badgesData = (data.data ?? null) as UserBadgesResponse | null;
    if (badgesData) {
      setMemoryCache(cacheKey, badgesData);
      await cacheService.set(cacheKey, badgesData, BADGES_CACHE_TTL);
    }
    return badgesData;
  } catch {
    const cached = await cacheService.get<UserBadgesResponse>(`${BADGES_CACHE_KEY}_${userId}`);
    return cached ?? null;
  }
}

async function refreshBadgesInBackground(token: string | null, userId: string, cacheKey: string): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${getApiUrl()}/reels/rankings/user/${userId}/badges`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) return;
    const data = await response.json();
    const badgesData = data.data ?? null;
    if (badgesData) {
      setMemoryCache(cacheKey, badgesData);
      await cacheService.set(cacheKey, badgesData, BADGES_CACHE_TTL);
    }
  } catch {
    /* background refresh is best-effort */
  }
}

export const rankingsService = {
  clearMemoryCache(): void {
    memoryCache.clear();
  },
};

export default rankingsService;
