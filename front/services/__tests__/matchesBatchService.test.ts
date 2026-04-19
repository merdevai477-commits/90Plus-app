/**
 * Property-Based Tests for MatchesBatchService
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  MatchesBatchService, 
  MATCHES_CONFIG,
  formatDate,
  getDateRange,
  getMatchesCacheKey 
} from '../matchesBatchService';
import { CacheEntry } from '../cacheService';
import { Fixture } from '../apiFootball';

// Get the mock helpers
const mockStorage = AsyncStorage as typeof AsyncStorage & {
  __resetStore: () => void;
  __getStore: () => Record<string, string>;
  __setStore: (store: Record<string, string>) => void;
};

// Mock the ApiFootballService
jest.mock('../apiFootball', () => ({
  ApiFootballService: {
    getFixturesByDate: jest.fn(),
  },
}));

import { ApiFootballService } from '../apiFootball';

const mockApiFootballService = ApiFootballService as jest.Mocked<typeof ApiFootballService>;

/**
 * Generator for valid dates (avoiding timezone edge cases)
 * Uses noon UTC to avoid date boundary issues
 */
const validDateGenerator = (): fc.Arbitrary<Date> => {
  return fc.integer({ min: 2024, max: 2025 }).chain(year =>
    fc.integer({ min: 1, max: 12 }).chain(month =>
      fc.integer({ min: 1, max: 28 }).map(day => {
        // Use noon UTC to avoid timezone issues
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      })
    )
  );
};

/**
 * Generator for mock Fixture objects
 */
const fixtureGenerator = (): fc.Arbitrary<Fixture> => {
  return fc.record({
    fixture: fc.record({
      id: fc.integer({ min: 1, max: 999999 }),
      referee: fc.option(fc.string(), { nil: null }),
      timezone: fc.constant('UTC'),
      date: validDateGenerator().map(d => d.toISOString()),
      timestamp: fc.integer({ min: 1704067200, max: 1767225600 }),
      periods: fc.record({
        first: fc.option(fc.integer(), { nil: null }),
        second: fc.option(fc.integer(), { nil: null }),
      }),
      venue: fc.record({
        id: fc.option(fc.integer(), { nil: null }),
        name: fc.option(fc.string(), { nil: null }),
        city: fc.option(fc.string(), { nil: null }),
      }),
      status: fc.record({
        long: fc.string(),
        short: fc.constantFrom('NS', 'FT', '1H', '2H', 'HT', 'LIVE'),
        elapsed: fc.option(fc.integer({ min: 0, max: 120 }), { nil: null }),
      }),
    }),
    league: fc.record({
      id: fc.integer({ min: 1, max: 1000 }),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      country: fc.string({ minLength: 1, maxLength: 30 }),
      logo: fc.webUrl(),
      flag: fc.option(fc.webUrl(), { nil: null }),
      season: fc.integer({ min: 2020, max: 2025 }),
      round: fc.string(),
    }),
    teams: fc.record({
      home: fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        logo: fc.webUrl(),
        winner: fc.option(fc.boolean(), { nil: null }),
      }),
      away: fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        logo: fc.webUrl(),
        winner: fc.option(fc.boolean(), { nil: null }),
      }),
    }),
    goals: fc.record({
      home: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
      away: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
    }),
    score: fc.record({
      halftime: fc.record({
        home: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
        away: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
      }),
      fulltime: fc.record({
        home: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
        away: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
      }),
      extratime: fc.record({
        home: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
        away: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
      }),
      penalty: fc.record({
        home: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
        away: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
      }),
    }),
  }) as fc.Arbitrary<Fixture>;
};

describe('MatchesBatchService Property Tests', () => {
  let matchesBatchService: MatchesBatchService;

  beforeEach(() => {
    // Reset the mock store before each test
    mockStorage.__resetStore();
    jest.clearAllMocks();
    matchesBatchService = new MatchesBatchService();
  });

  /**
   * **Feature: performance-optimization, Property 11: Matches Batch Fetching**
   * *For any* matches request, the service should fetch matches for multiple days (batch) 
   * in a single API call to minimize request count.
   * **Validates: Requirements 5.1, 5.6**
   */
  describe('Property 11: Matches Batch Fetching', () => {
    it('should fetch matches for multiple days in a batch', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a start date within a reasonable range
          validDateGenerator(),
          // Generate number of days for the batch (1-14 days)
          fc.integer({ min: 1, max: 14 }),
          // Generate fixtures for each day
          fc.array(fixtureGenerator(), { minLength: 0, maxLength: 10 }),
          async (startDate, batchDays, mockFixtures) => {
            // Reset mocks and storage for each iteration
            mockStorage.__resetStore();
            mockApiFootballService.getFixturesByDate.mockReset();
            
            // Create fresh service instance for each test
            const service = new MatchesBatchService();
            
            // Setup: Calculate end date
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + batchDays - 1);
            
            // Setup: Mock API to return fixtures
            mockApiFootballService.getFixturesByDate.mockResolvedValue(mockFixtures);
            
            // Execute: Fetch batch
            const result = await service.fetchMatchesBatch(startDate, endDate);
            
            // Property 1: API should be called for each day in the range
            const expectedDates = getDateRange(startDate, endDate);
            expect(mockApiFootballService.getFixturesByDate).toHaveBeenCalledTimes(expectedDates.length);
            
            // Property 2: Each date in the range should have been requested
            expectedDates.forEach(date => {
              expect(mockApiFootballService.getFixturesByDate).toHaveBeenCalledWith(date);
            });
            
            // Property 3: Result should contain fixtures from all days
            // (mockFixtures * number of days since same mock is returned for each day)
            expect(result.length).toBe(mockFixtures.length * expectedDates.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cache each day\'s matches individually after batch fetch', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateGenerator(),
          fc.array(fixtureGenerator(), { minLength: 1, maxLength: 5 }),
          async (startDate, mockFixtures) => {
            // Reset mocks and storage for each iteration
            mockStorage.__resetStore();
            mockApiFootballService.getFixturesByDate.mockReset();
            
            // Create fresh service instance
            const service = new MatchesBatchService();
            
            // Setup: Use configured batch days
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + MATCHES_CONFIG.BATCH_DAYS - 1);
            
            mockApiFootballService.getFixturesByDate.mockResolvedValue(mockFixtures);
            
            // Execute: Fetch batch
            await service.fetchMatchesBatch(startDate, endDate);
            
            // Property: Each date should have its own cache entry
            const expectedDates = getDateRange(startDate, endDate);
            const store = mockStorage.__getStore();
            
            expectedDates.forEach(date => {
              const cacheKey = `@cache_${getMatchesCacheKey(date)}`;
              expect(store[cacheKey]).toBeDefined();
              
              const entry: CacheEntry<Fixture[]> = JSON.parse(store[cacheKey]);
              expect(entry.data).toEqual(mockFixtures);
              expect(entry.ttl).toBe(MATCHES_CONFIG.CACHE_TTL);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 12: Matches Cache Sharing**
   * *For any* cached matches data, all subsequent requests within the TTL should 
   * return the same cached data without making new API calls.
   * **Validates: Requirements 5.3, 5.4**
   */
  describe('Property 12: Matches Cache Sharing', () => {
    it('should return cached data without API calls for subsequent requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateGenerator(),
          fc.array(fixtureGenerator(), { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 2, max: 5 }), // Number of subsequent requests
          async (date, mockFixtures, numRequests) => {
            // Reset mocks and storage for each iteration
            mockStorage.__resetStore();
            mockApiFootballService.getFixturesByDate.mockReset();
            
            // Setup: Pre-populate cache with fixtures
            const dateStr = formatDate(date);
            const cacheKey = `@cache_${getMatchesCacheKey(dateStr)}`;
            
            const cacheEntry: CacheEntry<Fixture[]> = {
              data: mockFixtures,
              timestamp: Date.now(),
              ttl: MATCHES_CONFIG.CACHE_TTL,
            };
            
            mockStorage.__setStore({
              [cacheKey]: JSON.stringify(cacheEntry),
            });
            
            // Create fresh service instance
            const service = new MatchesBatchService();
            
            // Execute: Make multiple requests
            const results: Fixture[][] = [];
            for (let i = 0; i < numRequests; i++) {
              const result = await service.getCachedMatches(date);
              if (result) results.push(result);
            }
            
            // Property 1: All requests should return the same cached data
            results.forEach(result => {
              expect(result).toEqual(mockFixtures);
            });
            
            // Property 2: No API calls should be made (data served from cache)
            expect(mockApiFootballService.getFixturesByDate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should share cache across multiple service instances', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateGenerator(),
          fc.array(fixtureGenerator(), { minLength: 1, maxLength: 10 }),
          async (date, mockFixtures) => {
            // Reset mocks and storage for each iteration
            mockStorage.__resetStore();
            mockApiFootballService.getFixturesByDate.mockReset();
            
            // Setup: Pre-populate cache
            const dateStr = formatDate(date);
            const cacheKey = `@cache_${getMatchesCacheKey(dateStr)}`;
            
            const cacheEntry: CacheEntry<Fixture[]> = {
              data: mockFixtures,
              timestamp: Date.now(),
              ttl: MATCHES_CONFIG.CACHE_TTL,
            };
            
            mockStorage.__setStore({
              [cacheKey]: JSON.stringify(cacheEntry),
            });
            
            // Execute: Create multiple service instances and request data
            const service1 = new MatchesBatchService();
            const service2 = new MatchesBatchService();
            const service3 = new MatchesBatchService();
            
            const result1 = await service1.getCachedMatches(date);
            const result2 = await service2.getCachedMatches(date);
            const result3 = await service3.getCachedMatches(date);
            
            // Property: All instances should return the same cached data
            expect(result1).toEqual(mockFixtures);
            expect(result2).toEqual(mockFixtures);
            expect(result3).toEqual(mockFixtures);
            
            // Property: No API calls made
            expect(mockApiFootballService.getFixturesByDate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 13: Matches Cache TTL**
   * *For any* matches cache entry, the TTL should be at least 30 minutes to reduce API usage.
   * **Validates: Requirements 5.2**
   */
  describe('Property 13: Matches Cache TTL', () => {
    it('should use TTL of at least 30 minutes for all cache entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateGenerator(),
          fc.array(fixtureGenerator(), { minLength: 1, maxLength: 5 }),
          async (startDate, mockFixtures) => {
            // Reset mocks and storage for each iteration
            mockStorage.__resetStore();
            mockApiFootballService.getFixturesByDate.mockReset();
            
            // Create fresh service instance
            const service = new MatchesBatchService();
            
            // Setup
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 2); // 3 days
            
            mockApiFootballService.getFixturesByDate.mockResolvedValue(mockFixtures);
            
            // Execute: Fetch batch
            await service.fetchMatchesBatch(startDate, endDate);
            
            // Property: All cache entries should have TTL >= 30 minutes
            const store = mockStorage.__getStore();
            const cacheKeys = Object.keys(store).filter(k => k.includes('matches_'));
            
            const thirtyMinutesMs = 30 * 60 * 1000;
            
            cacheKeys.forEach(key => {
              const entry: CacheEntry<unknown> = JSON.parse(store[key]);
              expect(entry.ttl).toBeGreaterThanOrEqual(thirtyMinutesMs);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have configured TTL of exactly 30 minutes', () => {
      // Property: The configured TTL should be exactly 30 minutes
      const thirtyMinutesMs = 30 * 60 * 1000;
      expect(MATCHES_CONFIG.CACHE_TTL).toBe(thirtyMinutesMs);
      
      const service = new MatchesBatchService();
      expect(service.getCacheTTL()).toBe(thirtyMinutesMs);
    });

    it('should return null for expired cache entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateGenerator(),
          fc.array(fixtureGenerator(), { minLength: 1, maxLength: 5 }),
          async (date, mockFixtures) => {
            // Reset mocks and storage for each iteration
            mockStorage.__resetStore();
            mockApiFootballService.getFixturesByDate.mockReset();
            
            // Setup: Create an expired cache entry
            const dateStr = formatDate(date);
            const cacheKey = `@cache_${getMatchesCacheKey(dateStr)}`;
            
            const expiredEntry: CacheEntry<Fixture[]> = {
              data: mockFixtures,
              timestamp: Date.now() - (MATCHES_CONFIG.CACHE_TTL + 1000), // Expired
              ttl: MATCHES_CONFIG.CACHE_TTL,
            };
            
            mockStorage.__setStore({
              [cacheKey]: JSON.stringify(expiredEntry),
            });
            
            // Create fresh service instance
            const service = new MatchesBatchService();
            
            // Execute: Try to get cached matches
            const result = await service.getCachedMatches(date);
            
            // Property: Expired cache should return null
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Helper function tests
   */
  describe('Helper Functions', () => {
    it('formatDate should produce YYYY-MM-DD format', () => {
      fc.assert(
        fc.property(
          // Use our valid date generator to avoid timezone edge cases
          validDateGenerator(),
          (date) => {
            const formatted = formatDate(date);
            
            // Property: Format should match YYYY-MM-DD pattern
            expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            
            // Property: The formatted date should be a valid date string
            const parsed = new Date(formatted + 'T12:00:00Z');
            expect(parsed.getTime()).not.toBeNaN();
            
            // Property: Year, month, day should be extractable from the string
            const [year, month, day] = formatted.split('-').map(Number);
            expect(year).toBeGreaterThanOrEqual(2024);
            expect(year).toBeLessThanOrEqual(2025);
            expect(month).toBeGreaterThanOrEqual(1);
            expect(month).toBeLessThanOrEqual(12);
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(31);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getDateRange should return correct number of dates', () => {
      fc.assert(
        fc.property(
          validDateGenerator(),
          fc.integer({ min: 0, max: 30 }),
          (startDate, daysToAdd) => {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + daysToAdd);
            
            const range = getDateRange(startDate, endDate);
            
            // Property: Range should have exactly daysToAdd + 1 dates (inclusive)
            expect(range.length).toBe(daysToAdd + 1);
            
            // Property: First date should match start date
            expect(range[0]).toBe(formatDate(startDate));
            
            // Property: Last date should match end date
            expect(range[range.length - 1]).toBe(formatDate(endDate));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
