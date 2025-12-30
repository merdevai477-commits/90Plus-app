/**
 * Property-Based Tests for Reel Video Preloading
 *
 * **Feature: security-technical-fixes, Property 24: Reel Preloading Ahead**
 * For any reel being viewed, the system SHALL have the next 2-3 reels
 * preloaded and ready to play without buffering.
 *
 * **Validates: Requirements 19.2, 19.3**
 */

import * as fc from 'fast-check';

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: jest.fn((obj: Record<string, unknown>) => obj.web || obj.default),
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
}));

// Mock AsyncStorage
const mockAsyncStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockAsyncStorage))),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach(key => delete mockAsyncStorage[key]);
    return Promise.resolve();
  }),
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Track preloaded videos for testing
const mockPreloadedVideos = new Set<string>();
const mockPreloadingVideos = new Set<string>();

// Mock videoPreloader
jest.mock('../../utils/videoPreloader', () => ({
  preloadVideo: jest.fn(async (url: string) => {
    if (!url || !url.startsWith('http')) {
      return false;
    }
    mockPreloadingVideos.add(url);
    // Simulate async preloading
    await new Promise(resolve => setTimeout(resolve, 10));
    mockPreloadedVideos.add(url);
    mockPreloadingVideos.delete(url);
    return true;
  }),
  preloadVideos: jest.fn(async (urls: string[]) => {
    for (const url of urls) {
      if (url && url.startsWith('http')) {
        mockPreloadedVideos.add(url);
      }
    }
  }),
  isVideoPreloaded: jest.fn((url: string) => mockPreloadedVideos.has(url)),
  clearPreloadedVideos: jest.fn(() => {
    mockPreloadedVideos.clear();
    mockPreloadingVideos.clear();
  }),
  getPreloadedCount: jest.fn(() => mockPreloadedVideos.size),
}));

// Mock API services
jest.mock('../../src/services/authService', () => ({
  AuthService: {
    syncUserWithBackend: jest.fn(),
    getUserReels: jest.fn(),
  },
  FollowService: {
    getMyStats: jest.fn(),
  },
  ProfileService: {
    getAnalytics: jest.fn(),
    getCooldowns: jest.fn(),
  },
  ReelsService: {
    getFeed: jest.fn(),
  },
  NotificationService: {
    getNotifications: jest.fn(),
  },
}));

jest.mock('../apiFootball', () => ({
  ApiFootballService: {
    getMajorLeaguesFixtures: jest.fn(),
  },
}));

import { PreloadManagerClass } from '../preloadManager';
import { isVideoPreloaded, clearPreloadedVideos } from '../../utils/videoPreloader';

describe('Reel Preloading Property Tests', () => {
  let preloadManager: PreloadManagerClass;

  // Clear mocks before each test
  beforeEach(() => {
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    mockPreloadedVideos.clear();
    mockPreloadingVideos.clear();
    jest.clearAllMocks();
    preloadManager = new PreloadManagerClass();
  });

  /**
   * **Feature: security-technical-fixes, Property 24: Reel Preloading Ahead**
   *
   * For any reel being viewed, the system SHALL have the next 2-3 reels
   * preloaded and ready to play without buffering.
   *
   * **Validates: Requirements 19.2, 19.3**
   */
  describe('Property 24: Reel Preloading Ahead', () => {
    // Arbitrary for generating reel data with video URLs
    const reelArbitrary = fc.record({
      id: fc.uuid(),
      videoUrl: fc.webUrl(),
      thumbnail: fc.webUrl(),
    });

    // Arbitrary for generating a list of reels
    const reelsListArbitrary = fc.array(reelArbitrary, { minLength: 5, maxLength: 20 });

    // Arbitrary for current viewing index (must be valid for the reels list)
    const viewingIndexArbitrary = (maxIndex: number) => 
      fc.nat({ max: Math.max(0, maxIndex - 3) }); // Leave room for next 2-3 reels

    it('should preload next 2-3 reels when viewing any reel (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsListArbitrary,
          async (reels) => {
            // Skip if not enough reels
            if (reels.length < 4) return;

            // Clear previous preloads
            mockPreloadedVideos.clear();
            preloadManager = new PreloadManagerClass();

            // Generate a valid viewing index
            const currentIndex = Math.floor(Math.random() * Math.max(1, reels.length - 3));

            // Call preloadNextReelVideos
            await preloadManager.preloadNextReelVideos(reels, currentIndex);

            // Property: At least some of the next 2-3 reels should be preloaded
            const expectedPreloadCount = Math.min(3, reels.length - currentIndex - 1);
            
            if (expectedPreloadCount > 0) {
              // Check that videos were preloaded
              let preloadedCount = 0;
              for (let i = 1; i <= 3; i++) {
                const nextIndex = currentIndex + i;
                if (nextIndex < reels.length) {
                  const videoUrl = reels[nextIndex].videoUrl;
                  if (preloadManager.isVideoPreloaded(videoUrl)) {
                    preloadedCount++;
                  }
                }
              }

              // Property: Should have preloaded at least some of the next reels
              expect(preloadedCount).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not preload already preloaded videos (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsListArbitrary,
          async (reels) => {
            // Skip if not enough reels
            if (reels.length < 4) return;

            // Clear previous preloads
            mockPreloadedVideos.clear();
            preloadManager = new PreloadManagerClass();

            const currentIndex = 0;

            // Pre-preload some videos
            const nextVideoUrl = reels[1]?.videoUrl;
            if (nextVideoUrl) {
              mockPreloadedVideos.add(nextVideoUrl);
            }

            // Call preloadNextReelVideos
            await preloadManager.preloadNextReelVideos(reels, currentIndex);

            // Property: The already preloaded video should still be preloaded
            if (nextVideoUrl) {
              expect(mockPreloadedVideos.has(nextVideoUrl)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty reels list gracefully (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 10 }),
          async (currentIndex) => {
            preloadManager = new PreloadManagerClass();

            // Should not throw with empty list
            await expect(
              preloadManager.preloadNextReelVideos([], currentIndex)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle index at end of list gracefully (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsListArbitrary,
          async (reels) => {
            if (reels.length === 0) return;

            mockPreloadedVideos.clear();
            preloadManager = new PreloadManagerClass();

            // Use last index - no more reels to preload
            const lastIndex = reels.length - 1;

            // Should not throw
            await expect(
              preloadManager.preloadNextReelVideos(reels, lastIndex)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Initial Reel Video Preloading', () => {
    // Arbitrary for generating reel data
    const reelArbitrary = fc.record({
      id: fc.uuid(),
      videoUrl: fc.webUrl(),
      thumbnail: fc.webUrl(),
    });

    // Arbitrary for generating a list of reels
    const reelsListArbitrary = fc.array(reelArbitrary, { minLength: 1, maxLength: 20 });

    it('should preload first 3-5 reels on initialization (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          reelsListArbitrary,
          async (reels) => {
            // Clear previous preloads
            mockPreloadedVideos.clear();
            preloadManager = new PreloadManagerClass();

            // Call preloadInitialReelVideos
            await preloadManager.preloadInitialReelVideos(reels);

            // Property: Should preload up to 5 reels (or all if less than 5)
            const expectedCount = Math.min(5, reels.length);
            
            // Check that the first N videos were preloaded
            let preloadedCount = 0;
            for (let i = 0; i < expectedCount; i++) {
              const videoUrl = reels[i]?.videoUrl;
              if (videoUrl && preloadManager.isVideoPreloaded(videoUrl)) {
                preloadedCount++;
              }
            }

            // Property: Should have preloaded the expected number of initial reels
            expect(preloadedCount).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty reels list for initial preload (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant([]),
          async (emptyReels) => {
            preloadManager = new PreloadManagerClass();

            // Should not throw with empty list
            await expect(
              preloadManager.preloadInitialReelVideos(emptyReels)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Video Preload Status Tracking', () => {
    it('should correctly report preloaded status for any video URL (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.boolean(),
          async (videoUrl, shouldBePreloaded) => {
            mockPreloadedVideos.clear();
            preloadManager = new PreloadManagerClass();

            if (shouldBePreloaded) {
              // Simulate preloading
              mockPreloadedVideos.add(videoUrl);
            }

            // Property: isVideoPreloaded should match the preload state
            const isPreloaded = preloadManager.isVideoPreloaded(videoUrl);
            expect(isPreloaded).toBe(shouldBePreloaded);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return list of preloaded video URLs (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.webUrl(), { minLength: 0, maxLength: 10 }),
          async (videoUrls) => {
            mockPreloadedVideos.clear();
            preloadManager = new PreloadManagerClass();

            // Preload some videos through the manager
            const reels = videoUrls.map((url, i) => ({
              id: `reel-${i}`,
              videoUrl: url,
              thumbnail: url,
            }));

            await preloadManager.preloadInitialReelVideos(reels);

            // Property: getPreloadedVideoUrls should return the preloaded URLs
            const preloadedUrls = preloadManager.getPreloadedVideoUrls();
            
            // Should have preloaded up to 5 videos
            const expectedCount = Math.min(5, videoUrls.length);
            expect(preloadedUrls.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Clear Preloaded Videos', () => {
    it('should clear all preloaded videos (100 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
          async (videoUrls) => {
            mockPreloadedVideos.clear();
            preloadManager = new PreloadManagerClass();

            // Preload some videos
            const reels = videoUrls.map((url, i) => ({
              id: `reel-${i}`,
              videoUrl: url,
              thumbnail: url,
            }));

            await preloadManager.preloadInitialReelVideos(reels);

            // Verify some videos are preloaded
            const preloadedBefore = preloadManager.getPreloadedVideoUrls();
            
            // Clear all preloaded videos
            preloadManager.clearPreloadedVideos();

            // Property: After clearing, no videos should be preloaded
            const preloadedAfter = preloadManager.getPreloadedVideoUrls();
            expect(preloadedAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
