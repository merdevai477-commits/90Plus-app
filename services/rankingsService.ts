/**
 * Rankings Service
 * خدمة الرانكينج - للتواصل مع الباك ايند
 * ✅ SUPER SPEED: Added memory cache + AsyncStorage cache for instant loading
 */

import { getApiUrl } from '../config/api.config';
import { cacheService } from './cacheService';

// Cache keys for rankings
const RANKINGS_CACHE_KEYS = {
  TOP_VIEWS: 'rankings_top_views',
  TOP_SHARES: 'rankings_top_shares',
  TOP_PLAYERS_WEEKLY: 'rankings_top_players_weekly',
  TOP_PLAYERS_MONTHLY: 'rankings_top_players_monthly',
  ALL_RANKINGS: 'rankings_all',
};

// Cache TTL: 5 minutes for rankings (they update frequently)
const RANKINGS_CACHE_TTL = 5 * 60 * 1000;

// ✅ SUPER SPEED: In-memory cache for instant responses
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const MEMORY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for memory cache

const getFromMemoryCache = (key: string): any | null => {
    const cached = memoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        return cached.data;
    }
    return null;
};

const setMemoryCache = (key: string, data: any): void => {
    memoryCache.set(key, { data, timestamp: Date.now() });
};

export interface RankedReel {
  rank: number;
  id: string;
  thumbnail: string | null;
  caption: string | null;
  views: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    isVerified: boolean;
  };
  createdAt: string;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

export interface RankedQuizUser {
  rank: number;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    isVerified: boolean;
    level: number;
  } | null;
  totalScore: number;
  totalCoinsEarned: number;
  quizCount: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

export interface RankedPredictor {
  rank: number;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    isVerified: boolean;
    level: number;
  } | null;
  correctPredictions: number;
  totalPredictions: number;
  accuracy: number;
  coinsWon: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

export interface RankedPlayer {
  rank: number;
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  isVerified: boolean;
  level: number;
  xp: number;
  position: string;
  countryFlag: string;
  clubLogo: string | null;
  followersCount: number;
  stats: {
    totalViews: number;
    totalLikes: number;
    profileViews: number;
  };
  score: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

export type PlayerPeriod = 'weekly' | 'monthly';

export interface PlayerVotes {
  up: number;
  down: number;
}

export interface RankedCommenter {
  rank: number;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    isVerified: boolean;
    level: number;
  } | null;
  commentsCount: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

export interface AllRankingsResponse {
  topViews: RankedReel[];
  topShares: RankedReel[];
  topPredictions: RankedPredictor[];
  topCommenters: RankedCommenter[];
  period: string;
}

// Rate limit tracking for rankings endpoints
const rankingsRateLimitCache = new Map<string, { timestamp: number; retryAfter: number }>();

class RankingsService {
  private getBaseUrl(): string {
    return getApiUrl();
  }

  private async fetchWithAuth(endpoint: string, token: string | null, skipRateLimitCheck: boolean = false) {
    // Check rate limit cache
    if (!skipRateLimitCheck) {
      const rateLimitInfo = rankingsRateLimitCache.get(endpoint);
      if (rateLimitInfo && Date.now() - rateLimitInfo.timestamp < rateLimitInfo.retryAfter) {
        const remainingTime = Math.ceil((rateLimitInfo.retryAfter - (Date.now() - rateLimitInfo.timestamp)) / 1000);
        throw new Error(`RATE_LIMIT:429:${remainingTime}`);
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      // Handle rate limit (429) specifically
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        const retryAfterMs = retryAfterSeconds * 1000;
        
        // Cache rate limit info
        rankingsRateLimitCache.set(endpoint, {
          timestamp: Date.now(),
          retryAfter: retryAfterMs,
        });
        
        // Silent rate limit - don't log to avoid spamming console
        throw new Error(`RATE_LIMIT:429:${retryAfterSeconds}`);
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get top views rankings (last 3 days)
   */
  async getTopViews(token: string | null, limit: number = 10): Promise<RankedReel[]> {
    try {
      const response = await this.fetchWithAuth(`/reels/rankings/top-views?limit=${limit}`, token);
      return response.data?.rankings || [];
    } catch (error: any) {
      // Silent error handling - return empty array
      return [];
    }
  }

  /**
   * Get top shares rankings (last 3 days)
   */
  async getTopShares(token: string | null, limit: number = 10): Promise<RankedReel[]> {
    try {
      const response = await this.fetchWithAuth(`/reels/rankings/top-shares?limit=${limit}`, token);
      return response.data?.rankings || [];
    } catch (error: any) {
      // Silent error handling - return empty array
      return [];
    }
  }

  /**
   * Get top quiz users
   */
  async getTopQuiz(token: string | null, limit: number = 10): Promise<RankedQuizUser[]> {
    try {
      const response = await this.fetchWithAuth(`/reels/rankings/top-quiz?limit=${limit}`, token);
      return response.data?.rankings || [];
    } catch (error: any) {
      // Silent error handling - return empty array
      return [];
    }
  }

  /**
   * Vote for a player
   */
  async voteForPlayer(token: string | null, userId: string, voteType: 'up' | 'down'): Promise<{ action: string; voteType: string | null; votes: PlayerVotes } | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.getBaseUrl()}/reels/rankings/players/${userId}/vote`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ voteType }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      // Silent error handling
      return null;
    }
  }

  /**
   * Get player votes
   */
  async getPlayerVotes(token: string | null, userId: string): Promise<{ votes: PlayerVotes; userVote: string | null } | null> {
    try {
      const response = await this.fetchWithAuth(`/reels/rankings/players/${userId}/votes`, token);
      return response.data;
    } catch (error) {
      // Silent error handling
      return null;
    }
  }

  /**
   * Submit match prediction
   */
  async submitPrediction(
    token: string | null,
    matchId: string,
    homeScore: number,
    awayScore: number
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.getBaseUrl()}/predictions/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ matchId, homeScore, awayScore }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { 
        success: true, 
        message: data.data?.message || data.message || 'تم إرسال توقعك بنجاح',
        data: data.data 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || 'فشل إرسال التوقع. يرجى المحاولة مرة أخرى.' 
      };
    }
  }

  /**
   * Get top commenters (last 3 days)
   */
  async getTopCommenters(token: string | null, limit: number = 10): Promise<RankedCommenter[]> {
    try {
      const response = await this.fetchWithAuth(`/reels/rankings/top-commenters?limit=${limit}`, token);
      return response.data?.rankings || [];
    } catch (error: any) {
      // Silent error handling - return empty array
      return [];
    }
  }

  /**
   * Get top predictors
   */
  async getTopPredictions(token: string | null, limit: number = 10): Promise<RankedPredictor[]> {
    try {
      const response = await this.fetchWithAuth(`/reels/rankings/top-predictions?limit=${limit}`, token);
      return response.data?.rankings || [];
    } catch (error: any) {
      // Silent error handling - return empty array
      return [];
    }
  }

  /**
   * Get all rankings in one request (more efficient)
   * ✅ SUPER SPEED: Memory cache → AsyncStorage cache → API
   */
  async getAllRankings(token: string | null, limit: number = 10): Promise<AllRankingsResponse> {
    try {
      // ✅ SUPER SPEED: Check memory cache first (instant)
      const memoryCached = getFromMemoryCache(RANKINGS_CACHE_KEYS.ALL_RANKINGS);
      if (memoryCached) {
        console.log('⚡ Rankings from memory cache');
        return memoryCached;
      }

      // Try AsyncStorage cache second
      const cached = await cacheService.get<AllRankingsResponse>(RANKINGS_CACHE_KEYS.ALL_RANKINGS);
      if (cached) {
        console.log('📦 Rankings from storage cache');
        // Store in memory for next time
        setMemoryCache(RANKINGS_CACHE_KEYS.ALL_RANKINGS, cached);
        // Refresh in background (non-blocking)
        this.refreshAllRankingsInBackground(token, limit);
        return cached;
      }

      const response = await this.fetchWithAuth(`/reels/rankings/all?limit=${limit}`, token);
      const result = {
        topViews: response.data?.topViews || [],
        topShares: response.data?.topShares || [],
        topPredictions: response.data?.topPredictions || [],
        topCommenters: response.data?.topCommenters || [],
        period: response.data?.period || '3_days',
      };
      
      // Cache in both memory and storage
      setMemoryCache(RANKINGS_CACHE_KEYS.ALL_RANKINGS, result);
      await cacheService.set(RANKINGS_CACHE_KEYS.ALL_RANKINGS, result, RANKINGS_CACHE_TTL);
      
      return result;
    } catch (error: any) {
      // Silent error handling - return cached data or empty response
      const cached = await cacheService.get<AllRankingsResponse>(RANKINGS_CACHE_KEYS.ALL_RANKINGS);
      if (cached) {
        setMemoryCache(RANKINGS_CACHE_KEYS.ALL_RANKINGS, cached);
        return cached;
      }
      
      return {
        topViews: [],
        topShares: [],
        topPredictions: [],
        topCommenters: [],
        period: '3_days',
      };
    }
  }

  /**
   * Background refresh for rankings (non-blocking)
   */
  private async refreshAllRankingsInBackground(token: string | null, limit: number): Promise<void> {
    try {
      // Skip rate limit check for background refresh to avoid blocking
      const response = await this.fetchWithAuth(`/reels/rankings/all?limit=${limit}`, token, true);
      const result = {
        topViews: response.data?.topViews || [],
        topShares: response.data?.topShares || [],
        topPredictions: response.data?.topPredictions || [],
        topCommenters: response.data?.topCommenters || [],
        period: response.data?.period || '3_days',
      };
      setMemoryCache(RANKINGS_CACHE_KEYS.ALL_RANKINGS, result);
      await cacheService.set(RANKINGS_CACHE_KEYS.ALL_RANKINGS, result, RANKINGS_CACHE_TTL);
    } catch (error: any) {
      // Silent fail for background refresh, but log rate limit for debugging
      if (error?.message?.startsWith('RATE_LIMIT:429')) {
        // Rate limit - will retry later
      }
    }
  }

  /**
   * Get top 11 players with caching
   * @param period - 'weekly' | 'monthly'
   * ✅ SUPER SPEED: Memory cache → AsyncStorage cache → API
   */
  async getTopPlayers(token: string | null, limit: number = 11, period: PlayerPeriod = 'weekly'): Promise<{ players: RankedPlayer[]; period: string }> {
    try {
      const cacheKey = period === 'weekly' ? RANKINGS_CACHE_KEYS.TOP_PLAYERS_WEEKLY : RANKINGS_CACHE_KEYS.TOP_PLAYERS_MONTHLY;
      
      // ✅ SUPER SPEED: Check memory cache first (instant)
      const memoryCached = getFromMemoryCache(cacheKey);
      if (memoryCached) {
        console.log(`⚡ Top players (${period}) from memory cache`);
        return memoryCached;
      }

      // Try AsyncStorage cache second
      const cached = await cacheService.get<{ players: RankedPlayer[]; period: string }>(cacheKey);
      if (cached) {
        console.log(`📦 Top players (${period}) from storage cache`);
        setMemoryCache(cacheKey, cached);
        return cached;
      }

      const response = await this.fetchWithAuth(`/reels/rankings/top-players?limit=${limit}&period=${period}`, token);
      const result = {
        players: response.data?.players || [],
        period: response.data?.period || 'weekly',
      };
      
      // Cache in both memory and storage
      setMemoryCache(cacheKey, result);
      await cacheService.set(cacheKey, result, RANKINGS_CACHE_TTL);
      
      return result;
    } catch (error: any) {
      // Silent error handling - return cached data or empty response
      const cacheKey = period === 'weekly' ? RANKINGS_CACHE_KEYS.TOP_PLAYERS_WEEKLY : RANKINGS_CACHE_KEYS.TOP_PLAYERS_MONTHLY;
      const cached = await cacheService.get<{ players: RankedPlayer[]; period: string }>(cacheKey);
      if (cached) {
        setMemoryCache(cacheKey, cached);
        return cached;
      }
      
      return { players: [], period: 'weekly' };
    }
  }

  /**
   * Clear memory cache
   * Should be called on logout to prevent serving stale cached data
   */
  clearMemoryCache(): void {
    memoryCache.clear();
    console.log('🧹 RankingsService memory cache cleared');
  }
}

// Badge Types
export interface UserBadge {
  id: string;
  userId: string;
  badgeType: string; // 'gold', 'silver', 'bronze', 'diamond', 'rank_4' to 'rank_100'
  category: string; // 'views', 'shares', 'comments', 'predictions', 'team_of_month'
  period: string; // 'daily', 'weekly', 'monthly'
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

// Cache for user badges to reduce API calls
const BADGES_CACHE_KEY = 'user_badges';
const BADGES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// Rate limit tracking for badges endpoint
const badgesRateLimitCache = new Map<string, { timestamp: number; retryAfter: number }>();

/**
 * Get user badges with caching and rate limit handling
 */
export async function getUserBadges(token: string | null, userId: string): Promise<UserBadgesResponse | null> {
  try {
    const cacheKey = `${BADGES_CACHE_KEY}_${userId}`;
    
    // Check memory cache first
    const memoryCached = getFromMemoryCache(cacheKey);
    if (memoryCached) {
      return memoryCached;
    }

    // Check AsyncStorage cache
    const cached = await cacheService.get<UserBadgesResponse>(cacheKey);
    if (cached) {
      setMemoryCache(cacheKey, cached);
      // Refresh in background (non-blocking)
      refreshBadgesInBackground(token, userId, cacheKey);
      return cached;
    }

    // Check if we're in rate limit window
    const rateLimitKey = `badges_${userId}`;
    const rateLimitInfo = badgesRateLimitCache.get(rateLimitKey);
    if (rateLimitInfo && Date.now() - rateLimitInfo.timestamp < rateLimitInfo.retryAfter) {
      // Return cached data if available, otherwise return null (silent)
      return cached || null;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}/reels/rankings/user/${userId}/badges`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      // Handle rate limit (429) specifically
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        const retryAfterMs = retryAfterSeconds * 1000;
        
        // Cache rate limit info
        badgesRateLimitCache.set(rateLimitKey, {
          timestamp: Date.now(),
          retryAfter: retryAfterMs,
        });
        
        // Return cached data if available (silent)
        if (cached) {
          return cached;
        }
        
        // If no cache, return null (will retry later)
        return null;
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const badgesData = data.data || null;
    
    if (badgesData) {
      // Cache in both memory and storage
      setMemoryCache(cacheKey, badgesData);
      await cacheService.set(cacheKey, badgesData, BADGES_CACHE_TTL);
    }
    
    return badgesData;
  } catch (error) {
    // Silent error handling - return cached data or null
    const cacheKey = `${BADGES_CACHE_KEY}_${userId}`;
    const cached = await cacheService.get<UserBadgesResponse>(cacheKey);
    if (cached) {
      return cached;
    }
    
    return null;
  }
}

/**
 * Background refresh for badges (non-blocking)
 */
async function refreshBadgesInBackground(
  token: string | null, 
  userId: string, 
  cacheKey: string
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}/reels/rankings/user/${userId}/badges`, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      const badgesData = data.data || null;
      
      if (badgesData) {
        setMemoryCache(cacheKey, badgesData);
        await cacheService.set(cacheKey, badgesData, BADGES_CACHE_TTL);
      }
    }
  } catch (error) {
    // Silent fail for background refresh
  }
}

export const rankingsService = new RankingsService();
export default rankingsService;
