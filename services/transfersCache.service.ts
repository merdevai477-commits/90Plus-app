/**
 * Transfers Cache Service
 * Manages caching of transfers data in AsyncStorage for zero-delay display
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';
import { Transfer } from './apiFootball';

const TRANSFERS_CACHE_PREFIX = '@transfers_cache_';
const CURRENT_SEASON = new Date().getFullYear();

interface CachedTransfers {
  data: Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: Transfer[] }>;
  timestamp: number;
  season: number;
}

/**
 * Get cache key for transfers
 */
const getCacheKey = (season: number, leagueIds: number[]): string => {
  const leaguesKey = leagueIds.length > 0 ? leagueIds.sort().join(',') : 'all';
  return `${TRANSFERS_CACHE_PREFIX}${season}_${leaguesKey}`;
};

/**
 * Get TTL for transfers cache
 * Current season: 7 days
 * Past seasons: 30 days
 */
const getCacheTTL = (season: number): number => {
  const isCurrentSeason = season === CURRENT_SEASON;
  return isCurrentSeason ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
};

export const transfersCacheService = {
  /**
   * Get cached transfers from AsyncStorage
   */
  async getCachedTransfers(
    season: number = CURRENT_SEASON,
    leagueIds: number[] = []
  ): Promise<Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: Transfer[] }> | null> {
    try {
      const cacheKey = getCacheKey(season, leagueIds);
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const parsed: CachedTransfers = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      const ttl = getCacheTTL(parsed.season);

      if (age > ttl) {
        // Cache expired
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      logger.debug(`📦 Transfers cache hit for season ${season}, leagues: ${leagueIds.join(',')}`);
      return parsed.data;
    } catch (error) {
      logger.warn('Error reading transfers cache:', error);
      return null;
    }
  },

  /**
   * Cache transfers in AsyncStorage
   */
  async cacheTransfers(
    transfers: Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: Transfer[] }>,
    season: number = CURRENT_SEASON,
    leagueIds: number[] = []
  ): Promise<void> {
    try {
      const cacheKey = getCacheKey(season, leagueIds);
      const cached: CachedTransfers = {
        data: transfers,
        timestamp: Date.now(),
        season,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
      logger.debug(`💾 Cached ${transfers.length} league transfers for season ${season}`);
    } catch (error) {
      logger.warn('Error caching transfers:', error);
    }
  },

  /**
   * Clear transfers cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const transfersKeys = keys.filter(key => key.startsWith(TRANSFERS_CACHE_PREFIX));
      await AsyncStorage.multiRemove(transfersKeys);
      logger.debug('🗑️ Cleared transfers cache');
    } catch (error) {
      logger.warn('Error clearing transfers cache:', error);
    }
  },

  /**
   * Fetch transfers from backend cached endpoint
   */
  async fetchCachedTransfers(
    season: number = CURRENT_SEASON,
    leagueIds: number[] = [],
    dateRange?: { from: string; to: string }
  ): Promise<Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: Transfer[] }>> {
    try {
      const apiUrl = getApiUrl();
      const params = new URLSearchParams();
      
      if (leagueIds.length > 0) {
        params.append('leagues', leagueIds.join(','));
      }
      params.append('season', season.toString());
      
      if (dateRange) {
        params.append('from', dateRange.from);
        params.append('to', dateRange.to);
      }

      // Try with /api prefix first, fallback to without if 404
      let response = await fetch(`${apiUrl}/api/football/transfers/cached?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // If 404, try without /api prefix
      if (response.status === 404) {
        response = await fetch(`${apiUrl}/football/transfers/cached?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (!response.ok) {
        // If 404, return empty array instead of throwing (endpoint might not be available yet)
        if (response.status === 404) {
          logger.warn('Transfers cached endpoint not available, returning empty array');
          return [];
        }
        throw new Error(`Failed to fetch cached transfers: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'SUCCESS' && result.response) {
        // Cache the result
        await this.cacheTransfers(result.response, season, leagueIds);
        return result.response;
      }

      return [];
    } catch (error) {
      logger.error('Error fetching cached transfers:', error);
      throw error;
    }
  },
};

