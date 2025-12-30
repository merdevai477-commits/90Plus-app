/**
 * Matches Batch Service
 * 
 * Fetches matches in bulk to minimize API requests and shares cached data
 * across all users/components.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { cacheService, CACHE_TTL, CACHE_KEYS } from './cacheService';
import { ApiFootballService, Fixture } from './apiFootball';

/**
 * Configuration for matches batch fetching
 */
export const MATCHES_CONFIG = {
  /** Number of days to fetch in a single batch */
  BATCH_DAYS: 7,
  /** Cache TTL: 30 minutes minimum as per Requirements 5.2 */
  CACHE_TTL: CACHE_TTL.MATCHES, // 30 * 60 * 1000
  /** Maximum matches per API call */
  MAX_MATCHES_PER_REQUEST: 100,
} as const;

/**
 * Cache key generator for date-specific matches
 */
const getMatchesCacheKey = (date: string): string => {
  return `${CACHE_KEYS.MATCHES}_${date}`;
};

/**
 * Cache key for the batch metadata (tracks what dates are cached)
 */
const BATCH_METADATA_KEY = `${CACHE_KEYS.MATCHES}_batch_metadata`;

interface BatchMetadata {
  startDate: string;
  endDate: string;
  fetchedAt: number;
  datesCached: string[];
}

/**
 * Format date to YYYY-MM-DD string
 */
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Generate array of date strings between start and end (inclusive)
 */
const getDateRange = (startDate: Date, endDate: Date): string[] => {
  const dates: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

class MatchesBatchService {
  private fetchPromise: Promise<Fixture[]> | null = null;

  /**
   * Fetch all matches for a date range in a SINGLE batch request.
   * Uses from/to parameters to get all matches in one API call.
   * 
   * Optimization: 1 request instead of 7 (per day)
   * Requirement 5.1: Request maximum matches per API call
   * Requirement 5.6: Include matches for current day plus upcoming days
   */
  async fetchMatchesBatch(startDate: Date, endDate: Date): Promise<Fixture[]> {
    const fromStr = formatDate(startDate);
    const toStr = formatDate(endDate);
    const dates = getDateRange(startDate, endDate);

    console.log(`📦 Batch fetching matches in SINGLE request: ${fromStr} to ${toStr}`);

    try {
      // API-Football v3 requires a league or team for from/to ranges.
      // To get all matches across multiple dates, we fetch day-by-day.
      const fetchPromises = dates.map(date =>
        ApiFootballService.getFixtures({ date })
      );

      const allFixturesArrays = await Promise.all(fetchPromises);
      const allFixtures = allFixturesArrays.flat();

      console.log(`✅ Received ${allFixtures.length} matches across ${dates.length} days`);

      // Group fixtures by date for granular caching
      const fixturesByDate = new Map<string, Fixture[]>();
      dates.forEach(date => fixturesByDate.set(date, []));

      for (const fixture of allFixtures) {
        const fixtureDate = formatDate(new Date(fixture.fixture.date));
        if (fixturesByDate.has(fixtureDate)) {
          fixturesByDate.get(fixtureDate)!.push(fixture);
        }
      }

      // Cache each date's matches individually for granular access
      for (const [date, fixtures] of fixturesByDate) {
        await cacheService.set(
          getMatchesCacheKey(date),
          fixtures,
          MATCHES_CONFIG.CACHE_TTL
        );
      }

      // Store batch metadata
      const metadata: BatchMetadata = {
        startDate: fromStr,
        endDate: toStr,
        fetchedAt: Date.now(),
        datesCached: dates,
      };
      await cacheService.set(BATCH_METADATA_KEY, metadata, MATCHES_CONFIG.CACHE_TTL);

      console.log(`📦 Cached ${allFixtures.length} matches for ${dates.length} days`);

      return allFixtures;
    } catch (error) {
      console.warn(`Failed to fetch matches batch:`, error);
      return [];
    }
  }

  /**
   * Get matches for a specific date from cache, fetch if expired.
   * 
   * Requirement 5.3: Serve from cache if data exists and is not expired
   * Requirement 5.4: Share the same cached data across all users
   */
  async getMatches(date: Date): Promise<Fixture[]> {
    const dateStr = formatDate(date);
    const cacheKey = getMatchesCacheKey(dateStr);

    // Try to get from cache first
    const cached = await cacheService.get<Fixture[]>(cacheKey);

    if (cached !== null) {
      console.log(`📦 Cache hit for matches on ${dateStr}`);
      return cached;
    }

    console.log(`📡 Cache miss for matches on ${dateStr}, fetching batch...`);

    // Cache miss - fetch a batch of days
    // Prevent concurrent fetches for the same batch
    if (this.fetchPromise) {
      await this.fetchPromise;
      // After batch fetch completes, try cache again
      const afterBatch = await cacheService.get<Fixture[]>(cacheKey);
      if (afterBatch !== null) {
        return afterBatch;
      }
    }

    // Calculate batch range: today + BATCH_DAYS - 1 upcoming days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + MATCHES_CONFIG.BATCH_DAYS - 1);

    // Fetch the batch
    this.fetchPromise = this.fetchMatchesBatch(today, endDate);

    try {
      await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }

    // Return the specific date's matches from cache
    const result = await cacheService.get<Fixture[]>(cacheKey);
    return result ?? [];
  }

  /**
   * Get cached matches without triggering a fetch.
   * Returns null if no cached data exists.
   * 
   * Requirement 5.3: Serve from cache if data exists
   */
  async getCachedMatches(date?: Date): Promise<Fixture[] | null> {
    const dateStr = formatDate(date ?? new Date());
    const cacheKey = getMatchesCacheKey(dateStr);
    return cacheService.get<Fixture[]>(cacheKey);
  }

  /**
   * Get all cached matches for the current batch.
   * Returns matches from all cached dates.
   */
  async getAllCachedMatches(): Promise<Fixture[]> {
    const metadata = await cacheService.get<BatchMetadata>(BATCH_METADATA_KEY);

    if (!metadata) {
      return [];
    }

    const allMatches: Fixture[] = [];

    for (const date of metadata.datesCached) {
      const cached = await cacheService.get<Fixture[]>(getMatchesCacheKey(date));
      if (cached) {
        allMatches.push(...cached);
      }
    }

    return allMatches;
  }

  /**
   * Force refresh the matches cache.
   * 
   * Requirement 5.5: Fetch fresh data when cache expires
   */
  async refreshCache(): Promise<void> {
    // Invalidate existing cache
    const metadata = await cacheService.get<BatchMetadata>(BATCH_METADATA_KEY);

    if (metadata) {
      for (const date of metadata.datesCached) {
        await cacheService.invalidate(getMatchesCacheKey(date));
      }
      await cacheService.invalidate(BATCH_METADATA_KEY);
    }

    // Fetch fresh batch
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + MATCHES_CONFIG.BATCH_DAYS - 1);

    await this.fetchMatchesBatch(today, endDate);
  }

  /**
   * Check if cache is valid (not expired).
   */
  async isCacheValid(date?: Date): Promise<boolean> {
    const dateStr = formatDate(date ?? new Date());
    const cacheKey = getMatchesCacheKey(dateStr);
    return cacheService.has(cacheKey);
  }

  /**
   * Get the cache TTL in milliseconds.
   * Exposed for testing purposes.
   * 
   * Requirement 5.2: Cache TTL should be at least 30 minutes
   */
  getCacheTTL(): number {
    return MATCHES_CONFIG.CACHE_TTL;
  }

  /**
   * Get the batch days configuration.
   * Exposed for testing purposes.
   */
  getBatchDays(): number {
    return MATCHES_CONFIG.BATCH_DAYS;
  }
}

// Export singleton instance
export const matchesBatchService = new MatchesBatchService();

// Export class for testing purposes
export { MatchesBatchService };

// Export helper functions for testing
export { formatDate, getDateRange, getMatchesCacheKey };
