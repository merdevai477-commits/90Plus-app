/**
 * Football Data Cache Service
 * 
 * Provides intelligent caching for football data (teams, players, matches, etc.)
 * All data is cached locally so users can find previously viewed items instantly.
 * 
 * Features:
 * - Long-term caching for static data (teams, leagues, logos)
 * - Smart caching for dynamic data (matches, standings)
 * - Search history caching
 * - Offline support for cached data
 */

import { cacheService, CACHE_TTL, CACHE_KEYS } from './cacheService';
import { Image } from 'expo-image';

// Types for football data
export interface Team {
  id: number;
  name: string;
  logo: string;
  country?: string;
  founded?: number;
  venue?: {
    name: string;
    city: string;
    capacity: number;
    image: string;
  };
}

export interface Player {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  photo: string;
  age?: number;
  nationality?: string;
  position?: string;
  team?: Team;
}

export interface League {
  id: number;
  name: string;
  logo: string;
  country: string;
  flag?: string;
  season?: number;
}

export interface Match {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      long: string;
    };
  };
  teams: {
    home: Team;
    away: Team;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  league: League;
}

class FootballCacheService {
  /**
   * Cache team data and prefetch logo
   */
  async cacheTeam(team: Team): Promise<void> {
    if (!team?.id) return;
    
    await cacheService.cacheTeam(team.id, team);
    
    // Prefetch team logo for instant display
    if (team.logo) {
      this.prefetchImage(team.logo);
    }
  }

  /**
   * Get cached team or fetch from API
   */
  async getTeam(teamId: number, fetchFn?: () => Promise<Team | null>): Promise<Team | null> {
    // Try cache first
    const cached = await cacheService.getTeam(teamId);
    if (cached) return cached;

    // Fetch if not cached and fetchFn provided
    if (fetchFn) {
      const team = await fetchFn();
      if (team) {
        await this.cacheTeam(team);
      }
      return team;
    }

    return null;
  }

  /**
   * Cache player data and prefetch photo
   */
  async cachePlayer(player: Player): Promise<void> {
    if (!player?.id) return;
    
    await cacheService.cachePlayer(player.id, player);
    
    // Prefetch player photo
    if (player.photo) {
      this.prefetchImage(player.photo);
    }
  }

  /**
   * Get cached player or fetch from API
   */
  async getPlayer(playerId: number, fetchFn?: () => Promise<Player | null>): Promise<Player | null> {
    const cached = await cacheService.getPlayer(playerId);
    if (cached) return cached;

    if (fetchFn) {
      const player = await fetchFn();
      if (player) {
        await this.cachePlayer(player);
      }
      return player;
    }

    return null;
  }

  /**
   * Cache league data and prefetch logo
   */
  async cacheLeague(league: League): Promise<void> {
    if (!league?.id) return;
    
    await cacheService.cacheLeague(league.id, league);
    
    if (league.logo) {
      this.prefetchImage(league.logo);
    }
  }

  /**
   * Get cached league or fetch from API
   */
  async getLeague(leagueId: number, fetchFn?: () => Promise<League | null>): Promise<League | null> {
    const cached = await cacheService.getLeague(leagueId);
    if (cached) return cached;

    if (fetchFn) {
      const league = await fetchFn();
      if (league) {
        await this.cacheLeague(league);
      }
      return league;
    }

    return null;
  }

  /**
   * Cache match data and related teams
   */
  async cacheMatch(match: Match): Promise<void> {
    if (!match?.fixture?.id) return;
    
    await cacheService.cacheMatch(match.fixture.id, match);
    
    // Also cache the teams from this match
    if (match.teams?.home) {
      await this.cacheTeam(match.teams.home);
    }
    if (match.teams?.away) {
      await this.cacheTeam(match.teams.away);
    }
    if (match.league) {
      await this.cacheLeague(match.league);
    }
  }

  /**
   * Cache multiple matches at once (more efficient)
   */
  async cacheMatches(matches: Match[]): Promise<void> {
    if (!matches?.length) return;

    // Collect all unique teams and leagues
    const teams = new Map<number, Team>();
    const leagues = new Map<number, League>();
    const imagesToPrefetch: string[] = [];

    for (const match of matches) {
      if (match.teams?.home) {
        teams.set(match.teams.home.id, match.teams.home);
        if (match.teams.home.logo) imagesToPrefetch.push(match.teams.home.logo);
      }
      if (match.teams?.away) {
        teams.set(match.teams.away.id, match.teams.away);
        if (match.teams.away.logo) imagesToPrefetch.push(match.teams.away.logo);
      }
      if (match.league) {
        leagues.set(match.league.id, match.league);
        if (match.league.logo) imagesToPrefetch.push(match.league.logo);
      }
    }

    // Batch cache all items
    const cacheItems: Array<{ key: string; data: any; ttl?: number }> = [];

    // Add matches
    for (const match of matches) {
      if (match.fixture?.id) {
        const isFinished = match.fixture.status?.short === 'FT';
        cacheItems.push({
          key: `${CACHE_KEYS.MATCHES}_${match.fixture.id}`,
          data: match,
          ttl: isFinished ? CACHE_TTL.H2H : CACHE_TTL.MATCHES,
        });
      }
    }

    // Add teams
    for (const [id, team] of teams) {
      cacheItems.push({
        key: `${CACHE_KEYS.TEAMS}_${id}`,
        data: team,
        ttl: CACHE_TTL.TEAMS,
      });
    }

    // Add leagues
    for (const [id, league] of leagues) {
      cacheItems.push({
        key: `${CACHE_KEYS.LEAGUES}_${id}`,
        data: league,
        ttl: CACHE_TTL.LEAGUES,
      });
    }

    // Batch save to cache
    await cacheService.batchCache(cacheItems);

    // Prefetch all images in background
    this.prefetchImages(imagesToPrefetch);
  }

  /**
   * Get cached match
   */
  async getMatch(fixtureId: number): Promise<Match | null> {
    return cacheService.getMatch(fixtureId);
  }

  /**
   * Cache search results for instant retrieval
   */
  async cacheSearchResults(query: string, results: any): Promise<void> {
    await cacheService.cacheSearchResults(query, results);
    
    // Also cache individual items from search results
    if (results?.teams) {
      for (const team of results.teams) {
        await this.cacheTeam(team);
      }
    }
    if (results?.players) {
      for (const player of results.players) {
        await this.cachePlayer(player);
      }
    }
    if (results?.leagues) {
      for (const league of results.leagues) {
        await this.cacheLeague(league);
      }
    }
  }

  /**
   * Get cached search results
   * Validates format and returns null if old format detected
   */
  async getSearchResults(query: string): Promise<any | null> {
    const cached = await cacheService.getSearchResults(query);
    
    if (!cached) return null;
    
    // Double-check format validation - matches should be an object, not array
    if (cached.matches && Array.isArray(cached.matches)) {
      console.log(`🗑️ footballCacheService: Old format detected for "${query}"`);
      return null;
    }
    
    // Ensure matches has the correct structure
    if (cached.matches && typeof cached.matches === 'object') {
      cached.matches = {
        live: Array.isArray(cached.matches.live) ? cached.matches.live : [],
        upcoming: Array.isArray(cached.matches.upcoming) ? cached.matches.upcoming : [],
        finished: Array.isArray(cached.matches.finished) ? cached.matches.finished : [],
      };
    } else {
      cached.matches = { live: [], upcoming: [], finished: [] };
    }
    
    return cached;
  }

  /**
   * Cache standings data
   */
  async cacheStandings(leagueId: number, season: number, standings: any): Promise<void> {
    await cacheService.cacheStandings(leagueId, season, standings);
    
    // Cache teams from standings
    if (standings?.length) {
      for (const standing of standings) {
        if (standing.team) {
          await this.cacheTeam(standing.team);
        }
      }
    }
  }

  /**
   * Get cached standings
   */
  async getStandings(leagueId: number, season: number): Promise<any | null> {
    return cacheService.getStandings(leagueId, season);
  }

  async invalidateStandings(leagueId: number, season: number): Promise<void> {
    const key = `standings_${leagueId}_${season}`;
    await cacheService.invalidate(key);
  }

  /**
   * Cache head-to-head data
   */
  async cacheH2H(team1Id: number, team2Id: number, h2hData: any): Promise<void> {
    await cacheService.cacheH2H(team1Id, team2Id, h2hData);
    
    // Cache matches from H2H
    if (h2hData?.matches) {
      await this.cacheMatches(h2hData.matches);
    }
  }

  /**
   * Get cached H2H data
   */
  async getH2H(team1Id: number, team2Id: number): Promise<any | null> {
    return cacheService.getH2H(team1Id, team2Id);
  }

  /**
   * Prefetch a single image for instant display later
   */
  private prefetchImage(url: string): void {
    if (!url) return;
    
    Image.prefetch(url).catch(() => {
      // Silently fail - image will be loaded on demand
    });
  }

  /**
   * Prefetch multiple images in background
   */
  private prefetchImages(urls: string[]): void {
    const validUrls = urls.filter(url => url && url.length > 0);
    if (validUrls.length === 0) return;

    // Prefetch in batches to avoid overwhelming the network
    const batchSize = 10;
    for (let i = 0; i < validUrls.length; i += batchSize) {
      const batch = validUrls.slice(i, i + batchSize);
      Image.prefetch(batch).catch(() => {
        // Silently fail
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    categories: Record<string, number>;
  }> {
    return cacheService.getStats();
  }

  /**
   * Clear all football-related cache
   */
  async clearFootballCache(): Promise<void> {
    const keys = await cacheService.getKeys();
    const footballKeys = keys.filter(key => 
      key.startsWith(CACHE_KEYS.TEAMS) ||
      key.startsWith(CACHE_KEYS.PLAYERS) ||
      key.startsWith(CACHE_KEYS.LEAGUES) ||
      key.startsWith(CACHE_KEYS.MATCHES) ||
      key.startsWith(CACHE_KEYS.SEARCH) ||
      key.startsWith(CACHE_KEYS.STANDINGS) ||
      key.startsWith(CACHE_KEYS.H2H)
    );

    for (const key of footballKeys) {
      await cacheService.invalidate(key);
    }
  }
}

// Export singleton instance
export const footballCacheService = new FootballCacheService();
