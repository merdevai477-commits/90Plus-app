/**
 * Match Archive Service
 * Saves and retrieves finished match details for historical viewing.
 * Stores data locally on device and syncs with backend.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fixture, Lineup, TeamStatistics, FixtureEvent, ApiFootballService } from './apiFootball';

// Storage key prefix for archived matches
const ARCHIVE_PREFIX = '@match_archive_';

import { getApiUrl as getApiBaseUrl } from '../config/api.config';

// Backend API URL from centralized config
const getApiUrl = () => {
  // Remove /api suffix since this service adds it manually
  const baseUrl = getApiBaseUrl();
  return baseUrl.replace(/\/api$/, '');
};

/**
 * Team information for archived match
 */
export interface ArchivedTeam {
  id: number;
  name: string;
  logo: string;
}

/**
 * Player information for lineups
 */
export interface ArchivedPlayer {
  id: number;
  name: string;
  number: number;
  position: string | null;
  photo: string | null;
  grid?: string | null;
}

/**
 * Match statistics
 */
export interface ArchivedStatistics {
  possession?: { home: string | number | null; away: string | number | null };
  shots?: { home: number | null; away: number | null };
  shotsOnTarget?: { home: number | null; away: number | null };
  corners?: { home: number | null; away: number | null };
  fouls?: { home: number | null; away: number | null };
  yellowCards?: { home: number | null; away: number | null };
  redCards?: { home: number | null; away: number | null };
  offsides?: { home: number | null; away: number | null };
  passes?: { home: number | null; away: number | null };
  passAccuracy?: { home: string | number | null; away: string | number | null };
}

/**
 * Match event (goal, card, substitution)
 */
export interface ArchivedEvent {
  id: string;
  type: string;
  detail: string;
  minute: number;
  extraMinute: number | null;
  team: 'home' | 'away';
  player: string;
  assist: string | null;
  comments: string | null;
}

/**
 * Complete archived match data structure
 * Requirement 6.5: Include match date, teams, score, and key statistics
 */
export interface MatchArchive {
  matchId: string;
  fixtureId: number;
  date: Date;
  homeTeam: ArchivedTeam;
  awayTeam: ArchivedTeam;
  score: { home: number; away: number };
  status: 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO';
  league: {
    id: number;
    name: string;
    logo: string;
    country: string;
    round: string;
  };
  venue: {
    name: string | null;
    city: string | null;
  };
  lineups: {
    home: ArchivedPlayer[];
    away: ArchivedPlayer[];
  };
  formations: {
    home: string | null;
    away: string | null;
  };
  statistics: ArchivedStatistics;
  events: ArchivedEvent[];
  archivedAt: Date;
}

/**
 * Convert API fixture to archived match format
 */
function convertFixtureToArchive(
  fixture: Fixture,
  lineups: Lineup[],
  statistics: TeamStatistics[],
  events: FixtureEvent[]
): MatchArchive {
  const homeLineup = lineups.find(l => l.team.id === fixture.teams.home.id);
  const awayLineup = lineups.find(l => l.team.id === fixture.teams.away.id);
  const homeStats = statistics.find(s => s.team.id === fixture.teams.home.id);
  const awayStats = statistics.find(s => s.team.id === fixture.teams.away.id);

  // Helper to get stat value
  const getStat = (stats: TeamStatistics | undefined, type: string): number | string | null => {
    if (!stats) return null;
    const stat = stats.statistics.find(s => s.type === type);
    return stat?.value ?? null;
  };

  // Convert events to archived format
  const archivedEvents: ArchivedEvent[] = events.map((event, index) => ({
    id: `${fixture.fixture.id}_${index}`,
    type: event.type,
    detail: event.detail,
    minute: event.time.elapsed,
    extraMinute: event.time.extra,
    team: event.team.id === fixture.teams.home.id ? 'home' : 'away',
    player: event.player.name,
    assist: event.assist.name,
    comments: event.comments,
  }));

  // Convert lineups to archived format
  const convertPlayers = (lineup: Lineup | undefined): ArchivedPlayer[] => {
    if (!lineup) return [];
    return lineup.startXI.map(p => ({
      id: p.player.id,
      name: p.player.name,
      number: p.player.number,
      position: p.player.pos,
      photo: p.player.photo,
      grid: p.player.grid,
    }));
  };

  return {
    matchId: `match_${fixture.fixture.id}`,
    fixtureId: fixture.fixture.id,
    date: new Date(fixture.fixture.date),
    homeTeam: {
      id: fixture.teams.home.id,
      name: fixture.teams.home.name,
      logo: fixture.teams.home.logo,
    },
    awayTeam: {
      id: fixture.teams.away.id,
      name: fixture.teams.away.name,
      logo: fixture.teams.away.logo,
    },
    score: {
      home: fixture.goals.home ?? 0,
      away: fixture.goals.away ?? 0,
    },
    status: fixture.fixture.status.short as MatchArchive['status'],
    league: {
      id: fixture.league.id,
      name: fixture.league.name,
      logo: fixture.league.logo,
      country: fixture.league.country,
      round: fixture.league.round,
    },
    venue: {
      name: fixture.fixture.venue.name,
      city: fixture.fixture.venue.city,
    },
    lineups: {
      home: convertPlayers(homeLineup),
      away: convertPlayers(awayLineup),
    },
    formations: {
      home: homeLineup?.formation ?? null,
      away: awayLineup?.formation ?? null,
    },
    statistics: {
      possession: {
        home: getStat(homeStats, 'Ball Possession'),
        away: getStat(awayStats, 'Ball Possession'),
      },
      shots: {
        home: getStat(homeStats, 'Total Shots') as number | null,
        away: getStat(awayStats, 'Total Shots') as number | null,
      },
      shotsOnTarget: {
        home: getStat(homeStats, 'Shots on Goal') as number | null,
        away: getStat(awayStats, 'Shots on Goal') as number | null,
      },
      corners: {
        home: getStat(homeStats, 'Corner Kicks') as number | null,
        away: getStat(awayStats, 'Corner Kicks') as number | null,
      },
      fouls: {
        home: getStat(homeStats, 'Fouls') as number | null,
        away: getStat(awayStats, 'Fouls') as number | null,
      },
      yellowCards: {
        home: getStat(homeStats, 'Yellow Cards') as number | null,
        away: getStat(awayStats, 'Yellow Cards') as number | null,
      },
      redCards: {
        home: getStat(homeStats, 'Red Cards') as number | null,
        away: getStat(awayStats, 'Red Cards') as number | null,
      },
      offsides: {
        home: getStat(homeStats, 'Offsides') as number | null,
        away: getStat(awayStats, 'Offsides') as number | null,
      },
      passes: {
        home: getStat(homeStats, 'Total passes') as number | null,
        away: getStat(awayStats, 'Total passes') as number | null,
      },
      passAccuracy: {
        home: getStat(homeStats, 'Passes %'),
        away: getStat(awayStats, 'Passes %'),
      },
    },
    events: archivedEvents,
    archivedAt: new Date(),
  };
}

/**
 * Get the storage key for a match archive
 */
function getArchiveKey(matchId: string): string {
  return `${ARCHIVE_PREFIX}${matchId}`;
}

class MatchArchiveService {
  /**
   * Archive a finished match with all its details.
   * Stores to both local AsyncStorage and backend.
   * 
   * Requirement 6.1: Save all match details including result, lineups, and statistics
   * Requirement 6.2: Store locally on device and on backend
   */
  async archiveMatch(fixtureId: number): Promise<MatchArchive | null> {
    try {
      // Fetch all match details from API
      const [fixture, lineups, statistics, events] = await Promise.all([
        ApiFootballService.getFixtureById(fixtureId),
        ApiFootballService.getFixtureLineups(fixtureId),
        ApiFootballService.getFixtureStatistics(fixtureId),
        ApiFootballService.getFixtureEvents(fixtureId),
      ]);

      if (!fixture) {
        console.error(`[MatchArchiveService] Fixture ${fixtureId} not found`);
        return null;
      }

      // Check if match is finished
      const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];
      if (!finishedStatuses.includes(fixture.fixture.status.short)) {
        console.warn(`[MatchArchiveService] Match ${fixtureId} is not finished (status: ${fixture.fixture.status.short})`);
        return null;
      }

      // Convert to archive format
      const archive = convertFixtureToArchive(fixture, lineups, statistics, events);

      // ✅ Save to local storage
      await this.saveToLocalStorage(archive);

      // ✅ Store in offlineDataService for permanent access (no token needed)
      const { offlineDataService } = await import('./offlineDataService');
      await offlineDataService.storeFinishedMatch(fixtureId, {
        fixture: fixture.fixture,
        lineups,
        statistics,
        events,
        teams: fixture.teams,
        league: fixture.league,
        goals: fixture.goals,
        score: fixture.score,
      });

      // Save to backend (fire and forget, don't block on this)
      this.saveToBackend(archive).catch(error => {
        console.error('[MatchArchiveService] Failed to save to backend:', error);
      });

      console.log(`[MatchArchiveService] Archived match ${archive.matchId}`);
      return archive;
    } catch (error) {
      console.error('[MatchArchiveService] Error archiving match:', error);
      throw error;
    }
  }

  /**
   * Archive a match from pre-fetched data (useful when data is already available)
   */
  async archiveMatchFromData(
    fixture: Fixture,
    lineups: Lineup[],
    statistics: TeamStatistics[],
    events: FixtureEvent[]
  ): Promise<MatchArchive> {
    const archive = convertFixtureToArchive(fixture, lineups, statistics, events);

    // ✅ Save to local storage
    await this.saveToLocalStorage(archive);

    // ✅ Store in offlineDataService for permanent access (no token needed)
    const { offlineDataService } = await import('./offlineDataService');
    await offlineDataService.storeFinishedMatch(fixture.fixture.id, {
      fixture: fixture.fixture,
      lineups,
      statistics,
      events,
      teams: fixture.teams,
      league: fixture.league,
      goals: fixture.goals,
      score: fixture.score,
    });

    // Save to backend (fire and forget)
    this.saveToBackend(archive).catch(error => {
      console.error('[MatchArchiveService] Failed to save to backend:', error);
    });

    console.log(`[MatchArchiveService] Archived match ${archive.matchId} from data`);
    return archive;
  }

  /**
   * Save archive to local AsyncStorage
   */
  private async saveToLocalStorage(archive: MatchArchive): Promise<void> {
    try {
      const key = getArchiveKey(archive.matchId);
      const data = JSON.stringify({
        ...archive,
        date: archive.date.toISOString(),
        archivedAt: archive.archivedAt.toISOString(),
      });
      await AsyncStorage.setItem(key, data);
    } catch (error) {
      console.error('[MatchArchiveService] Error saving to local storage:', error);
      throw error;
    }
  }

  /**
   * Save archive to backend shared cache
   */
  private async saveToBackend(archive: MatchArchive): Promise<void> {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/matches/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...archive,
          date: archive.date.toISOString(),
          archivedAt: archive.archivedAt.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
    } catch (error) {
      // Log but don't throw - backend save is best-effort
      console.warn('[MatchArchiveService] Backend save failed:', error);
    }
  }

  /**
   * Get an archived match by ID.
   * Checks local storage first, then backend.
   * 
   * Requirement 6.3: Serve from local storage first
   * Requirement 6.4: Fetch from backend if not found locally
   */
  async getArchivedMatch(matchId: string): Promise<MatchArchive | null> {
    // Try local storage first
    const localArchive = await this.getFromLocalStorage(matchId);
    if (localArchive) {
      return localArchive;
    }

    // Try backend
    const backendArchive = await this.getFromBackend(matchId);
    if (backendArchive) {
      // Cache locally for future access
      await this.saveToLocalStorage(backendArchive);
      return backendArchive;
    }

    return null;
  }

  /**
   * Get archive from local storage
   */
  private async getFromLocalStorage(matchId: string): Promise<MatchArchive | null> {
    try {
      const key = getArchiveKey(matchId);
      const raw = await AsyncStorage.getItem(key);
      
      if (!raw) {
        return null;
      }

      const data = JSON.parse(raw);
      return {
        ...data,
        date: new Date(data.date),
        archivedAt: new Date(data.archivedAt),
      };
    } catch (error) {
      console.error('[MatchArchiveService] Error reading from local storage:', error);
      return null;
    }
  }

  /**
   * Get archive from backend
   */
  private async getFromBackend(matchId: string): Promise<MatchArchive | null> {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/matches/archive/${matchId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();
      return {
        ...data,
        date: new Date(data.date),
        archivedAt: new Date(data.archivedAt),
      };
    } catch (error) {
      console.warn('[MatchArchiveService] Backend fetch failed:', error);
      return null;
    }
  }

  /**
   * Get all archived matches within a date range
   */
  async getArchivedMatches(startDate: Date, endDate: Date): Promise<MatchArchive[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const archiveKeys = allKeys.filter(key => key.startsWith(ARCHIVE_PREFIX));
      
      const archives: MatchArchive[] = [];
      
      for (const key of archiveKeys) {
        const archive = await this.getFromLocalStorage(key.replace(ARCHIVE_PREFIX, ''));
        if (archive) {
          const matchDate = new Date(archive.date);
          if (matchDate >= startDate && matchDate <= endDate) {
            archives.push(archive);
          }
        }
      }

      // Sort by date descending (most recent first)
      archives.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return archives;
    } catch (error) {
      console.error('[MatchArchiveService] Error getting archived matches:', error);
      return [];
    }
  }

  /**
   * Check if a match is archived locally
   */
  async isArchivedLocally(matchId: string): Promise<boolean> {
    try {
      const key = getArchiveKey(matchId);
      const raw = await AsyncStorage.getItem(key);
      return raw !== null;
    } catch (error) {
      console.error('[MatchArchiveService] Error checking archive:', error);
      return false;
    }
  }

  /**
   * Delete a local archive
   */
  async deleteLocalArchive(matchId: string): Promise<void> {
    try {
      const key = getArchiveKey(matchId);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[MatchArchiveService] Error deleting archive:', error);
      throw error;
    }
  }

  /**
   * Get all local archive keys
   */
  async getAllLocalArchiveIds(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter(key => key.startsWith(ARCHIVE_PREFIX))
        .map(key => key.replace(ARCHIVE_PREFIX, ''));
    } catch (error) {
      console.error('[MatchArchiveService] Error getting archive IDs:', error);
      return [];
    }
  }

  /**
   * Clear all local archives
   */
  async clearAllLocalArchives(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const archiveKeys = allKeys.filter(key => key.startsWith(ARCHIVE_PREFIX));
      
      if (archiveKeys.length > 0) {
        await AsyncStorage.multiRemove(archiveKeys);
        console.log(`[MatchArchiveService] Cleared ${archiveKeys.length} local archives`);
      }
    } catch (error) {
      console.error('[MatchArchiveService] Error clearing archives:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const matchArchiveService = new MatchArchiveService();

// Export class for testing
export { MatchArchiveService };
