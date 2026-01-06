/**
 * useProfileCache Hook
 * Implements cache-first loading pattern for profile data with background refresh.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
 * 
 * - 2.1: Display cached data immediately if available
 * - 2.2: Fetch fresh data from backend in background
 * - 2.3: Update display without full page reload
 * - 2.5: Cache data locally for future visits
 * - 2.6: Load user info, follow stats, and videos in parallel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../services/cacheService';
import { 
  AuthService, 
  FollowService, 
  ProfileService,
  UserProfile,
  FollowStats,
  UserReel,
  ProfileAnalytics,
  CooldownsResponse
} from '../src/services/authService';

// Extended user data type for profile screen
export interface ProfileUserData {
  id: string; // User ID for badges and other features
  displayName: string;
  username: string;
  bio: string;
  avatar: string | null;
  createdAt: Date;
  isVerified: boolean;
  isDeveloper: boolean;
  favoriteTeam: string;
  location: string;
  lastUsernameChange: Date | null;
  socials?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
  };
  socialLinks?: Array<{
    platform: string;
    url: string;
    username?: string;
  }>;
  // FIFA Card fields
  position?: string;
  countryFlag?: string;
  age?: number;
  height?: number;
  weight?: number;
  preferredFoot?: string;
  clubLogo?: string;
  brandLogo?: string;
  coverImage?: string;
  consecutiveLoginDays?: number; // أيام تسجيل الدخول المتتالية
}

// Video type for profile
export interface ProfileVideo {
  id: string;
  uri: string;
  thumbnail: string | null;
  views: string;
  likes: number;
  shares: number;
  duration: string;
  createdAt: Date;
}

// Cache data structure
export interface ProfileCacheData {
  userData: ProfileUserData | null;
  followStats: FollowStats | null;
  videos: ProfileVideo[];
  analytics: ProfileAnalytics | null;
  cooldowns: CooldownsResponse | null;
}

export interface UseProfileCacheOptions {
  getToken: () => Promise<string | null>;
  clerkUserImageUrl?: string;
  onCacheHit?: () => void;
  onFreshDataLoaded?: () => void;
}

export interface UseProfileCacheResult {
  userData: ProfileUserData | null;
  followStats: FollowStats | null;
  videos: ProfileVideo[];
  analytics: ProfileAnalytics | null;
  cooldowns: CooldownsResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isCacheHit: boolean;
  error: string | null;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  loadVideos: (username: string) => Promise<void>;
  updateUserData: (updates: Partial<ProfileUserData>) => void;
  updateFollowStats: (stats: FollowStats) => void;
  invalidateCache: () => Promise<void>;
}

/**
 * Hook for managing profile data with cache-first loading pattern.
 * 
 * Property 2: Cache-First Profile Loading
 * - For any cached profile data, when navigating to the profile screen,
 *   the cached data should be displayed before any network request completes.
 * 
 * Property 3: Profile Data Caching
 * - For any successfully loaded profile data, the data should be stored
 *   in cache with a valid timestamp for future retrieval.
 */
export function useProfileCache(options: UseProfileCacheOptions): UseProfileCacheResult {
  const { getToken, clerkUserImageUrl, onCacheHit, onFreshDataLoaded } = options;
  
  // State
  const [userData, setUserData] = useState<ProfileUserData | null>(null);
  const [followStats, setFollowStats] = useState<FollowStats | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [cooldowns, setCooldowns] = useState<CooldownsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCacheHit, setIsCacheHit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to track loading state and callbacks (to avoid infinite loops)
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const onCacheHitRef = useRef(onCacheHit);
  const onFreshDataLoadedRef = useRef(onFreshDataLoaded);
  
  // Update refs when callbacks change
  onCacheHitRef.current = onCacheHit;
  onFreshDataLoadedRef.current = onFreshDataLoaded;

  /**
   * Load cached data immediately (Requirement 2.1)
   * Validates that cached data is valid before using it
   */
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    try {
      const cachedData = await cacheService.get<ProfileCacheData>(CACHE_KEYS.PROFILE_DATA);
      
      if (cachedData) {
        // Validate cached data - ensure userData exists and has required fields
        // This prevents showing stale data from a different user after logout/login
        if (!cachedData.userData || !cachedData.userData.username || !cachedData.userData.id) {
          console.warn('[useProfileCache] Invalid cached data detected (missing user info), clearing cache');
          await cacheService.invalidate(CACHE_KEYS.PROFILE_DATA);
          return false;
        }
        
        // Restore dates from cached data
        if (cachedData.userData) {
          cachedData.userData.createdAt = new Date(cachedData.userData.createdAt);
          if (cachedData.userData.lastUsernameChange) {
            cachedData.userData.lastUsernameChange = new Date(cachedData.userData.lastUsernameChange);
          }
        }
        if (cachedData.videos) {
          cachedData.videos = cachedData.videos.map(v => ({
            ...v,
            createdAt: new Date(v.createdAt)
          }));
        }
        
        setUserData(cachedData.userData);
        setFollowStats(cachedData.followStats);
        setVideos(cachedData.videos || []);
        setAnalytics(cachedData.analytics);
        setCooldowns(cachedData.cooldowns);
        setIsCacheHit(true);
        onCacheHitRef.current?.();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useProfileCache] Error loading from cache:', err);
      return false;
    }
  }, []); // No dependencies - uses refs

  /**
   * Save data to cache (Requirement 2.5)
   */
  const saveToCache = useCallback(async (data: ProfileCacheData): Promise<void> => {
    try {
      await cacheService.set(CACHE_KEYS.PROFILE_DATA, data, CACHE_TTL.PROFILE);
    } catch (err) {
      console.error('[useProfileCache] Error saving to cache:', err);
    }
  }, []);

  /**
   * Transform backend user profile to ProfileUserData
   */
  const transformUserProfile = useCallback((user: UserProfile, fallbackAvatar?: string): ProfileUserData => {
    return {
      id: user.id, // Include user ID for badges and other features
      displayName: user.displayName || user.username,
      username: user.username,
      bio: user.bio || '',
      avatar: user.avatar || fallbackAvatar || null,
      createdAt: new Date(user.createdAt),
      isVerified: user.isVerified || false,
      isDeveloper: user.isDeveloper || false,
      favoriteTeam: user.favoriteTeam || '',
      location: 'مصر',
      lastUsernameChange: user.lastUsernameChange ? new Date(user.lastUsernameChange) : null,
      socials: { instagram: undefined, twitter: undefined, facebook: undefined },
      socialLinks: (user as any).socialLinks && Array.isArray((user as any).socialLinks) 
        ? (user as any).socialLinks 
        : undefined,
      position: user.position || undefined,
      countryFlag: user.countryFlag || undefined,
      age: user.age || undefined,
      height: user.height || undefined,
      weight: user.weight || undefined,
      preferredFoot: user.preferredFoot || undefined,
      clubLogo: user.clubLogo || undefined,
      brandLogo: user.brandLogo || undefined,
      coverImage: user.coverImage || undefined,
      consecutiveLoginDays: (user as any).consecutiveLoginDays || 0,
    };
  }, []);

  /**
   * Transform backend reels to ProfileVideo
   */
  const transformReels = useCallback((reels: UserReel[]): ProfileVideo[] => {
    return reels.map(r => ({
      id: r.id,
      uri: r.uri,
      thumbnail: r.thumbnail,
      views: r.views,
      likes: r.likes,
      shares: 0,
      duration: '0:00',
      createdAt: new Date(r.createdAt),
    }));
  }, []);

  /**
   * Fetch fresh data from backend (Requirement 2.2, 2.6)
   * Loads user info, follow stats, and videos in FULLY parallel
   */
  const fetchFreshData = useCallback(async (forceRefresh = false): Promise<void> => {
    if (isLoadingRef.current && !forceRefresh) return;
    
    isLoadingRef.current = true;
    setError(null);
    
    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      // FULLY PARALLEL: Fetch ALL data at once including videos
      // We get username from cache or use 'me' endpoint pattern
      const [userResult, statsResult, analyticsResult, cooldownsResult] = await Promise.all([
        AuthService.syncUserWithBackend(token),
        FollowService.getMyStats(token),
        ProfileService.getAnalytics(token),
        ProfileService.getCooldowns(token),
      ]);

      let newUserData: ProfileUserData | null = null;
      let newVideos: ProfileVideo[] = [];

      // Now fetch videos - this is the only sequential part (needs username)
      // But we update UI immediately with user data first
      if (userResult) {
        newUserData = transformUserProfile(userResult, clerkUserImageUrl);
        
        // Validate user data before setting
        if (!newUserData.username || !newUserData.id) {
          console.error('[useProfileCache] Invalid user data received from backend');
          setError('Invalid user data received');
          return;
        }
        
        // Update state IMMEDIATELY - don't wait for videos
        setUserData(newUserData);
        
        if (statsResult) {
          setFollowStats(statsResult);
        }
        if (analyticsResult) {
          setAnalytics(analyticsResult);
        }
        if (cooldownsResult) {
          setCooldowns(cooldownsResult);
        }
        
        // Fetch videos in background (non-blocking for UI)
        AuthService.getUserReels(token, userResult.username)
          .then(reels => {
            newVideos = transformReels(reels);
            setVideos(newVideos);
            
            // Update cache with complete data
            const cacheData: ProfileCacheData = {
              userData: newUserData,
              followStats: statsResult,
              videos: newVideos,
              analytics: analyticsResult,
              cooldowns: cooldownsResult,
            };
            saveToCache(cacheData);
          })
          .catch(err => console.error('[useProfileCache] Error loading videos:', err));
        
        hasLoadedRef.current = true;
        onFreshDataLoadedRef.current?.();
        return; // Exit early - videos loading in background
      }

      if (statsResult) {
        setFollowStats(statsResult);
      }

      if (analyticsResult) {
        setAnalytics(analyticsResult);
      }

      if (cooldownsResult) {
        setCooldowns(cooldownsResult);
      }

      // Save to cache (Requirement 2.5)
      const cacheData: ProfileCacheData = {
        userData: newUserData,
        followStats: statsResult,
        videos: newVideos,
        analytics: analyticsResult,
        cooldowns: cooldownsResult,
      };
      await saveToCache(cacheData);
      
      hasLoadedRef.current = true;
      onFreshDataLoadedRef.current?.();
    } catch (err: any) {
      console.error('[useProfileCache] Error fetching fresh data:', err);
      setError(err.message || 'Failed to load profile data');
    } finally {
      isLoadingRef.current = false;
    }
  }, [getToken, clerkUserImageUrl, transformUserProfile, transformReels, saveToCache]); // Removed onFreshDataLoaded - uses ref

  /**
   * Main refresh function - implements cache-first pattern
   */
  const refresh = useCallback(async (forceRefresh = false): Promise<void> => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // Step 1: Try to load from cache first (Requirement 2.1)
      if (!forceRefresh && !hasLoadedRef.current) {
        const hasCachedData = await loadFromCache();
        
        if (hasCachedData) {
          // Show cached data immediately, then fetch fresh in background
          setIsLoading(false);
        }
      }

      // Step 2: Fetch fresh data in background (Requirement 2.2)
      await fetchFreshData(forceRefresh);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadFromCache, fetchFreshData]);

  /**
   * Load videos for a specific username
   */
  const loadVideos = useCallback(async (username: string): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) return;

      const reels = await AuthService.getUserReels(token, username);
      const transformedVideos = transformReels(reels);
      setVideos(transformedVideos);

      // Update cache with new videos
      const currentCache = await cacheService.get<ProfileCacheData>(CACHE_KEYS.PROFILE_DATA);
      if (currentCache) {
        await saveToCache({
          ...currentCache,
          videos: transformedVideos,
        });
      }
    } catch (err) {
      console.error('[useProfileCache] Error loading videos:', err);
    }
  }, [getToken, transformReels, saveToCache]);

  /**
   * Update user data locally (for optimistic updates)
   * Also updates cache immediately
   */
  const updateUserData = useCallback(async (updates: Partial<ProfileUserData>): Promise<void> => {
    setUserData(prev => prev ? { ...prev, ...updates } : null);
    
    // Update cache immediately with new data
    const currentCache = await cacheService.get<ProfileCacheData>(CACHE_KEYS.PROFILE_DATA);
    if (currentCache && currentCache.userData) {
      await saveToCache({
        ...currentCache,
        userData: { ...currentCache.userData, ...updates },
      });
    }
  }, [saveToCache]);

  /**
   * Update follow stats locally
   */
  const updateFollowStats = useCallback((stats: FollowStats): void => {
    setFollowStats(stats);
  }, []);

  /**
   * Invalidate cache
   */
  const invalidateCache = useCallback(async (): Promise<void> => {
    await cacheService.invalidate(CACHE_KEYS.PROFILE_DATA);
    hasLoadedRef.current = false;
    setIsCacheHit(false);
  }, []);

  // Initial load on mount
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    userData,
    followStats,
    videos,
    analytics,
    cooldowns,
    isLoading,
    isRefreshing,
    isCacheHit,
    error,
    refresh,
    loadVideos,
    updateUserData,
    updateFollowStats,
    invalidateCache,
  };
}

export default useProfileCache;
