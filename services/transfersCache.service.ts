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
 * Empty array means all leagues (كل الدوريات)
 */
const getCacheKey = (season: number, leagueIds: number[]): string => {
  const leaguesKey = leagueIds.length > 0 ? leagueIds.sort().join(',') : 'all';
  return `${TRANSFERS_CACHE_PREFIX}${season}_${leaguesKey}`;
};

/**
 * Get TTL for transfers cache
 * Current season: 7 days
 * Past seasons: Permanent (مدى الحياة) - never expires
 */
const getCacheTTL = (season: number): number => {
  const isCurrentSeason = season === CURRENT_SEASON;
  // Past seasons are permanent (مدى الحياة) - never expire
  return isCurrentSeason ? 7 * 24 * 60 * 60 * 1000 : Number.MAX_SAFE_INTEGER;
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
      
      // If leagueIds is empty, don't send leagues parameter (means all leagues - كل الدوريات)
      if (leagueIds.length > 0) {
        params.append('leagues', leagueIds.join(','));
      }
      // Season is optional - if not provided, get from all seasons
      if (season) {
        params.append('season', season.toString());
      }
      
      if (dateRange) {
        params.append('from', dateRange.from);
        params.append('to', dateRange.to);
      }

      // Build URL - getApiUrl() already includes /api, so we don't add it again
      // apiUrl format: https://domain.com/api or http://localhost:3000/api
      // We need: https://domain.com/api/football/transfers/cached
      let url: string;
      if (apiUrl.endsWith('/api')) {
        // apiUrl already ends with /api, just append the path
        url = `${apiUrl}/football/transfers/cached`;
      } else {
        // apiUrl doesn't have /api, add it
        url = `${apiUrl}/api/football/transfers/cached`;
      }
      
      const fullUrl = `${url}?${params.toString()}`;
      logger.debug(`📡 Fetching transfers from: ${fullUrl}`);
      
      let response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // If 404, try alternative URL format (without /api prefix)
      if (response.status === 404) {
        const altUrl = apiUrl.endsWith('/api')
          ? `${apiUrl.replace(/\/api$/, '')}/football/transfers/cached`
          : `${apiUrl}/football/transfers/cached`;
        logger.debug(`📡 Trying alternative URL (without /api): ${altUrl}`);
        response = await fetch(`${altUrl}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (!response.ok) {
        // If 404, try fallback to /by-leagues endpoint to fetch from API
        if (response.status === 404) {
          logger.warn(`⚠️ Transfers cached endpoint not available (404), trying /by-leagues as fallback...`);
          return await this.fetchTransfersFromAPI(leagueIds, dateRange, season);
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error(`❌ Failed to fetch cached transfers: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch cached transfers: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      logger.debug(`📡 Backend response - Status: ${result.status}, Leagues: ${result.leagues || 0}, Results: ${result.results || 0}`);
      
      if (result.status === 'SUCCESS' && result.response) {
        // If database is empty, fetch from API as fallback
        if (result.results === 0 || result.leagues === 0) {
          logger.warn(`⚠️ Database is empty (0 transfers), fetching from API as fallback...`);
          return await this.fetchTransfersFromAPI(leagueIds, dateRange, season);
        }
        
        logger.debug(`✅ Successfully fetched ${result.response.length} leagues with transfers`);
        // Cache the result
        await this.cacheTransfers(result.response, season, leagueIds);
        return result.response;
      }

      logger.warn(`⚠️ Backend returned empty or invalid response, trying API fallback...`);
      return await this.fetchTransfersFromAPI(leagueIds, dateRange, season);
    } catch (error) {
      logger.error('Error fetching cached transfers:', error);
      throw error;
    }
  },

  /**
   * Fetch transfers from API endpoint (/by-leagues) as fallback
   * This endpoint fetches from API and saves to database
   */
  async fetchTransfersFromAPI(
    leagueIds: number[] = [],
    dateRange?: { from: string; to: string },
    season?: number
  ): Promise<Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: Transfer[] }>> {
    try {
      const apiUrl = getApiUrl();
      const params = new URLSearchParams();
      
      // If leagueIds is empty, don't send leagues parameter (means all leagues)
      if (leagueIds.length > 0) {
        params.append('leagues', leagueIds.join(','));
      }
      
      if (dateRange) {
        params.append('from', dateRange.from);
        params.append('to', dateRange.to);
      }

      // Build URL - getApiUrl() already includes /api, so we don't add it again
      let url: string;
      if (apiUrl.endsWith('/api')) {
        // apiUrl already ends with /api, just append the path
        url = `${apiUrl}/football/transfers/by-leagues`;
      } else {
        // apiUrl doesn't have /api, add it
        url = `${apiUrl}/api/football/transfers/by-leagues`;
      }
      
      const fullUrl = `${url}?${params.toString()}`;
      logger.debug(`📡 Fetching transfers from API endpoint: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error(`❌ Failed to fetch transfers from API: ${response.status} - ${errorText}`);
        return [];
      }

      const result = await response.json();
      
      logger.debug(`📡 API response - Status: ${result.status}, Leagues: ${result.leagues || 0}, Results: ${result.results || 0}`);
      
      if (result.status === 'SUCCESS' && result.response) {
        logger.debug(`✅ Successfully fetched ${result.response.length} leagues with transfers from API`);
        // Cache the result (API endpoint saves to database automatically)
        if (season) {
          await this.cacheTransfers(result.response, season, leagueIds);
        }
        return result.response;
      }

      logger.warn(`⚠️ API returned empty or invalid response`);
      return [];
    } catch (error) {
      logger.error('Error fetching transfers from API:', error);
      return [];
    }
  },
};

