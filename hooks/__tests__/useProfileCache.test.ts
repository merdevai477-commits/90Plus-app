/**
 * Property-Based Tests for useProfileCache Hook
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheService, CacheEntry, CACHE_KEYS, CACHE_TTL } from '../../services/cacheService';
import { ProfileCacheData, ProfileUserData, ProfileVideo } from '../useProfileCache';

// Get the mock helpers
const mockStorage = AsyncStorage as typeof AsyncStorage & {
  __resetStore: () => void;
  __getStore: () => Record<string, string>;
  __setStore: (store: Record<string, string>) => void;
};

// Generator for ProfileUserData
const profileUserDataArb = fc.record({
  displayName: fc.string({ minLength: 1, maxLength: 50 }),
  username: fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
  bio: fc.string({ maxLength: 200 }),
  avatar: fc.option(fc.webUrl(), { nil: null }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  isVerified: fc.boolean(),
  isDeveloper: fc.boolean(),
  favoriteTeam: fc.string({ maxLength: 50 }),
  location: fc.string({ maxLength: 50 }),
  lastUsernameChange: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() }), { nil: null }),
  socials: fc.record({
    instagram: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
    twitter: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
    facebook: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
  }),
  position: fc.option(fc.constantFrom('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'), { nil: undefined }),
  countryFlag: fc.option(fc.string({ minLength: 1, maxLength: 4 }), { nil: undefined }),
  age: fc.option(fc.integer({ min: 16, max: 45 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 150, max: 220 }), { nil: undefined }),
  weight: fc.option(fc.integer({ min: 50, max: 120 }), { nil: undefined }),
  preferredFoot: fc.option(fc.constantFrom('L', 'R'), { nil: undefined }),
  clubLogo: fc.option(fc.webUrl(), { nil: undefined }),
  brandLogo: fc.option(fc.webUrl(), { nil: undefined }),
  coverImage: fc.option(fc.webUrl(), { nil: undefined }),
});

// Generator for ProfileVideo
const profileVideoArb = fc.record({
  id: fc.uuid(),
  uri: fc.webUrl(),
  thumbnail: fc.option(fc.webUrl(), { nil: null }),
  views: fc.nat().map(n => n.toString()),
  likes: fc.nat({ max: 1000000 }),
  shares: fc.nat({ max: 100000 }),
  duration: fc.tuple(fc.nat({ max: 59 }), fc.nat({ max: 59 })).map(([m, s]) => `${m}:${s.toString().padStart(2, '0')}`),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
});

// Generator for FollowStats
const followStatsArb = fc.record({
  followersCount: fc.nat({ max: 10000000 }),
  followingCount: fc.nat({ max: 10000 }),
  reelsCount: fc.nat({ max: 10000 }),
});

// Generator for ProfileCacheData
const profileCacheDataArb = fc.record({
  userData: fc.option(profileUserDataArb, { nil: null }),
  followStats: fc.option(followStatsArb, { nil: null }),
  videos: fc.array(profileVideoArb, { maxLength: 50 }),
  analytics: fc.option(fc.record({
    profileViews: fc.nat(),
    followersCount: fc.nat(),
    followingCount: fc.nat(),
    reelsCount: fc.nat(),
    totalLikes: fc.nat(),
    totalViews: fc.nat(),
    totalComments: fc.nat(),
    recentFollowers: fc.nat(),
    // Use integer timestamp to avoid invalid date issues with fc.date()
    memberSince: fc.integer({ min: new Date('2020-01-01').getTime(), max: Date.now() }).map(ts => new Date(ts).toISOString()),
  }), { nil: null }),
  cooldowns: fc.option(fc.record({
    avatar: fc.record({ canChange: fc.boolean(), daysRemaining: fc.nat({ max: 7 }), hoursRemaining: fc.nat({ max: 23 }) }),
    cover: fc.record({ canChange: fc.boolean(), daysRemaining: fc.nat({ max: 7 }), hoursRemaining: fc.nat({ max: 23 }) }),
    reelUpload: fc.record({ canChange: fc.boolean(), daysRemaining: fc.nat({ max: 1 }), hoursRemaining: fc.nat({ max: 23 }) }),
    username: fc.record({ canChange: fc.boolean(), daysRemaining: fc.nat({ max: 30 }), hoursRemaining: fc.nat({ max: 23 }) }),
  }), { nil: null }),
});

describe('useProfileCache Property Tests', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    mockStorage.__resetStore();
    jest.clearAllMocks();
    cacheService = new CacheService();
  });

  /**
   * **Feature: performance-optimization, Property 2: Cache-First Profile Loading**
   * *For any* cached profile data, when navigating to the profile screen,
   * the cached data should be displayed before any network request completes.
   * **Validates: Requirements 2.1**
   */
  describe('Property 2: Cache-First Profile Loading', () => {
    it('should return cached profile data immediately for any valid cached data', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileCacheDataArb,
          async (cacheData) => {
            // Setup: Store profile data in cache
            const cacheKey = `@cache_${CACHE_KEYS.PROFILE_DATA}`;
            const cacheEntry: CacheEntry<ProfileCacheData> = {
              data: cacheData,
              timestamp: Date.now(),
              ttl: CACHE_TTL.PROFILE,
            };
            
            mockStorage.__setStore({
              [cacheKey]: JSON.stringify(cacheEntry),
            });

            // Action: Retrieve from cache
            const retrieved = await cacheService.get<ProfileCacheData>(CACHE_KEYS.PROFILE_DATA);

            // Property: Cached data should be returned immediately
            expect(retrieved).not.toBeNull();
            
            if (retrieved) {
              // Property: userData should match (if present)
              if (cacheData.userData) {
                expect(retrieved.userData?.username).toBe(cacheData.userData.username);
                expect(retrieved.userData?.displayName).toBe(cacheData.userData.displayName);
                expect(retrieved.userData?.bio).toBe(cacheData.userData.bio);
                expect(retrieved.userData?.isVerified).toBe(cacheData.userData.isVerified);
              }
              
              // Property: followStats should match (if present)
              if (cacheData.followStats) {
                expect(retrieved.followStats?.followersCount).toBe(cacheData.followStats.followersCount);
                expect(retrieved.followStats?.followingCount).toBe(cacheData.followStats.followingCount);
                expect(retrieved.followStats?.reelsCount).toBe(cacheData.followStats.reelsCount);
              }
              
              // Property: videos array length should match
              expect(retrieved.videos?.length).toBe(cacheData.videos?.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when no cached data exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (randomKey) => {
            // Setup: Empty cache
            mockStorage.__resetStore();

            // Action: Try to retrieve non-existent data
            const retrieved = await cacheService.get<ProfileCacheData>(randomKey);

            // Property: Should return null for non-existent cache
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when cached data has expired', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileCacheDataArb,
          async (cacheData) => {
            // Setup: Store expired profile data in cache
            const cacheKey = `@cache_${CACHE_KEYS.PROFILE_DATA}`;
            const expiredEntry: CacheEntry<ProfileCacheData> = {
              data: cacheData,
              timestamp: Date.now() - CACHE_TTL.PROFILE - 10000, // Expired
              ttl: CACHE_TTL.PROFILE,
            };
            
            mockStorage.__setStore({
              [cacheKey]: JSON.stringify(expiredEntry),
            });

            // Action: Retrieve from cache
            const retrieved = await cacheService.get<ProfileCacheData>(CACHE_KEYS.PROFILE_DATA);

            // Property: Expired data should return null
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 3: Profile Data Caching**
   * *For any* successfully loaded profile data, the data should be stored
   * in cache with a valid timestamp for future retrieval.
   * **Validates: Requirements 2.5**
   */
  describe('Property 3: Profile Data Caching', () => {
    it('should store profile data with valid timestamp for any valid input', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileCacheDataArb,
          async (cacheData) => {
            const beforeSet = Date.now();
            
            // Action: Store profile data in cache
            await cacheService.set(CACHE_KEYS.PROFILE_DATA, cacheData, CACHE_TTL.PROFILE);
            
            const afterSet = Date.now();

            // Verify the stored entry
            const store = mockStorage.__getStore();
            const cacheKey = `@cache_${CACHE_KEYS.PROFILE_DATA}`;
            const storedRaw = store[cacheKey];
            
            // Property: Data should be stored
            expect(storedRaw).toBeDefined();
            
            const storedEntry: CacheEntry<ProfileCacheData> = JSON.parse(storedRaw);
            
            // Property: Entry must have timestamp
            expect(storedEntry.timestamp).toBeDefined();
            expect(typeof storedEntry.timestamp).toBe('number');
            
            // Property: Timestamp must be within the time window of the set operation
            expect(storedEntry.timestamp).toBeGreaterThanOrEqual(beforeSet);
            expect(storedEntry.timestamp).toBeLessThanOrEqual(afterSet);
            
            // Property: Entry must have the correct TTL
            expect(storedEntry.ttl).toBe(CACHE_TTL.PROFILE);
            
            // Property: Entry must have the original data structure
            expect(storedEntry.data).toBeDefined();
            
            // Property: userData should be preserved (if present)
            if (cacheData.userData) {
              expect(storedEntry.data.userData?.username).toBe(cacheData.userData.username);
              expect(storedEntry.data.userData?.displayName).toBe(cacheData.userData.displayName);
            }
            
            // Property: followStats should be preserved (if present)
            if (cacheData.followStats) {
              expect(storedEntry.data.followStats?.followersCount).toBe(cacheData.followStats.followersCount);
            }
            
            // Property: videos array should be preserved
            expect(storedEntry.data.videos?.length).toBe(cacheData.videos?.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow retrieval of stored profile data within TTL', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileCacheDataArb,
          async (cacheData) => {
            // Action: Store and immediately retrieve
            await cacheService.set(CACHE_KEYS.PROFILE_DATA, cacheData, CACHE_TTL.PROFILE);
            const retrieved = await cacheService.get<ProfileCacheData>(CACHE_KEYS.PROFILE_DATA);

            // Property: Retrieved data should match stored data
            expect(retrieved).not.toBeNull();
            
            if (retrieved && cacheData.userData) {
              expect(retrieved.userData?.username).toBe(cacheData.userData.username);
              expect(retrieved.userData?.displayName).toBe(cacheData.userData.displayName);
              expect(retrieved.userData?.bio).toBe(cacheData.userData.bio);
            }
            
            if (retrieved && cacheData.followStats) {
              expect(retrieved.followStats?.followersCount).toBe(cacheData.followStats.followersCount);
              expect(retrieved.followStats?.followingCount).toBe(cacheData.followStats.followingCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should overwrite existing cache data when storing new data', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileCacheDataArb,
          profileCacheDataArb,
          async (oldData, newData) => {
            // Setup: Store old data
            await cacheService.set(CACHE_KEYS.PROFILE_DATA, oldData, CACHE_TTL.PROFILE);
            
            // Action: Store new data
            await cacheService.set(CACHE_KEYS.PROFILE_DATA, newData, CACHE_TTL.PROFILE);
            
            // Retrieve
            const retrieved = await cacheService.get<ProfileCacheData>(CACHE_KEYS.PROFILE_DATA);

            // Property: Retrieved data should be the new data, not old
            expect(retrieved).not.toBeNull();
            
            if (retrieved && newData.userData) {
              expect(retrieved.userData?.username).toBe(newData.userData.username);
              expect(retrieved.userData?.displayName).toBe(newData.userData.displayName);
            }
            
            if (retrieved && newData.followStats) {
              expect(retrieved.followStats?.followersCount).toBe(newData.followStats.followersCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
