/**
 * Football Background Service
 * Automatically updates frequently accessed data in the background
 * This reduces API calls during peak usage times
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import { getRedisClient } from '../lib/redis';

// Major leagues that need frequent updates
const MAJOR_LEAGUES = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  BUNDESLIGA: 78,
  SERIE_A: 135,
  LIGUE_1: 61,
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 3,
  EGYPTIAN_LEAGUE: 233,
  SAUDI_LEAGUE: 307,
};

class FootballBackgroundService {
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start background updates
   * Updates standings and live matches periodically
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('⚠️ Background service already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting football background service...');

    // Update immediately on start
    this.updateAll().catch(err => logger.error('Initial update failed:', err));

    // Then update every 5 minutes
    this.updateInterval = setInterval(() => {
      this.updateAll().catch(err => logger.error('Background update failed:', err));
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop background updates
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Stopped football background service');
  }

  /**
   * Update all background data
   */
  private async updateAll(): Promise<void> {
    logger.debug('🔄 Background update starting...');

    try {
      // Run updates in parallel
      await Promise.allSettled([
        this.updateLiveMatches(),
        this.updateStandings(),
        this.updateTodayMatches(),
      ]);

      logger.debug('✅ Background update complete');
    } catch (error) {
      logger.error('❌ Background update error:', error);
    }
  }

  /**
   * Update live matches (highest priority)
   * Runs every 30 seconds via the main update loop
   */
  private async updateLiveMatches(): Promise<void> {
    try {
      const liveMatches = await footballService.getLiveFixtures();
      
      if (liveMatches.length > 0) {
        const redis = getRedisClient();
        if (redis) {
          // Cache live matches with 30 second TTL
          await redis.setex(
            'football:live_matches',
            30,
            JSON.stringify(liveMatches)
          );
          
          logger.debug(`📡 Updated ${liveMatches.length} live matches`);
        }
      }
    } catch (error) {
      logger.warn('Failed to update live matches:', error);
    }
  }

  /**
   * Update standings for major leagues
   * Runs every 5 minutes
   */
  private async updateStandings(): Promise<void> {
    const currentSeason = new Date().getFullYear();
    const leagueIds = Object.values(MAJOR_LEAGUES);

    for (const leagueId of leagueIds) {
      try {
        const standings = await footballService.getStandings(leagueId, currentSeason);
        
        if (standings.length > 0) {
          const redis = getRedisClient();
          if (redis) {
            // Cache standings with 30 minute TTL
            await redis.setex(
              `football:standings:${leagueId}:${currentSeason}`,
              30 * 60, // 30 minutes
              JSON.stringify(standings)
            );
            
            logger.debug(`📊 Updated standings for league ${leagueId}`);
          }
        }

        // Small delay between requests to avoid rate limiting
        await this.sleep(300);
      } catch (error) {
        logger.warn(`Failed to update standings for league ${leagueId}:`, error);
      }
    }
  }

  /**
   * Update today's matches
   * Runs every 5 minutes
   */
  private async updateTodayMatches(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const matches = await footballService.getFixtures({ date: today });
      
      if (matches.length > 0) {
        const redis = getRedisClient();
        if (redis) {
          // Cache today's matches with 5 minute TTL
          await redis.setex(
            `football:matches:${today}`,
            5 * 60, // 5 minutes
            JSON.stringify(matches)
          );
          
          logger.debug(`📅 Updated ${matches.length} matches for ${today}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to update today matches:', error);
    }
  }

  /**
   * Prefetch data for a specific match
   * Called when a user views match details
   */
  async prefetchMatchData(fixtureId: number): Promise<void> {
    try {
      // Fetch all match data in parallel without blocking
      Promise.allSettled([
        footballService.getFixtureLineups(fixtureId),
        footballService.getFixtureStatistics(fixtureId),
        footballService.getFixtureEvents(fixtureId),
      ]).catch(err => logger.warn('Prefetch failed:', err));

      logger.debug(`🔮 Prefetching data for match ${fixtureId}`);
    } catch (error) {
      logger.warn(`Failed to prefetch match ${fixtureId}:`, error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const footballBackgroundService = new FootballBackgroundService();
