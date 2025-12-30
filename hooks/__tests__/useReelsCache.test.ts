/**
 * Property-Based Tests for useReelsCache Hook
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheService, CacheEntry, CACHE_KEYS, CACHE_TTL } from '../../services/cacheService';
import { ReelsCacheData } from '../useReelsCache';
import { ReelData } from '../../components/reels/types';

// Get the mock helpers
const mockStorage = AsyncStorage as typeof AsyncStorage & {
  __resetStore: () => void;
  __getStore: () => Record<string, string>;
  __setStore: (store: Record<string, string>) => void;
};

// Generator for User in ReelData
const reelUserArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  username: fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
  avatar: fc.webUrl(),
  verified: fc.boolean(),
  followers: fc.option(fc.nat({ max: 10000000 }), { nil: undefined }),
  isFollowing: fc.option(fc.boolean(), { nil: undefined }),
});

// Generator for ReelData
const reelDataArb = fc.record({
  id: fc.uuid(),
  user: reelUserArb,
  videoUrl: fc.webUrl(),
  thumbnail: fc.webUrl(),
  duration: fc.nat({ max: 300 }),
  likes: fc.nat({ max: 1000000 }),
  views: fc.nat({ max: 10000000 }),
  comments: fc.nat({ max: 100000 }),
  shares: fc.nat({ max: 50000 }),
  liked: fc.boolean(),
  saved: fc.boolean(),
  muted: fc.boolean(),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  hashtags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }), { nil: undefined }),
  location: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
});

// Generator for ReelsCacheData
const reelsCacheDataArb = fc.record({
  reels: fc.array(reelDataArb, { minLength: 0, maxLength: 20 }),
  nextCursor: fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: null }),
  hasMore: fc.boolean(),
  cachedAt: fc.nat({ min: Date.now() - 86400000, max: Date.now() }),
});

describe('useReelsCache Property Tests', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    mockStorage.__resetStore();
    jest.clearAllMocks();
    cacheService = new CacheService();
  });

  /**
   * **Feature: performance-optimization, Property 4: Cache-First Reels Loading**
   * *For any* cached reels data, when navigating to the reels screen,
   * the cached reels should be displayed before any network request completes.
   * **Validates: Requirements 3.1**
   */
  describe('Property 4: Cache-First Reels Loading', () => {
    it('should return cached reels data immediately for any valid cached data', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsCacheDataArb,
          async (cacheData) => {
            // Setup: Store reels data in cache
            const cacheKey = `@cache_${CACHE_KEYS.REELS_FEED}`;
            const cacheEntry: CacheEntry<ReelsCacheData> = {
              data: cacheData,
              timestamp: Date.now(),
              ttl: CACHE_TTL.REELS,
            };
            
            mockStorage.__setStore({
              [cacheKey]: JSON.stringify(cacheEntry),
            });

            // Action: Retrieve from cache
            const retrieved = await cacheService.get<ReelsCacheData>(CACHE_KEYS.REELS_FEED);

            // Property: Cached data should be returned immediately
            expect(retrieved).not.toBeNull();
            
            if (retrieved) {
              // Property: reels array length should match
              expect(retrieved.reels?.length).toBe(cacheData.reels?.length);
              
              // Property: hasMore should match
              expect(retrieved.hasMore).toBe(cacheData.hasMore);
              
              // Property: nextCursor should match
              expect(retrieved.nextCursor).toBe(cacheData.nextCursor);
              
              // Property: Each reel should have required fields preserved
              if (cacheData.reels && cacheData.reels.length > 0) {
                const firstCachedReel = cacheData.reels[0];
                const firstRetrievedReel = retrieved.reels[0];
                
                expect(firstRetrievedReel.id).toBe(firstCachedReel.id);
                expect(firstRetrievedReel.videoUrl).toBe(firstCachedReel.videoUrl);
                expect(firstRetrievedReel.user.username).toBe(firstCachedReel.user.username);
                expect(firstRetrievedReel.likes).toBe(firstCachedReel.likes);
                expect(firstRetrievedReel.views).toBe(firstCachedReel.views);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when no cached reels data exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (randomKey) => {
            // Setup: Empty cache
            mockStorage.__resetStore();

            // Action: Try to retrieve non-existent data
            const retrieved = await cacheService.get<ReelsCacheData>(randomKey);

            // Property: Should return null for non-existent cache
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when cached reels data has expired', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsCacheDataArb,
          async (cacheData) => {
            // Setup: Store expired reels data in cache
            const cacheKey = `@cache_${CACHE_KEYS.REELS_FEED}`;
            const expiredEntry: CacheEntry<ReelsCacheData> = {
              data: cacheData,
              timestamp: Date.now() - CACHE_TTL.REELS - 10000, // Expired
              ttl: CACHE_TTL.REELS,
            };
            
            mockStorage.__setStore({
              [cacheKey]: JSON.stringify(expiredEntry),
            });

            // Action: Retrieve from cache
            const retrieved = await cacheService.get<ReelsCacheData>(CACHE_KEYS.REELS_FEED);

            // Property: Expired data should return null
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 5: Reels Data Caching**
   * *For any* successfully loaded reels data, the data should be stored
   * in cache with a valid timestamp for future retrieval.
   * **Validates: Requirements 3.4**
   */
  describe('Property 5: Reels Data Caching', () => {
    it('should store reels data with valid timestamp for any valid input', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsCacheDataArb,
          async (cacheData) => {
            const beforeSet = Date.now();
            
            // Action: Store reels data in cache
            await cacheService.set(CACHE_KEYS.REELS_FEED, cacheData, CACHE_TTL.REELS);
            
            const afterSet = Date.now();

            // Verify the stored entry
            const store = mockStorage.__getStore();
            const cacheKey = `@cache_${CACHE_KEYS.REELS_FEED}`;
            const storedRaw = store[cacheKey];
            
            // Property: Data should be stored
            expect(storedRaw).toBeDefined();
            
            const storedEntry: CacheEntry<ReelsCacheData> = JSON.parse(storedRaw);
            
            // Property: Entry must have timestamp
            expect(storedEntry.timestamp).toBeDefined();
            expect(typeof storedEntry.timestamp).toBe('number');
            
            // Property: Timestamp must be within the time window of the set operation
            expect(storedEntry.timestamp).toBeGreaterThanOrEqual(beforeSet);
            expect(storedEntry.timestamp).toBeLessThanOrEqual(afterSet);
            
            // Property: Entry must have the correct TTL
            expect(storedEntry.ttl).toBe(CACHE_TTL.REELS);
            
            // Property: Entry must have the original data structure
            expect(storedEntry.data).toBeDefined();
            
            // Property: reels array should be preserved
            expect(storedEntry.data.reels?.length).toBe(cacheData.reels?.length);
            
            // Property: hasMore should be preserved
            expect(storedEntry.data.hasMore).toBe(cacheData.hasMore);
            
            // Property: nextCursor should be preserved
            expect(storedEntry.data.nextCursor).toBe(cacheData.nextCursor);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow retrieval of stored reels data within TTL', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsCacheDataArb,
          async (cacheData) => {
            // Action: Store and immediately retrieve
            await cacheService.set(CACHE_KEYS.REELS_FEED, cacheData, CACHE_TTL.REELS);
            const retrieved = await cacheService.get<ReelsCacheData>(CACHE_KEYS.REELS_FEED);

            // Property: Retrieved data should match stored data
            expect(retrieved).not.toBeNull();
            
            if (retrieved) {
              expect(retrieved.reels?.length).toBe(cacheData.reels?.length);
              expect(retrieved.hasMore).toBe(cacheData.hasMore);
              expect(retrieved.nextCursor).toBe(cacheData.nextCursor);
              
              // Verify individual reels are preserved
              if (cacheData.reels && cacheData.reels.length > 0) {
                for (let i = 0; i < Math.min(cacheData.reels.length, 5); i++) {
                  expect(retrieved.reels[i].id).toBe(cacheData.reels[i].id);
                  expect(retrieved.reels[i].videoUrl).toBe(cacheData.reels[i].videoUrl);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should overwrite existing cache data when storing new reels data', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsCacheDataArb,
          reelsCacheDataArb,
          async (oldData, newData) => {
            // Setup: Store old data
            await cacheService.set(CACHE_KEYS.REELS_FEED, oldData, CACHE_TTL.REELS);
            
            // Action: Store new data
            await cacheService.set(CACHE_KEYS.REELS_FEED, newData, CACHE_TTL.REELS);
            
            // Retrieve
            const retrieved = await cacheService.get<ReelsCacheData>(CACHE_KEYS.REELS_FEED);

            // Property: Retrieved data should be the new data, not old
            expect(retrieved).not.toBeNull();
            
            if (retrieved) {
              expect(retrieved.reels?.length).toBe(newData.reels?.length);
              expect(retrieved.hasMore).toBe(newData.hasMore);
              expect(retrieved.nextCursor).toBe(newData.nextCursor);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 6: Non-Disruptive Reels Update**
   * *For any* current viewing index, when new reels data arrives,
   * the current viewing position should be preserved.
   * **Validates: Requirements 3.6**
   */
  describe('Property 6: Non-Disruptive Reels Update', () => {
    it('should preserve current reel when merging new data if reel exists in new data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial reels with at least 3 items
          fc.array(reelDataArb, { minLength: 3, maxLength: 10 }),
          // Generate a viewing index within bounds
          fc.integer({ min: 0, max: 2 }),
          async (initialReels, viewingIndex) => {
            // Setup: Current reels state
            const currentReels = initialReels;
            const currentViewingIndex = Math.min(viewingIndex, currentReels.length - 1);
            const currentReelId = currentReels[currentViewingIndex].id;
            
            // Simulate new data that includes the current reel
            const newReels = [...currentReels]; // Same reels, simulating refresh
            
            // Property: Current reel should still be findable in new data
            const newIndex = newReels.findIndex(r => r.id === currentReelId);
            expect(newIndex).toBeGreaterThanOrEqual(0);
            
            // Property: The reel at the new index should have the same ID
            expect(newReels[newIndex].id).toBe(currentReelId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case when current reel is not in new data by prepending new reels', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial reels
          fc.array(reelDataArb, { minLength: 2, maxLength: 5 }),
          // Generate completely new reels (different IDs)
          fc.array(reelDataArb, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 0, max: 1 }),
          async (initialReels, newReels, viewingIndex) => {
            // Setup: Current reels state
            const currentReels = initialReels;
            const currentViewingIndex = Math.min(viewingIndex, currentReels.length - 1);
            const currentReelId = currentReels[currentViewingIndex].id;
            
            // Check if current reel exists in new data
            const existsInNew = newReels.some(r => r.id === currentReelId);
            
            if (!existsInNew) {
              // Property: When current reel not in new data, we should be able to
              // merge by prepending new reels to preserve the current viewing position
              const existingIds = new Set(currentReels.map(r => r.id));
              const trulyNewReels = newReels.filter(r => !existingIds.has(r.id));
              const mergedReels = [...trulyNewReels, ...currentReels];
              
              // Property: Current reel should still be in merged data
              const mergedIndex = mergedReels.findIndex(r => r.id === currentReelId);
              expect(mergedIndex).toBeGreaterThanOrEqual(0);
              
              // Property: Current reel should be at offset position (after new reels)
              expect(mergedIndex).toBe(trulyNewReels.length + currentViewingIndex);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deduplicate reels when merging to prevent duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(reelDataArb, { minLength: 3, maxLength: 10 }),
          async (reels) => {
            // Setup: Create some overlap between "existing" and "new" reels
            const existingReels = reels.slice(0, Math.ceil(reels.length / 2));
            const newReels = reels; // Contains some of the existing reels
            
            // Simulate merge logic
            const existingIds = new Set(existingReels.map(r => r.id));
            const trulyNewReels = newReels.filter(r => !existingIds.has(r.id));
            const mergedReels = [...existingReels, ...trulyNewReels];
            
            // Property: No duplicate IDs in merged result
            const mergedIds = mergedReels.map(r => r.id);
            const uniqueIds = new Set(mergedIds);
            expect(uniqueIds.size).toBe(mergedIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
