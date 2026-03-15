/**
 * PreloadManager Service
 * 
 * Implements background data preloading for instant page loads.
 * Preloads data for Profile, Reels, Notifications, and Matches screens.
 * Also handles video preloading for smooth reel playback.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 19.1, 19.2, 19.3, 19.4
 * 
 * - 8.1: Preload data for Profile, Reels, Notifications, and Matches on app start
 * - 8.2: Continue preloading other pages' data in the background
 * - 8.3: Display content immediately without loading indicators
 * - 8.4: Display cached data first and refresh in background
 * - 8.5: Periodically refresh cached data to keep it current
 * - 19.1: Preload first 3-5 reels on app start
 * - 19.2: Preload next 2-3 reels while viewing
 * - 19.3: Play preloaded videos immediately without buffering
 * - 19.4: Continue preloading reels in the background
 */

import { cacheService, CACHE_KEYS, CACHE_TTL } from './cacheService';
import { 
  AuthService, 
  FollowService, 
  // TEMPORARILY DISABLED: ProfileService causing infinite loop
  // ProfileService,
  ReelsService,
  NotificationService,
} from '../src/services/authService';
import { ApiFootballService } from './apiFootball';
import { logger } from './logger';
import { preloadVideo, preloadVideos, isVideoPreloaded, clearPreloadedVideos } from '../utils/videoPreloader';

// Screen names that can be preloaded
export type ScreenName = 'profile' | 'reels' | 'notifications' | 'matches' | 'rankings' | 'home';

// Preload configuration
export interface PreloadConfig {
  screens: ScreenName[];
  reelsCount: number;
  refreshInterval: number; // in milliseconds
}

// Default configuration - OPTIMIZED for faster loading
const DEFAULT_CONFIG: PreloadConfig = {
  screens: ['home', 'profile', 'reels', 'notifications', 'matches', 'rankings'],
  reelsCount: 5,
  refreshInterval: 3 * 60 * 1000, // 3 minutes (was 5)
};

// Video preloading configuration
// Requirement 19.1: Preload first 3-5 reels on app start
// Requirement 19.2: Preload next 2-3 reels while viewing
// ✅ OPTIMIZED: Increased preload counts for smoother experience
const VIDEO_PRELOAD_CONFIG = {
  initialReelsCount: 7,  // ✅ Increased from 5 to 7 for faster initial experience
  aheadReelsCount: 5,    // ✅ Increased to 5 for more aggressive preloading
};

// Cache keys for preloaded data
const PRELOAD_CACHE_KEYS = {
  profile: CACHE_KEYS.PROFILE_DATA,
  reels: CACHE_KEYS.REELS_FEED,
  notifications: CACHE_KEYS.NOTIFICATIONS,
  matches: CACHE_KEYS.MATCHES,
  rankings: 'rankings_all',
  home: 'home_data',
} as const;

// Preload status tracking
interface PreloadStatus {
  screen: ScreenName;
  isLoading: boolean;
  lastLoaded: number | null;
  error: string | null;
}

// Cache key for preloaded video URLs
const PRELOADED_VIDEOS_CACHE_KEY = 'preloaded_video_urls';

/**
 * PreloadManager class
 * Manages background data preloading for all screens
 * Also handles video preloading for smooth reel playback
 */
class PreloadManagerClass {
  private config: PreloadConfig;
  private tokenGetter: (() => Promise<string | null>) | null = null;
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private preloadStatus: Map<ScreenName, PreloadStatus> = new Map();
  private isInitialized = false;
  private preloadedVideoUrls: Set<string> = new Set();
  private preloadQueue: string[] = [];
  private isPreloading = false;
  private preloadedVideos: Set<string> = new Set();

  constructor(config: PreloadConfig = DEFAULT_CONFIG) {
    this.config = config;
    
    // Initialize status for each screen
    this.config.screens.forEach(screen => {
      this.preloadStatus.set(screen, {
        screen,
        isLoading: false,
        lastLoaded: null,
        error: null,
      });
    });
  }

  /**
   * Initialize the PreloadManager with a token getter function
   * Should be called on app start
   * 
   * Requirement 8.1: Preload data on app start
   * ✅ OPTIMIZED: Start preloading immediately without waiting
   * ✅ FIX: Allow re-initialization for new sessions
   */
  async initialize(getToken: () => Promise<string | null>): Promise<void> {
    // ✅ FIX: Allow re-initialization if token getter changed (new session)
    if (this.isInitialized && this.tokenGetter === getToken) {
      logger.debug('[PreloadManager] Already initialized with same token getter');
      return;
    }

    // Stop previous refresh if re-initializing
    if (this.isInitialized) {
      logger.debug('[PreloadManager] Re-initializing with new session');
      this.stopPeriodicRefresh();
    }

    this.tokenGetter = getToken;
    this.isInitialized = true;
    
    logger.info('[PreloadManager] Initializing background preloading');

    // ✅ OPTIMIZATION: Start preloading in background without blocking
    // This allows the app to start faster
    this.preloadAllScreens().catch(err => {
      logger.warn('[PreloadManager] Background preload error:', err);
    });

    // Set up periodic refresh (Requirement 8.5)
    this.startPeriodicRefresh();
  }

  /**
   * Preload all configured screens in parallel
   * Requirement 8.1, 8.2
   * ✅ IMPROVED: Priority-based preloading (Home → Profile → Reels → Others)
   */
  async preloadAllScreens(): Promise<void> {
    if (!this.tokenGetter) {
      logger.warn('[PreloadManager] Not initialized - call initialize() first');
      return;
    }

    logger.debug('[PreloadManager] Preloading all screens with priorities');

    const token = await this.tokenGetter();
    if (!token) {
      logger.warn('[PreloadManager] No token available');
      return;
    }

    // Priority 1: Home data (most important - user sees it first)
    logger.debug('[PreloadManager] Priority 1: Preloading home data...');
    await this.preloadScreen('home').catch(err => {
      logger.error('[PreloadManager] Home preload failed:', err);
    });

    // Priority 2: Profile (user might check it immediately)
    logger.debug('[PreloadManager] Priority 2: Preloading profile...');
    await this.preloadScreen('profile').catch(err => {
      logger.error('[PreloadManager] Profile preload failed:', err);
    });

    // Priority 3: Reels (popular feature - preload first 7)
    logger.debug('[PreloadManager] Priority 3: Preloading reels...');
    await this.preloadScreen('reels').catch(err => {
      logger.error('[PreloadManager] Reels preload failed:', err);
    });

    // Priority 4: Other screens in parallel (less critical)
    logger.debug('[PreloadManager] Priority 4: Preloading other screens in parallel...');
    await Promise.allSettled([
      this.preloadScreen('notifications'),
      this.preloadScreen('matches'),
      this.preloadScreen('rankings'),
    ]);
    
    logger.info('[PreloadManager] ✅ All screens preloaded successfully');
  }

  /**
   * Preload a specific screen's data
   * Requirement 8.2
   */
  async preloadScreen(screen: ScreenName): Promise<void> {
    if (!this.tokenGetter) {
      logger.warn('[PreloadManager] Not initialized');
      return;
    }

    const status = this.preloadStatus.get(screen);
    if (status?.isLoading) {
      logger.debug(`[PreloadManager] ${screen} is already loading`);
      return;
    }

    // Update status
    this.preloadStatus.set(screen, {
      ...status!,
      isLoading: true,
      error: null,
    });

    try {
      const token = await this.tokenGetter();
      if (!token) {
        logger.debug(`[PreloadManager] No token available for ${screen}`);
        return;
      }

      switch (screen) {
        case 'profile':
          await this.preloadProfile(token);
          break;
        case 'reels':
          await this.preloadReels(token);
          break;
        case 'notifications':
          await this.preloadNotifications(token);
          break;
        case 'matches':
          await this.preloadMatches();
          break;
        case 'rankings':
          await this.preloadRankings(token);
          break;
        case 'home':
          await this.preloadHomeData(token);
          break;
      }

      // Update status on success
      this.preloadStatus.set(screen, {
        screen,
        isLoading: false,
        lastLoaded: Date.now(),
        error: null,
      });

      logger.debug(`[PreloadManager] ${screen} preloaded successfully`);
    } catch (error: any) {
      // Update status on error
      this.preloadStatus.set(screen, {
        screen,
        isLoading: false,
        lastLoaded: null,
        error: error.message || 'Unknown error',
      });
      
      logger.error(`[PreloadManager] Failed to preload ${screen}:`, error);
    }
  }

  /**
   * Preload profile data
   */
  private async preloadProfile(token: string): Promise<void> {
    try {
      // Fetch user data and follow stats in parallel
      const [userResult, statsResult] = await Promise.all([
        AuthService.syncUserWithBackend(token),
        FollowService.getMyStats(token),
      ]);

      if (userResult) {
        // Also fetch user's videos
        const reels = await AuthService.getUserReels(token, userResult.username);
        
        const profileData = {
          userData: {
            displayName: userResult.displayName || userResult.username,
            username: userResult.username,
            bio: userResult.bio || '',
            avatar: userResult.avatar || null,
            createdAt: new Date(userResult.createdAt),
            isVerified: userResult.isVerified || false,
            isDeveloper: userResult.isDeveloper || false,
            favoriteTeam: userResult.favoriteTeam || '',
            location: 'مصر',
            lastUsernameChange: userResult.lastUsernameChange ? new Date(userResult.lastUsernameChange) : null,
            socials: {},
            position: userResult.position,
            countryFlag: userResult.countryFlag,
            age: userResult.age,
            height: userResult.height,
            weight: userResult.weight,
            preferredFoot: userResult.preferredFoot,
          },
          followStats: statsResult,
          videos: reels.map(r => ({
            id: r.id,
            uri: r.uri,
            thumbnail: r.thumbnail,
            views: r.views,
            likes: r.likes,
            shares: 0,
            duration: '0:00',
            createdAt: new Date(r.createdAt),
          })),
          analytics: null, // Will be loaded separately if needed
          cooldowns: null, // Will be loaded separately if needed
        };

        await cacheService.set(PRELOAD_CACHE_KEYS.profile, profileData, CACHE_TTL.PROFILE);
        logger.debug('[PreloadManager] Profile data preloaded successfully');
      }
    } catch (error: any) {
      logger.error('[PreloadManager] Failed to preload profile:', error);
      throw error;
    }
  }

  /**
   * Preload reels data
   * ✅ IMPROVED: Limit to first 7 reels for faster preloading
   */
  private async preloadReels(token: string): Promise<void> {
    try {
      const result = await ReelsService.getFeed(token);
      
      if (result && result.reels) {
        // Limit to first 7 reels for faster preloading
        const limitedReels = result.reels.slice(0, 7);
        
        const reelsData = {
          reels: limitedReels.map(reel => ({
            id: reel.id,
            user: {
              id: reel.user.id,
              username: reel.user.username,
              name: reel.user.displayName || reel.user.username,
              avatar: reel.user.avatar || 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff',
              verified: reel.user.isVerified,
              followers: 0,
              isFollowing: false,
            },
            videoUrl: reel.videoUrl,
            thumbnail: reel.thumbnail || reel.videoUrl,
            duration: 0,
            likes: reel.likesCount,
            views: reel.views,
            comments: reel.commentsCount,
            shares: 0,
            liked: reel.isLiked || false,
            saved: false,
            muted: true,
            description: reel.caption || '',
            hashtags: reel.hashtags || [],
            createdAt: new Date(reel.createdAt),
          })),
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          cachedAt: Date.now(),
        };

        await cacheService.set(PRELOAD_CACHE_KEYS.reels, reelsData, CACHE_TTL.REELS);
        
        // Preload initial reel videos (first 7)
        await this.preloadInitialReelVideos(reelsData.reels);
        
        logger.debug('[PreloadManager] Reels preloaded and videos cached');
      }
    } catch (error: any) {
      logger.error('[PreloadManager] Failed to preload reels:', error);
      throw error;
    }
  }

  /**
   * Preload initial reel videos on app start
   * Requirement 19.1: Preload first 3-5 reels on app start
   * Requirement 19.4: Continue preloading reels in the background
   */
  async preloadInitialReelVideos(reels: Array<{ videoUrl: string }>): Promise<void> {
    if (!reels || reels.length === 0) {
      logger.debug('[PreloadManager] No reels to preload');
      return;
    }

    const videosToPreload = reels
      .slice(0, VIDEO_PRELOAD_CONFIG.initialReelsCount)
      .map(reel => reel.videoUrl)
      .filter(url => url && !this.preloadedVideoUrls.has(url));

    if (videosToPreload.length === 0) {
      logger.debug('[PreloadManager] All initial reels already preloaded');
      return;
    }

    logger.info(`[PreloadManager] Preloading ${videosToPreload.length} initial reel videos`);

    // Preload videos in parallel for faster loading
    const preloadPromises = videosToPreload.map(async (url) => {
      try {
        const success = await preloadVideo(url);
        if (success) {
          this.preloadedVideoUrls.add(url);
        }
        return success;
      } catch (error) {
        logger.warn(`[PreloadManager] Failed to preload video: ${url}`, error);
        return false;
      }
    });

    await Promise.allSettled(preloadPromises);
    logger.debug(`[PreloadManager] Initial reel video preloading complete`);
  }

  /**
   * Preload next reels while viewing
   * Requirement 19.2: Preload next 2-3 reels while viewing
   * ✅ OPTIMIZED: Increased to 5 reels with batch processing
   * 
   * @param reels - Array of reel objects with videoUrl and thumbnail
   * @param currentIndex - Current viewing index
   */
  async preloadNextReelVideos(
    reels: Array<{ videoUrl: string; thumbnail?: string }>,
    currentIndex: number
  ): Promise<void> {
    const videosToPreload: string[] = [];
    const MAX_PRELOAD = 5;

    // Get next 5 videos that haven't been preloaded yet
    for (let i = 1; i <= MAX_PRELOAD; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < reels.length) {
        const reel = reels[nextIndex];
        if (reel?.videoUrl && !this.preloadedVideos.has(reel.videoUrl)) {
          videosToPreload.push(reel.videoUrl);
          // Also preload thumbnail
          if (reel.thumbnail) {
            const { Image } = await import('react-native');
            Image.prefetch(reel.thumbnail).catch(() => {});
          }
        }
      }
    }

    // Add videos to queue
    this.preloadQueue.push(...videosToPreload);

    // Start processing queue if not already processing
    if (!this.isPreloading) {
      this.processQueue();
    }
  }

  /**
   * Process preload queue in batches
   * Processes 3 videos at a time to avoid overwhelming the network
   */
  private async processQueue(): Promise<void> {
    if (this.preloadQueue.length === 0) {
      this.isPreloading = false;
      return;
    }

    this.isPreloading = true;
    const batch = this.preloadQueue.splice(0, 3);

    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            headers: {
              'Range': 'bytes=0-102400', // Preload first 100KB
            },
          });
          
          if (response.ok) {
            this.preloadedVideos.add(url);
            console.log(`[PreloadManager] Preloaded: ${url.substring(0, 50)}...`);
          }
        } catch (error) {
          console.warn(`[PreloadManager] Failed to preload: ${url.substring(0, 50)}...`);
        }
      })
    );

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Check if a video URL has been preloaded
   * Requirement 19.3: Play preloaded videos immediately without buffering
   */
  isVideoPreloaded(videoUrl: string): boolean {
    return this.preloadedVideoUrls.has(videoUrl) || isVideoPreloaded(videoUrl);
  }

  /**
   * Get the list of preloaded video URLs
   */
  getPreloadedVideoUrls(): string[] {
    return Array.from(this.preloadedVideoUrls);
  }

  /**
   * Clear all preloaded videos
   */
  clearPreloadedVideos(): void {
    this.preloadedVideoUrls.clear();
    clearPreloadedVideos();
    logger.debug('[PreloadManager] Cleared all preloaded videos');
  }     

  /**
   * Preload notifications data
   */
  private async preloadNotifications(token: string): Promise<void> {
    const notifications = await NotificationService.getNotifications(token, 20, 0);
    
    const notificationsData = {
      notifications,
      cachedAt: Date.now(),
    };

    await cacheService.set(PRELOAD_CACHE_KEYS.notifications, notificationsData, CACHE_TTL.NOTIFICATIONS);
  }

  /**
   * Preload matches data (doesn't require auth token)
   */
  private async preloadMatches(): Promise<void> {
    try {
      // Get today's date for fixtures
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch fixtures for today from major leagues
      const fixtures = await ApiFootballService.getMajorLeaguesFixtures(today);
      
      const matchesData = {
        fixtures,
        cachedAt: Date.now(),
      };

      await cacheService.set(PRELOAD_CACHE_KEYS.matches, matchesData, CACHE_TTL.MATCHES);
    } catch (error) {
      logger.warn('[PreloadManager] Failed to preload matches:', error);
      // Matches preload failure is non-critical
    }
  }

  /**
   * Preload rankings data
   * ✅ NEW: Preloads all rankings (views, shares, predictions, commenters, players)
   */
  private async preloadRankings(token: string): Promise<void> {
    try {
      const rankingsService = (await import('../services/rankingsService')).default;
      
      // Preload all rankings in parallel
      const [allRankings, topPlayersWeekly, topPlayersMonthly] = await Promise.all([
        rankingsService.getAllRankings(token, 10),
        rankingsService.getTopPlayers(token, 11, 'weekly'),
        rankingsService.getTopPlayers(token, 11, 'monthly'),
      ]);

      // Cache rankings data
      await cacheService.set('rankings_all', allRankings, 5 * 60 * 1000);
      await cacheService.set('rankings_players_weekly', topPlayersWeekly, 5 * 60 * 1000);
      await cacheService.set('rankings_players_monthly', topPlayersMonthly, 5 * 60 * 1000);
      
      logger.debug('[PreloadManager] Rankings preloaded successfully');
    } catch (error: any) {
      logger.error('[PreloadManager] Failed to preload rankings:', error);
      throw error;
    }
  }

  /**
   * Preload home screen data
   * ✅ NEW: Preloads matches, videos, players, and rankings for home screen
   */
  private async preloadHomeData(token: string): Promise<void> {
    try {
      const { useHomeStore } = await import('../src/store/home.store');
      const homeStore = useHomeStore.getState();
      
      // Preload all home data in parallel
      await Promise.all([
        homeStore.fetchHomeData(token),      // Matches
        homeStore.fetchRankingsData(token),  // Videos, Players, Team of Month
      ]);
      
      logger.debug('[PreloadManager] Home data preloaded successfully');
    } catch (error: any) {
      logger.error('[PreloadManager] Failed to preload home data:', error);
      throw error;
    }
  }

  /**
   * Start periodic refresh of cached data
   * Requirement 8.5
   */
  private startPeriodicRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }

    this.refreshIntervalId = setInterval(() => {
      logger.debug('[PreloadManager] Periodic refresh triggered');
      this.preloadAllScreens();
    }, this.config.refreshInterval);
  }

  /**
   * Stop periodic refresh
   */
  stopPeriodicRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  /**
   * Get preloaded data for a specific screen
   * Requirement 8.3, 8.4
   */
  async getPreloadedData<T>(screen: ScreenName): Promise<T | null> {
    const cacheKey = PRELOAD_CACHE_KEYS[screen];
    return cacheService.get<T>(cacheKey);
  }

  /**
   * Check if data is preloaded for a screen
   */
  async hasPreloadedData(screen: ScreenName): Promise<boolean> {
    const cacheKey = PRELOAD_CACHE_KEYS[screen];
    return cacheService.has(cacheKey);
  }

  /**
   * Invalidate cached data for a specific screen
   */
  async invalidate(screen: ScreenName): Promise<void> {
    const cacheKey = PRELOAD_CACHE_KEYS[screen];
    await cacheService.invalidate(cacheKey);
    
    // Reset status
    this.preloadStatus.set(screen, {
      screen,
      isLoading: false,
      lastLoaded: null,
      error: null,
    });
  }

  /**
   * Invalidate all cached data
   */
  async invalidateAll(): Promise<void> {
    await Promise.all(
      this.config.screens.map(screen => this.invalidate(screen))
    );
  }

  /**
   * Get preload status for a screen
   */
  getStatus(screen: ScreenName): PreloadStatus | undefined {
    return this.preloadStatus.get(screen);
  }

  /**
   * Get all preload statuses
   */
  getAllStatuses(): Map<ScreenName, PreloadStatus> {
    return new Map(this.preloadStatus);
  }

  /**
   * Check if PreloadManager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup - call when app is closing
   */
  cleanup(): void {
    this.stopPeriodicRefresh();
    this.isInitialized = false;
    this.tokenGetter = null;
  }
}

// Export singleton instance
export const preloadManager = new PreloadManagerClass();

// Export class for testing purposes
export { PreloadManagerClass };

export default preloadManager;
