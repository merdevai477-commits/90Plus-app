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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cacheService, CACHE_KEYS, CACHE_TTL, getUserCacheKey } from '../services/cacheService';
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
import { logger } from '../services/logger';

// ─── In-Memory Profile Cache (instant load like matches page) ───────────────
// Persists across navigations within the same app session.
// AsyncStorage is still used as the durable layer, but this avoids the
// async deserialization cost on every tab focus.
const profileMemoryCache = new Map<string, { data: ProfileCacheData; timestamp: number }>();
const MEMORY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes — same as PROFILE_UI_REFRESH_INTERVAL_MS

function getFromMemoryCache(key: string): ProfileCacheData | null {
  const entry = profileMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MEMORY_CACHE_TTL) {
    profileMemoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setMemoryCache(key: string, data: ProfileCacheData): void {
  profileMemoryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Exported for use by PreloadManager — allows preloaded data to be
 * written directly into the memory cache so the profile opens with
 * zero latency (no AsyncStorage read needed).
 */
export function setProfileMemoryCache(key: string, data: ProfileCacheData): void {
  setMemoryCache(key, data);
}

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
  country?: string; // Country name in Arabic
  age?: number;
  height?: number;
  weight?: number;
  preferredFoot?: string;
  clubLogo?: string;
  brandLogo?: string;
  favoriteBrand?: string; // Brand name in Arabic
  coverImage?: string;
  consecutiveLoginDays?: number; // أيام تسجيل الدخول المتتالية
  // Level & XP fields for LevelCard
  level?: number;
  xp?: number;
  coins?: number;
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
  status?: 'READY' | 'PROCESSING' | 'FAILED';
  isProcessing?: boolean;
  isFailed?: boolean;
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

/** When /clerk/me fails, build a usable profile from Clerk until the API recovers */
export interface ClerkFallbackProfile {
  clerkUserId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  primaryEmail?: string | null;
}

export function buildClerkFallbackUserData(
  cf: ClerkFallbackProfile,
  imageFallback?: string | null
): ProfileUserData {
  const emailLocal =
    cf.primaryEmail
      ?.split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9_]/g, '') || '';
  let username = (cf.username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!username && emailLocal) username = emailLocal;
  if (!username) username = `user_${cf.clerkUserId.slice(-8)}`;
  const displayName =
    [cf.firstName, cf.lastName].filter(Boolean).join(' ').trim() || username;
  return {
    id: cf.clerkUserId,
    displayName,
    username,
    bio: '',
    avatar: imageFallback || cf.imageUrl || null,
    createdAt: new Date(),
    isVerified: false,
    isDeveloper: false,
    favoriteTeam: '',
    location: '',
    lastUsernameChange: null,
    socials: { instagram: undefined, twitter: undefined, facebook: undefined },
    socialLinks: undefined,
    consecutiveLoginDays: 0,
  };
}

export interface UseProfileCacheOptions {
  getToken: () => Promise<string | null>;
  clerkUserImageUrl?: string;
  clerkUserId?: string; // Add user ID for cache key
  /** If API returns 5xx, still open profile using Clerk session data */
  clerkFallback?: ClerkFallbackProfile | null;
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
  loadVideos: (username: string, bustCache?: boolean) => Promise<void>;
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
  const { getToken, clerkUserImageUrl, clerkUserId, clerkFallback, onCacheHit, onFreshDataLoaded } = options;
  
  // Generate user-specific cache key
  const cacheKey = useMemo(() => {
    if (clerkUserId) {
      return getUserCacheKey(CACHE_KEYS.PROFILE_DATA, clerkUserId);
    }
    return CACHE_KEYS.PROFILE_DATA; // Fallback to base key if no user ID
  }, [clerkUserId]);
  
  // ─── INSTANT LOAD: Initialize state SYNCHRONOUSLY from memory cache ───
  // This is the key to "faster than a blink" — no async, no skeleton frame.
  // The matches page uses this exact pattern.
  const initialMemData = useMemo(() => getFromMemoryCache(cacheKey), [cacheKey]);
  const hasInitialData = !!initialMemData?.userData;
  
  // State — pre-populated from memory cache if available
  const [userData, setUserData] = useState<ProfileUserData | null>(initialMemData?.userData || null);
  const [followStats, setFollowStats] = useState<FollowStats | null>(initialMemData?.followStats || null);
  const [videos, setVideos] = useState<ProfileVideo[]>(initialMemData?.videos || []);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(initialMemData?.analytics || null);
  const [cooldowns, setCooldowns] = useState<CooldownsResponse | null>(initialMemData?.cooldowns || null);
  const [isLoading, setIsLoading] = useState(!hasInitialData); // No loading if we have memory data
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCacheHit, setIsCacheHit] = useState(hasInitialData);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to track loading state and callbacks (to avoid infinite loops)
  const hasLoadedRef = useRef(hasInitialData);
  const isLoadingRef = useRef(false);
  const onCacheHitRef = useRef(onCacheHit);
  const onFreshDataLoadedRef = useRef(onFreshDataLoaded);
  
  // Update refs when callbacks change
  onCacheHitRef.current = onCacheHit;
  onFreshDataLoadedRef.current = onFreshDataLoaded;

  /**
   * Load cached data immediately (Requirement 2.1)
   * Checks in-memory cache first (instant), then falls back to AsyncStorage.
   */
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    try {
      // ✅ Try memory cache first (synchronous, instant — like matches page)
      const memCached = getFromMemoryCache(cacheKey);
      if (memCached && memCached.userData && memCached.userData.username && memCached.userData.id) {
        // Restore dates
        if (memCached.userData) {
          memCached.userData.createdAt = new Date(memCached.userData.createdAt);
          if (memCached.userData.lastUsernameChange) {
            memCached.userData.lastUsernameChange = new Date(memCached.userData.lastUsernameChange);
          }
        }
        if (memCached.videos) {
          memCached.videos = memCached.videos.map(v => ({
            ...v,
            createdAt: new Date(v.createdAt)
          }));
        }
        setUserData(memCached.userData);
        setFollowStats(memCached.followStats);
        setVideos(memCached.videos || []);
        setAnalytics(memCached.analytics);
        setCooldowns(memCached.cooldowns);
        setIsCacheHit(true);
        onCacheHitRef.current?.();
        return true;
      }

      // ✅ Fallback: AsyncStorage (allowStale: true - show expired cache rather than nothing)
      const cachedData = await cacheService.get<ProfileCacheData>(cacheKey, true);
      
      if (cachedData) {
        // Validate cached data - ensure userData exists and has required fields
        if (!cachedData.userData || !cachedData.userData.username || !cachedData.userData.id) {
          console.warn('[useProfileCache] Invalid cached data detected (missing user info), clearing cache');
          await cacheService.invalidate(cacheKey);
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
        // Promote to memory cache for next time
        setMemoryCache(cacheKey, cachedData);
        onCacheHitRef.current?.();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useProfileCache] Error loading from cache:', err);
      return false;
    }
  }, [cacheKey]); // Added cacheKey dependency

  /**
   * Save data to cache (Requirement 2.5)
   * Writes to both memory cache (instant) and AsyncStorage (durable).
   */
  const saveToCache = useCallback(async (data: ProfileCacheData): Promise<void> => {
    try {
      // Save to memory cache first (instant for next navigation)
      setMemoryCache(cacheKey, data);
      // Then persist to AsyncStorage
      await cacheService.set(cacheKey, data, CACHE_TTL.PROFILE);
    } catch (err) {
      console.error('[useProfileCache] Error saving to cache:', err);
    }
  }, [cacheKey]);

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
      location: (user as any).country || 'مصر', // ✅ Use country field from backend
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
      clubLogo: (user as any).clubLogo || undefined,
      brandLogo: (user as any).brandLogo || undefined,
      coverImage: (user as any).coverImage || undefined,
      consecutiveLoginDays: (user as any).consecutiveLoginDays || 0,
      level: (user as any).level || 1,
      xp: (user as any).xp || 0,
      coins: (user as any).coins || 0,
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
      status: r.status,
      // ✅ Surface processing/failed status as flags so VideoGrid renders the
      // overlay (instead of showing "No Preview" while Mux is still encoding).
      isProcessing: r.status === 'PROCESSING',
      isFailed: r.status === 'FAILED',
      createdAt: new Date(r.createdAt),
    }));
  }, []);

  /**
   * Fetch fresh data from backend (Requirement 2.2, 2.6)
   * Loads user info, follow stats, and videos in FULLY parallel
   * ✅ FIX: Health check runs in background (non-blocking)
   */
  const fetchFreshData = useCallback(async (forceRefresh = false): Promise<void> => {
    if (isLoadingRef.current && !forceRefresh) return;
    
    isLoadingRef.current = true;
    setError(null);
    
    try {
      logger.debug('[useProfileCache] Starting to fetch fresh data');
      
      // ✅ FIX: Run health check in background (non-blocking)
      // Don't wait for it - let it run async
      AuthService.checkApiHealth().then(isHealthy => {
        if (!isHealthy) {
          logger.warn('[useProfileCache] ⚠️ API health check failed (background check)');
        }
      }).catch(err => {
        logger.warn('[useProfileCache] ⚠️ API health check error (background check):', err);
      });
      
      const token = await getToken();
      if (!token) {
        console.error('[useProfileCache] ❌ No token available');
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      logger.debug('[useProfileCache] Token obtained, fetching data');

      // CRITICAL PATH: Only fetch what's needed to show the profile immediately.
      // analytics + cooldowns are deferred to background — they don't block the UI.
      const [userResult, statsResult] = await Promise.all([
        AuthService.syncUserWithBackend(token).catch(err => {
          console.error('[useProfileCache] ❌ Error fetching user:', err);
          return null;
        }),
        FollowService.getMyStats(token).catch(err => {
          console.error('[useProfileCache] ⚠️ Error fetching stats:', err);
          return null;
        }),
      ]);

      logger.debug('[useProfileCache] Data fetched:', {
        hasUser: !!userResult,
        hasStats: !!statsResult,
      });

      let newUserData: ProfileUserData | null = null;
      let newVideos: ProfileVideo[] = [];

      // Now fetch videos - this is the only sequential part (needs username)
      // But we update UI immediately with user data first
      if (userResult) {
        newUserData = transformUserProfile(userResult, clerkUserImageUrl);
        
        // Validate user data before setting
        if (!newUserData.username || !newUserData.id) {
          console.error('[useProfileCache] ❌ Invalid user data received from backend');
          setError('Invalid user data received');
          setIsLoading(false);
          return;
        }
        
        logger.debug('[useProfileCache] User data valid, updating state');
        
        // Update state IMMEDIATELY with critical data — don't wait for analytics/cooldowns/videos
        setUserData(newUserData);
        if (statsResult) setFollowStats(statsResult);
        
        // Mark as loaded IMMEDIATELY so UI shows
        hasLoadedRef.current = true;
        setIsLoading(false);
        onFreshDataLoadedRef.current?.();
        
        logger.debug('[useProfileCache] State updated, fetching secondary data in background');

        // ── BACKGROUND: analytics + cooldowns + videos (non-blocking) ──────
        // These don't block the initial render. They update state when ready.
        const bgToken = token; // capture for closure
        const bgUserData = newUserData;

        Promise.all([
          ProfileService.getAnalytics(bgToken).catch(err => {
            logger.warn('[useProfileCache] ⚠️ Error fetching analytics (bg):', err);
            return null;
          }),
          ProfileService.getCooldowns(bgToken).catch(err => {
            logger.warn('[useProfileCache] ⚠️ Error fetching cooldowns (bg):', err);
            return null;
          }),
          AuthService.getUserReels(bgToken, userResult.username).catch(err => {
            logger.warn('[useProfileCache] ⚠️ Error loading videos (bg):', err);
            return [] as any[];
          }),
        ]).then(([analyticsResult, cooldownsResult, reels]) => {
          if (analyticsResult) setAnalytics(analyticsResult);
          if (cooldownsResult) setCooldowns(cooldownsResult);

          newVideos = transformReels(reels ?? []);
          setVideos(newVideos);

          // Persist complete data to cache
          const cacheData: ProfileCacheData = {
            userData: bgUserData,
            followStats: statsResult,
            videos: newVideos,
            analytics: analyticsResult,
            cooldowns: cooldownsResult,
          };
          saveToCache(cacheData);
          logger.debug('[useProfileCache] Background data loaded and cached');
        });
        
        return; // Exit early — background tasks running
      } else {
        console.warn('[useProfileCache] ⚠️ No user data received from backend (server may be starting)');
        
        // ✅ FIX: Check if we have cached data to show - ALWAYS prefer cache over error screen
        const cachedData = await cacheService.get<ProfileCacheData>(cacheKey, true); // allowStale
        if (cachedData && cachedData.userData) {
          logger.info('[useProfileCache] ✅ Using cached data as fallback');
          setUserData(cachedData.userData);
          setFollowStats(cachedData.followStats);
          setVideos(cachedData.videos || []);
          setAnalytics(cachedData.analytics);
          setCooldowns(cachedData.cooldowns);
          hasLoadedRef.current = true;
          // Don't set error - just show cached data silently
          setError(null);
        } else if (clerkFallback?.clerkUserId) {
          logger.warn('[useProfileCache] ⚠️ Backend failed, but using blank Clerk fallback for UI. This will NOT overwrite cache.');
          const fd = buildClerkFallbackUserData(clerkFallback, clerkUserImageUrl);
          setUserData(fd);
          setFollowStats(null);
          setVideos([]);
          setAnalytics(null);
          setCooldowns(null);
          hasLoadedRef.current = true;
          setError(null);
          
          // 🚨 CRITICAL FIX: DO NOT call saveToCache() here!
          // We must NOT overwrite the user's permanent cache with an empty fallback profile
          // when the backend is merely timing out due to cold start.
        } else {
          setError('Failed to load user data');
        }
        
        setIsLoading(false);
        return;
      }
    } catch (err: any) {
      console.error('[useProfileCache] ❌ Error fetching fresh data:', err);
      
      // ✅ FIX: Try to show cached data if available
      try {
        const cachedData = await cacheService.get<ProfileCacheData>(cacheKey, true); // allowStale
        if (cachedData && cachedData.userData) {
          logger.info('[useProfileCache] ✅ Using cached data after error');
          setUserData(cachedData.userData);
          setFollowStats(cachedData.followStats);
          setVideos(cachedData.videos || []);
          setAnalytics(cachedData.analytics);
          setCooldowns(cachedData.cooldowns);
          hasLoadedRef.current = true;
          setError(null); // Don't show error if we have cached data
        } else if (clerkFallback?.clerkUserId) {
          const fd = buildClerkFallbackUserData(clerkFallback, clerkUserImageUrl);
          setUserData(fd);
          setFollowStats(null);
          setVideos([]);
          setAnalytics(null);
          setCooldowns(null);
          hasLoadedRef.current = true;
          setError(null);
          await saveToCache({
            userData: fd,
            followStats: null,
            videos: [],
            analytics: null,
            cooldowns: null,
          });
        } else {
          setError(err.message || 'Failed to load profile data');
        }
      } catch (cacheErr) {
        if (clerkFallback?.clerkUserId) {
          const fd = buildClerkFallbackUserData(clerkFallback, clerkUserImageUrl);
          setUserData(fd);
          setFollowStats(null);
          setVideos([]);
          setAnalytics(null);
          setCooldowns(null);
          hasLoadedRef.current = true;
          setError(null);
          await saveToCache({
            userData: fd,
            followStats: null,
            videos: [],
            analytics: null,
            cooldowns: null,
          });
        } else {
          setError(err.message || 'Failed to load profile data');
        }
      }
      
      setIsLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, [getToken, clerkUserImageUrl, clerkFallback, transformUserProfile, transformReels, saveToCache]); // Removed onFreshDataLoaded - uses ref

  /**
   * Main refresh function - implements cache-first pattern
   */
  const refresh = useCallback(async (forceRefresh = false): Promise<void> => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else if (!hasLoadedRef.current) {
      // ✅ FIX #6: Only show skeleton if we have NO cached data yet.
      // If hasLoadedRef is true, the user already sees data — don't flash a skeleton.
      setIsLoading(true);
    }

    try {
      // Step 1: Try to load from cache first (Requirement 2.1)
      // Skip if we already have data from synchronous memory cache init
      if (!forceRefresh && !hasLoadedRef.current) {
        const hasCachedData = await loadFromCache();
        
        if (hasCachedData) {
          // Show cached data immediately, then fetch fresh in background
          setIsLoading(false);
          hasLoadedRef.current = true; // Mark as loaded so we don't show loading again
        }
      }

      // Step 2: Fetch fresh data in background (Requirement 2.2)
      await fetchFreshData(forceRefresh);
    } catch (err: any) {
      console.error('[useProfileCache] ❌ Refresh error:', err);
      
      // ✅ CRITICAL FIX: If fetch fails, try to show cached data
      if (!userData) {
        try {
          const cachedData = await cacheService.get<ProfileCacheData>(cacheKey, true); // allowStale
          if (cachedData && cachedData.userData) {
            logger.info('[useProfileCache] ✅ Showing cached data after fetch error');
            setUserData(cachedData.userData);
            setFollowStats(cachedData.followStats);
            setVideos(cachedData.videos || []);
            setAnalytics(cachedData.analytics);
            setCooldowns(cachedData.cooldowns);
            hasLoadedRef.current = true;
            setError('لا يمكن الاتصال بالخادم. يتم عرض البيانات المحفوظة.');
          } else if (clerkFallback?.clerkUserId) {
            const fd = buildClerkFallbackUserData(clerkFallback, clerkUserImageUrl);
            setUserData(fd);
            setFollowStats(null);
            setVideos([]);
            setAnalytics(null);
            setCooldowns(null);
            hasLoadedRef.current = true;
            setError(null);
            await saveToCache({
              userData: fd,
              followStats: null,
              videos: [],
              analytics: null,
              cooldowns: null,
            });
          } else {
            setError(err.message || 'Failed to refresh profile');
          }
        } catch (cacheErr) {
          logger.error('[useProfileCache] Failed to load cached data:', cacheErr);
          if (clerkFallback?.clerkUserId) {
            const fd = buildClerkFallbackUserData(clerkFallback, clerkUserImageUrl);
            setUserData(fd);
            setFollowStats(null);
            setVideos([]);
            setAnalytics(null);
            setCooldowns(null);
            hasLoadedRef.current = true;
            setError(null);
            await saveToCache({
              userData: fd,
              followStats: null,
              videos: [],
              analytics: null,
              cooldowns: null,
            });
          } else {
            setError(err.message || 'Failed to refresh profile');
          }
        }
      } else {
        setError(err.message || 'Failed to refresh profile');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadFromCache, fetchFreshData, userData, cacheKey, clerkFallback, clerkUserImageUrl, saveToCache]);

  /**
   * Retry with exponential backoff
   */
  const retryWithBackoff = useCallback(async (attempt = 1, maxAttempts = 3): Promise<void> => {
    logger.debug(`[useProfileCache] Retry attempt ${attempt}/${maxAttempts}`);
    
    try {
      await refresh(true);
    } catch (err) {
      if (attempt < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 seconds
        logger.debug(`[useProfileCache] Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
        await retryWithBackoff(attempt + 1, maxAttempts);
      } else {
        console.error('[useProfileCache] ❌ All retry attempts failed');
        throw err;
      }
    }
  }, [refresh]);

  /**
   * Load videos for a specific username
   */
  const loadVideos = useCallback(async (username: string, bustCache: boolean = false): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) return;

      const reels = await AuthService.getUserReels(token, username, 20, 0, bustCache);
      const transformedVideos = transformReels(reels);
      setVideos(transformedVideos);

      // Update cache with new videos
      const currentCache = await cacheService.get<ProfileCacheData>(cacheKey);
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
  const updateUserData = useCallback((updates: Partial<ProfileUserData>): void => {
    // Update state immediately (synchronous)
    setUserData(prev => prev ? { ...prev, ...updates } : null);
    
    // Update cache in background (asynchronous)
    (async () => {
      try {
        const currentCache = await cacheService.get<ProfileCacheData>(cacheKey);
        if (currentCache && currentCache.userData) {
          await saveToCache({
            ...currentCache,
            userData: { ...currentCache.userData, ...updates },
          });
        }
      } catch (error) {
        console.warn('Failed to update cache:', error);
      }
    })();
  }, [saveToCache, cacheKey]);

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
    await cacheService.invalidate(cacheKey);
    hasLoadedRef.current = false;
    setIsCacheHit(false);
  }, [cacheKey]);

  // Initial load + when Clerk user id appears (session hydrated after first paint)
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is stable enough; re-run when clerk id changes
  }, [clerkUserId]);

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
