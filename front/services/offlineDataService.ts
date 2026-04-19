/**
 * Offline Data Service
 * 
 * Comprehensive local storage for ALL API data:
 * - Club logos (permanent)
 * - Player data (permanent)
 * - Finished matches with lineups (permanent)
 * - Team data (permanent)
 * - League data (permanent)
 * 
 * Benefits:
 * 1. Works without token (all data is public/shared)
 * 2. Instant access (no API calls needed)
 * 3. Offline-capable
 * 4. Shared across all users
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheService, CACHE_TTL } from './cacheService';
import { logger } from '../utils/logger';

const OFFLINE_PREFIX = '@offline_';
const PERMANENT_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year (effectively permanent)

interface OfflineDataEntry<T> {
  data: T;
  timestamp: number;
  source: 'api' | 'backend';
}

class OfflineDataService {
  /**
   * Store club logo permanently
   */
  async storeClubLogo(apiId: number, logoUrl: string): Promise<void> {
    try {
      const key = `${OFFLINE_PREFIX}club_logo_${apiId}`;
      const entry: OfflineDataEntry<string> = {
        data: logoUrl,
        timestamp: Date.now(),
        source: 'api',
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
      // Also store in cacheService for compatibility
      await cacheService.set(`club_logo_${apiId}`, logoUrl, CACHE_TTL.LOGOS);
    } catch (error) {
      logger.error(`Failed to store club logo ${apiId}:`, error);
    }
  }

  /**
   * Get club logo from offline storage
   */
  async getClubLogo(apiId: number): Promise<string | null> {
    try {
      const key = `${OFFLINE_PREFIX}club_logo_${apiId}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const entry: OfflineDataEntry<string> = JSON.parse(raw);
        return entry.data;
      }
      
      // Fallback to cacheService
      return await cacheService.get<string>(`club_logo_${apiId}`);
    } catch (error) {
      logger.error(`Failed to get club logo ${apiId}:`, error);
      return null;
    }
  }

  /**
   * Store player data permanently
   */
  async storePlayerData(playerId: number, playerData: any): Promise<void> {
    try {
      const key = `${OFFLINE_PREFIX}player_${playerId}`;
      const entry: OfflineDataEntry<any> = {
        data: playerData,
        timestamp: Date.now(),
        source: 'api',
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
      // Also store in cacheService
      await cacheService.cachePlayer(playerId, playerData);
    } catch (error) {
      logger.error(`Failed to store player data ${playerId}:`, error);
    }
  }

  /**
   * Search matches offline
   */
  async searchMatches(query: string): Promise<{ live: any[]; upcoming: any[]; finished: any[] }> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      const results = { live: [], upcoming: [], finished: [] };
      
      // TODO: Implement actual offline search logic here if needed
      // For now, return empty as we rely on API search
      
      return results;
    } catch (error) {
      logger.error('Failed to search matches offline:', error);
      return { live: [], upcoming: [], finished: [] };
    }
  }
  /**
   * Get player data from offline storage
   */
  async getPlayerData(playerId: number): Promise<any | null> {
    try {
      const key = `${OFFLINE_PREFIX}player_${playerId}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const entry: OfflineDataEntry<any> = JSON.parse(raw);
        return entry.data;
      }
      
      // Fallback to cacheService
      return await cacheService.getPlayer(playerId);
    } catch (error) {
      logger.error(`Failed to get player data ${playerId}:`, error);
      return null;
    }
  }

  /**
   * Store finished match with full details (lineups, stats, events)
   */
  async storeFinishedMatch(fixtureId: number, matchData: {
    fixture: any;
    lineups?: any[];
    statistics?: any[];
    events?: any[];
    teams: any;
    league: any;
    goals: any;
    score: any;
  }): Promise<void> {
    try {
      const key = `${OFFLINE_PREFIX}match_${fixtureId}`;
      const entry: OfflineDataEntry<any> = {
        data: matchData,
        timestamp: Date.now(),
        source: 'api',
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
      // Also store in cacheService with permanent TTL
      await cacheService.cacheMatch(fixtureId, matchData);
    } catch (error) {
      logger.error(`Failed to store match ${fixtureId}:`, error);
    }
  }

  /**
   * Store search results permanently
   */
  async storeSearchResults(query: string, results: {
    players: any[];
    teams: any[];
    leagues: any[];
    matches: {
      live: any[];
      upcoming: any[];
      finished: any[];
    };
  }): Promise<void> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      const key = `${OFFLINE_PREFIX}search_${normalizedQuery}`;
      const entry: OfflineDataEntry<typeof results> = {
        data: results,
        timestamp: Date.now(),
        source: 'api',
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
      // Also store in cacheService for fast access
      await cacheService.set(`search_${normalizedQuery}`, results, CACHE_TTL.SEARCH);
      
      logger.debug(`💾 Stored search results for "${query}" permanently`);
    } catch (error) {
      logger.error(`Failed to store search results for "${query}":`, error);
    }
  }

  /**
   * Get search results from offline storage
   */
  async getSearchResults(query: string): Promise<{
    players: any[];
    teams: any[];
    leagues: any[];
    matches: {
      live: any[];
      upcoming: any[];
      finished: any[];
    };
  } | null> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      const key = `${OFFLINE_PREFIX}search_${normalizedQuery}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const entry: OfflineDataEntry<{
          players: any[];
          teams: any[];
          leagues: any[];
          matches: {
            live: any[];
            upcoming: any[];
            finished: any[];
          };
        }> = JSON.parse(raw);
        logger.debug(`📦 Search results for "${query}" from offline storage`);
        return entry.data;
      }
      
      // Fallback to cacheService
      return await cacheService.get(`search_${normalizedQuery}`);
    } catch (error) {
      logger.error(`Failed to get search results for "${query}":`, error);
      return null;
    }
  }

  /**
   * Get finished match from offline storage
   */
  async getFinishedMatch(fixtureId: number): Promise<any | null> {
    try {
      const key = `${OFFLINE_PREFIX}match_${fixtureId}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const entry: OfflineDataEntry<any> = JSON.parse(raw);
        return entry.data;
      }
      
      // Fallback to cacheService
      return await cacheService.getMatch(fixtureId);
    } catch (error) {
      logger.error(`Failed to get match ${fixtureId}:`, error);
      return null;
    }
  }

  /**
   * Store team data permanently
   */
  async storeTeamData(teamId: number, teamData: any): Promise<void> {
    try {
      const key = `${OFFLINE_PREFIX}team_${teamId}`;
      const entry: OfflineDataEntry<any> = {
        data: teamData,
        timestamp: Date.now(),
        source: 'api',
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
      // Also store in cacheService
      await cacheService.cacheTeam(teamId, teamData);
    } catch (error) {
      logger.error(`Failed to store team data ${teamId}:`, error);
    }
  }

  /**
   * Get team data from offline storage
   */
  async getTeamData(teamId: number): Promise<any | null> {
    try {
      const key = `${OFFLINE_PREFIX}team_${teamId}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const entry: OfflineDataEntry<any> = JSON.parse(raw);
        return entry.data;
      }
      
      // Fallback to cacheService
      return await cacheService.getTeam(teamId);
    } catch (error) {
      logger.error(`Failed to get team data ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Store league data permanently
   */
  async storeLeagueData(leagueId: number, leagueData: any): Promise<void> {
    try {
      const key = `${OFFLINE_PREFIX}league_${leagueId}`;
      const entry: OfflineDataEntry<any> = {
        data: leagueData,
        timestamp: Date.now(),
        source: 'api',
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
      // Also store in cacheService
      await cacheService.cacheLeague(leagueId, leagueData);
    } catch (error) {
      logger.error(`Failed to store league data ${leagueId}:`, error);
    }
  }

  /**
   * Get league data from offline storage
   */
  async getLeagueData(leagueId: number): Promise<any | null> {
    try {
      const key = `${OFFLINE_PREFIX}league_${leagueId}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const entry: OfflineDataEntry<any> = JSON.parse(raw);
        return entry.data;
      }
      
      // Fallback to cacheService
      return await cacheService.getLeague(leagueId);
    } catch (error) {
      logger.error(`Failed to get league data ${leagueId}:`, error);
      return null;
    }
  }

  /**
   * Batch store multiple items (more efficient)
   */
  async batchStore(items: Array<{
    type: 'club_logo' | 'player' | 'match' | 'team' | 'league';
    id: number;
    data: any;
  }>): Promise<void> {
    try {
      const entries: [string, string][] = items.map(item => {
        const key = `${OFFLINE_PREFIX}${item.type}_${item.id}`;
        const entry: OfflineDataEntry<any> = {
          data: item.data,
          timestamp: Date.now(),
          source: 'api',
        };
        return [key, JSON.stringify(entry)];
      });

      await AsyncStorage.multiSet(entries);
    } catch (error) {
      logger.error('Failed to batch store offline data:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    clubLogos: number;
    players: number;
    matches: number;
    teams: number;
    leagues: number;
    totalSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const offlineKeys = allKeys.filter(key => key.startsWith(OFFLINE_PREFIX));

      const stats = {
        clubLogos: 0,
        players: 0,
        matches: 0,
        teams: 0,
        leagues: 0,
        totalSize: 0,
      };

      for (const key of offlineKeys) {
        if (key.includes('club_logo')) stats.clubLogos++;
        else if (key.includes('player_')) stats.players++;
        else if (key.includes('match_')) stats.matches++;
        else if (key.includes('team_')) stats.teams++;
        else if (key.includes('league_')) stats.leagues++;

        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          stats.totalSize += raw.length;
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get offline data stats:', error);
      return {
        clubLogos: 0,
        players: 0,
        matches: 0,
        teams: 0,
        leagues: 0,
        totalSize: 0,
      };
    }
  }

  /**
   * Clear all offline data (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const offlineKeys = allKeys.filter(key => key.startsWith(OFFLINE_PREFIX));
      
      if (offlineKeys.length > 0) {
        await AsyncStorage.multiRemove(offlineKeys);
        logger.info(`Cleared ${offlineKeys.length} offline data entries`);
      }
    } catch (error) {
      logger.error('Failed to clear offline data:', error);
    }
  }
}

export const offlineDataService = new OfflineDataService();

