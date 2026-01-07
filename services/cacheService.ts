/**
 * Centralized Cache Service
 * Provides consistent caching behavior across all screens using AsyncStorage
 * with timestamp support and TTL validation.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache key prefix to identify cache entries
const CACHE_PREFIX = '@cache_';

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

// Maximum number of cache entries (for LRU eviction)
const MAX_CACHE_ENTRIES = 100;

/**
 * Cache entry structure with timestamp and TTL support
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache TTL configuration for different data types
 */
export const CACHE_TTL = {
  PROFILE: 5 * 60 * 1000,           // 5 minutes
  REELS: 2 * 60 * 1000,             // 2 minutes
  NOTIFICATIONS: 1 * 60 * 1000,     // 1 minute
  MATCHES: 30 * 60 * 1000,          // 30 minutes
  // Long-term cache for static data (shared across all users)
  TEAMS: 7 * 24 * 60 * 60 * 1000,   // 7 days - team info rarely changes
  PLAYERS: 24 * 60 * 60 * 1000,     // 24 hours - player info
  LEAGUES: 7 * 24 * 60 * 60 * 1000, // 7 days - league info
  LOGOS: 30 * 24 * 60 * 60 * 1000,  // 30 days - logos never change
  SEARCH: 24 * 60 * 60 * 1000,      // 24 hours - search results
  STANDINGS: 60 * 60 * 1000,        // 1 hour - standings update frequently
  H2H: 7 * 24 * 60 * 60 * 1000,     // 7 days - historical h2h
} as const;

/**
 * Predefined cache keys for consistency
 */
export const CACHE_KEYS = {
  PROFILE_DATA: 'profile_data',
  PROFILE_STATS: 'profile_stats',
  PROFILE_VIDEOS: 'profile_videos',
  REELS_FEED: 'reels_feed',
  NOTIFICATIONS: 'notifications',
  MATCHES: 'matches',
  MATCHES_BY_DATE: 'matches_by_date', // New: cache matches by date
  // Football data keys
  TEAMS: 'teams',
  PLAYERS: 'players',
  LEAGUES: 'leagues',
  SEARCH: 'search',
  STANDINGS: 'standings',
  H2H: 'h2h',
} as const;

class CacheService {
  /**
   * Get cached data by key.
   * Returns null if data doesn't exist or has expired.
   * 
   * Requirement 4.2: Return data if it exists and is not expired
   * Requirement 4.3: Return null if data has expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const raw = await AsyncStorage.getItem(cacheKey);
      
      if (!raw) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(raw);
      const now = Date.now();
      const age = now - entry.timestamp;

      // Check if cache has expired
      if (age > entry.ttl) {
        // Cache expired, return null (don't delete here to allow background refresh)
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`[CacheService] Error getting cache for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Store data in cache with timestamp and TTL.
   * Implements LRU eviction when cache exceeds limits.
   * 
   * Requirement 4.1: Store data with timestamp
   * Requirement 4.4: Remove oldest entries when cache exceeds limits
   */
  async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      // Check if we need to evict old entries
      await this.evictIfNeeded();
    } catch (error) {
      console.error(`[CacheService] Error setting cache for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Invalidate (remove) a specific cache entry.
   */
  async invalidate(key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error(`[CacheService] Error invalidating cache for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Clean up all expired cache entries.
   * Should be called on app start.
   */
  async cleanup(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (const cacheKey of cacheKeys) {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (raw) {
            const entry: CacheEntry<unknown> = JSON.parse(raw);
            const age = now - entry.timestamp;
            
            if (age > entry.ttl) {
              keysToRemove.push(cacheKey);
            }
          }
        } catch {
          // If we can't parse the entry, remove it
          keysToRemove.push(cacheKey);
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[CacheService] Cleaned up ${keysToRemove.length} expired cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error during cleanup:', error);
    }
  }

  /**
   * Get all cache keys matching a pattern.
   */
  async getKeys(pattern?: string): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys
        .filter(key => key.startsWith(CACHE_PREFIX))
        .map(key => key.replace(CACHE_PREFIX, ''));

      if (pattern) {
        return cacheKeys.filter(key => key.includes(pattern));
      }

      return cacheKeys;
    } catch (error) {
      console.error('[CacheService] Error getting keys:', error);
      return [];
    }
  }

  /**
   * Check if a cache entry exists and is valid (not expired).
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Get cache entry metadata (timestamp, ttl) without the data.
   */
  async getMetadata(key: string): Promise<{ timestamp: number; ttl: number } | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const raw = await AsyncStorage.getItem(cacheKey);
      
      if (!raw) {
        return null;
      }

      const entry: CacheEntry<unknown> = JSON.parse(raw);
      return {
        timestamp: entry.timestamp,
        ttl: entry.ttl,
      };
    } catch (error) {
      console.error(`[CacheService] Error getting metadata for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Clear all cache entries.
   */
  async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[CacheService] Cleared ${cacheKeys.length} cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error clearing all cache:', error);
      throw error;
    }
  }

  /**
   * Clear all search cache entries.
   * Useful when search format changes.
   */
  async clearSearchCache(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const searchKeys = allKeys.filter(key => key.includes(CACHE_KEYS.SEARCH));
      
      if (searchKeys.length > 0) {
        await AsyncStorage.multiRemove(searchKeys);
        console.log(`[CacheService] Cleared ${searchKeys.length} search cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error clearing search cache:', error);
    }
  }

  /**
   * Generate the full cache key with prefix.
   */
  private getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * Evict oldest cache entries when cache exceeds maximum size.
   * Implements LRU (Least Recently Used) eviction strategy based on timestamp.
   * 
   * Requirement 4.4: Remove oldest entries first when cache exceeds limits
   */
  private async evictIfNeeded(maxEntries: number = MAX_CACHE_ENTRIES): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      if (cacheKeys.length <= maxEntries) {
        return; // No eviction needed
      }

      // Get all cache entries with their timestamps
      const entriesWithTimestamp: Array<{ key: string; timestamp: number }> = [];
      
      for (const cacheKey of cacheKeys) {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (raw) {
            const entry: CacheEntry<unknown> = JSON.parse(raw);
            entriesWithTimestamp.push({
              key: cacheKey,
              timestamp: entry.timestamp,
            });
          }
        } catch {
          // If we can't parse the entry, mark it for removal with oldest timestamp
          entriesWithTimestamp.push({
            key: cacheKey,
            timestamp: 0,
          });
        }
      }

      // Sort by timestamp (oldest first)
      entriesWithTimestamp.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate how many entries to remove
      const entriesToRemove = entriesWithTimestamp.length - maxEntries;
      
      if (entriesToRemove > 0) {
        const keysToRemove = entriesWithTimestamp
          .slice(0, entriesToRemove)
          .map(entry => entry.key);
        
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[CacheService] Evicted ${keysToRemove.length} oldest cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error during eviction:', error);
    }
  }

  /**
   * Get the maximum number of cache entries allowed.
   * Exposed for testing purposes.
   */
  getMaxCacheEntries(): number {
    return MAX_CACHE_ENTRIES;
  }

  // ============================================
  // FOOTBALL DATA CACHING METHODS
  // ============================================

  /**
   * Cache a team's data for long-term storage.
   * Teams data rarely changes, so we cache for 7 days.
   */
  async cacheTeam(teamId: number, teamData: any): Promise<void> {
    const key = `${CACHE_KEYS.TEAMS}_${teamId}`;
    await this.set(key, teamData, CACHE_TTL.TEAMS);
  }

  /**
   * Get cached team data.
   */
  async getTeam(teamId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.TEAMS}_${teamId}`;
    return this.get(key);
  }

  /**
   * Cache a player's data.
   */
  async cachePlayer(playerId: number, playerData: any): Promise<void> {
    const key = `${CACHE_KEYS.PLAYERS}_${playerId}`;
    await this.set(key, playerData, CACHE_TTL.PLAYERS);
  }

  /**
   * Get cached player data.
   */
  async getPlayer(playerId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.PLAYERS}_${playerId}`;
    return this.get(key);
  }

  /**
   * Cache league data.
   */
  async cacheLeague(leagueId: number, leagueData: any): Promise<void> {
    const key = `${CACHE_KEYS.LEAGUES}_${leagueId}`;
    await this.set(key, leagueData, CACHE_TTL.LEAGUES);
  }

  /**
   * Get cached league data.
   */
  async getLeague(leagueId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.LEAGUES}_${leagueId}`;
    return this.get(key);
  }

  /**
   * Cache search results for a query.
   * This allows users to find previously searched items instantly.
   */
  async cacheSearchResults(query: string, results: any): Promise<void> {
    const normalizedQuery = query.toLowerCase().trim();
    const key = `${CACHE_KEYS.SEARCH}_${normalizedQuery}`;
    await this.set(key, results, CACHE_TTL.SEARCH);
  }

  /**
   * Get cached search results.
   * Validates format and clears old cache if format is incorrect.
   */
  async getSearchResults(query: string): Promise<any | null> {
    const normalizedQuery = query.toLowerCase().trim();
    const key = `${CACHE_KEYS.SEARCH}_${normalizedQuery}`;
    const cached = await this.get(key);
    
    if (!cached) return null;
    
    // Validate the cache format - matches should be an object with live/upcoming/finished
    // If it's an array (old format), clear the cache and return null
    if (cached.matches && Array.isArray(cached.matches)) {
      console.log(`🗑️ Clearing old search cache format for "${query}"`);
      await this.invalidate(key);
      return null;
    }
    
    return cached;
  }

  /**
   * Cache standings for a league.
   */
  async cacheStandings(leagueId: number, season: number, standings: any): Promise<void> {
    const key = `${CACHE_KEYS.STANDINGS}_${leagueId}_${season}`;
    await this.set(key, standings, CACHE_TTL.STANDINGS);
  }

  /**
   * Get cached standings.
   */
  async getStandings(leagueId: number, season: number): Promise<any | null> {
    const key = `${CACHE_KEYS.STANDINGS}_${leagueId}_${season}`;
    return this.get(key);
  }

  /**
   * Cache head-to-head data between two teams.
   */
  async cacheH2H(team1Id: number, team2Id: number, h2hData: any): Promise<void> {
    // Always use smaller ID first for consistent key
    const [id1, id2] = team1Id < team2Id ? [team1Id, team2Id] : [team2Id, team1Id];
    const key = `${CACHE_KEYS.H2H}_${id1}_${id2}`;
    await this.set(key, h2hData, CACHE_TTL.H2H);
  }

  /**
   * Get cached head-to-head data.
   */
  async getH2H(team1Id: number, team2Id: number): Promise<any | null> {
    const [id1, id2] = team1Id < team2Id ? [team1Id, team2Id] : [team2Id, team1Id];
    const key = `${CACHE_KEYS.H2H}_${id1}_${id2}`;
    return this.get(key);
  }

  /**
   * Cache match/fixture data.
   */
  async cacheMatch(fixtureId: number, matchData: any): Promise<void> {
    const key = `${CACHE_KEYS.MATCHES}_${fixtureId}`;
    // Use longer TTL for finished matches
    const ttl = matchData?.fixture?.status?.short === 'FT' 
      ? CACHE_TTL.H2H  // 7 days for finished matches
      : CACHE_TTL.MATCHES; // 30 minutes for live/upcoming
    await this.set(key, matchData, ttl);
  }

  /**
   * Get cached match data.
   */
  async getMatch(fixtureId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.MATCHES}_${fixtureId}`;
    return this.get(key);
  }

  /**
   * Cache matches for a specific date.
   * Past dates are cached for 30 days (matches are finished - permanent).
   * Today's matches are cached for 5 minutes (matches may be live).
   * Future dates are cached for 2 hours.
   */
  async cacheMatchesByDate(dateString: string, matches: any[], ttl?: number): Promise<void> {
    const key = `${CACHE_KEYS.MATCHES_BY_DATE}_${dateString}`;
    
    // Use provided TTL, or determine TTL based on date
    let cacheTTL: number;
    
    if (ttl !== undefined) {
      cacheTTL = ttl;
    } else {
      const today = new Date().toISOString().split('T')[0];
      
      if (dateString < today) {
        // Past dates - permanent cache (matches are finished, never change)
        cacheTTL = Number.MAX_SAFE_INTEGER;
      } else if (dateString === today) {
        // Today - cache for 5 minutes (matches may be live, need frequent updates)
        cacheTTL = 5 * 60 * 1000; // 5 minutes for live data
      } else {
        // Future dates - cache for 3 days (schedule rarely changes)
        cacheTTL = 3 * 24 * 60 * 60 * 1000; // 3 days
      }
    }
    
    await this.set(key, matches, cacheTTL);
  }

  /**
   * Get cached matches for a specific date.
   */
  async getMatchesByDate(dateString: string): Promise<any[] | null> {
    const key = `${CACHE_KEYS.MATCHES_BY_DATE}_${dateString}`;
    return this.get(key);
  }

  /**
   * Batch cache multiple items at once.
   * More efficient than caching one by one.
   */
  async batchCache(items: Array<{ key: string; data: any; ttl?: number }>): Promise<void> {
    try {
      const entries: [string, string][] = items.map(item => {
        const cacheKey = this.getCacheKey(item.key);
        const entry: CacheEntry<any> = {
          data: item.data,
          timestamp: Date.now(),
          ttl: item.ttl || DEFAULT_TTL,
        };
        return [cacheKey, JSON.stringify(entry)];
      });

      await AsyncStorage.multiSet(entries);
      await this.evictIfNeeded();
    } catch (error) {
      console.error('[CacheService] Error in batch cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics for debugging.
   */
  async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    categories: Record<string, number>;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      const now = Date.now();
      let expiredCount = 0;
      const categories: Record<string, number> = {};

      for (const cacheKey of cacheKeys) {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (raw) {
            const entry: CacheEntry<unknown> = JSON.parse(raw);
            const age = now - entry.timestamp;
            
            if (age > entry.ttl) {
              expiredCount++;
            }

            // Count by category
            const keyWithoutPrefix = cacheKey.replace(CACHE_PREFIX, '');
            const category = keyWithoutPrefix.split('_')[0];
            categories[category] = (categories[category] || 0) + 1;
          }
        } catch {
          expiredCount++;
        }
      }

      return {
        totalEntries: cacheKeys.length,
        expiredEntries: expiredCount,
        categories,
      };
    } catch (error) {
      console.error('[CacheService] Error getting stats:', error);
      return { totalEntries: 0, expiredEntries: 0, categories: {} };
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export class for testing purposes
export { CacheService };
