/**
 * Football Background Service
 * Automatically updates frequently accessed data in the background
 * This reduces API calls during peak usage times
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import { getRedisClient } from '../lib/redis';
import {
  isWorldCupOnlyMode,
  logSkippingNonWorldCup,
} from '../config/world-cup-only-mode.config';
import { writeLiveFixturesSnapshot } from './live-fixture-cache.service';

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
   * ⚠️ DISABLED for Free Plan (100 requests/day limit)
   * Enable only if you have Pro Plan (300 requests/minute)
   */
  start(): void {
    if (isWorldCupOnlyMode()) {
      logSkippingNonWorldCup('background standings service');
      return;
    }

    const isFreePlan = process.env.FOOTBALL_API_PLAN === 'free' || !process.env.FOOTBALL_API_PLAN;
    
    if (isFreePlan) {
      logger.warn('⚠️ Background service DISABLED - Free Plan detected (100 req/day limit)');
      logger.info('💡 Upgrade to Pro Plan or set FOOTBALL_API_PLAN=pro to enable background updates');
      return;
    }

    if (this.isRunning) {
      logger.warn('⚠️ Background service already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting football background service...');

    // Update immediately on start
    this.updateAll().catch(err => logger.error('Initial update failed:', err));

    // Then update every 2 hours (standings only — calendar/live handled by dedicated sync jobs)
    this.updateInterval = setInterval(() => {
      this.updateAll().catch(err => logger.error('Background update failed:', err));
    }, 2 * 60 * 60 * 1000); // 2 hours
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
    logger.debug('🔄 Background standings update starting...');

    try {
      await this.updateStandings();
      logger.debug('✅ Background standings update complete');
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
      await writeLiveFixturesSnapshot(liveMatches);
      logger.debug(`📡 Updated ${liveMatches.length} live matches`);
    } catch (error) {
      logger.warn('Failed to update live matches:', error);
    }
  }

  /**
   * Update standings for major leagues
   * Runs every 30 minutes (reduced for Free Plan)
   * Only updates 3 most popular leagues to save API quota
   */
  private async updateStandings(): Promise<void> {
    const currentSeason = new Date().getFullYear();
    
    // ⚠️ Free Plan: Only update top 3 leagues to save quota
    const priorityLeagues = [
      MAJOR_LEAGUES.PREMIER_LEAGUE,
      MAJOR_LEAGUES.CHAMPIONS_LEAGUE,
      MAJOR_LEAGUES.EGYPTIAN_LEAGUE,
    ];

    for (const leagueId of priorityLeagues) {
      try {
        const standings = await footballService.getStandings(leagueId, currentSeason);
        
        if (standings.length > 0) {
          const redis = getRedisClient();
          if (redis) {
            // Cache standings with 2 hour TTL (increased to reduce API calls)
            await redis.setex(
              `football:standings:${leagueId}:${currentSeason}`,
              2 * 60 * 60, // 2 hours
              JSON.stringify(standings)
            );
            
            logger.debug(`📊 Updated standings for league ${leagueId}`);
          }
        }

        // Longer delay between requests (1 second)
        await this.sleep(1000);
      } catch (error) {
        logger.warn(`Failed to update standings for league ${leagueId}:`, error);
      }
    }
  }

  /**
   * Update today's matches
   * Runs every 30 minutes (reduced for Free Plan)
   */
  private async updateTodayMatches(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const matches = await footballService.getFixtures({ date: today });
      
      if (matches.length > 0) {
        const redis = getRedisClient();
        if (redis) {
          // Cache today's matches with 30 minute TTL (increased to reduce API calls)
          await redis.setex(
            `football:matches:${today}`,
            30 * 60, // 30 minutes
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
