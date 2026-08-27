/**
 * useReelsCache Hook
 * Implements cache-first loading pattern for reels data with background refresh.
 * 
 * Requirements: 3.1, 3.5, 3.6
 * 
 * - 3.1: Display cached reels immediately if available
 * - 3.5: Fetch fresh data from backend in background
 * - 3.6: Merge new reels without disrupting current viewing
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../services/cacheService';
import { ReelData } from '../components/reels/types';
import { ReelsService, ReelFeedItem } from '../src/services/authService';

// Cache data structure for reels
export interface ReelsCacheData {
  reels: ReelData[];
  nextCursor: string | null;
  hasMore: boolean;
  cachedAt: number;
}

export interface UseReelsCacheOptions {
  getToken: () => Promise<string | null>;
  likedReelIds?: string[];
  onCacheHit?: () => void;
  onFreshDataLoaded?: () => void;
}

export interface UseReelsCacheResult {
  reels: ReelData[];
  isLoading: boolean;
  isRefreshing: boolean;
  isCacheHit: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  error: string | null;
  currentViewingIndex: number;
  setCurrentViewingIndex: (index: number) => void;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  preloadNext: (currentIndex: number) => void;
  updateReelLikeStatus: (reelId: string, liked: boolean) => void;
  invalidateCache: () => Promise<void>;
}

/**
 * Transform backend reel to ReelData format
 */
const transformBackendReel = (reel: ReelFeedItem, likedReelIds: string[] = []): ReelData => ({
  id: reel.id,
  user: {
    id: reel.user?.id || 'unknown',
    username: reel.user?.username || 'user',
    name: reel.user?.displayName || reel.user?.username || 'User',
    avatar: reel.user?.avatar || 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff',
    verified: reel.user?.isVerified,
    followers: 0,
    isFollowing: false
  },
  videoUrl: reel.videoUrl,
  // Empty string instead of video URL — prevents <Image> from trying to
  // render a video file as a thumbnail.
  thumbnail: reel.thumbnail || '',
  duration: 0,
  likes: reel.likesCount,
  views: reel.views,
  comments: reel.commentsCount,
  shares: 0,
  liked: reel.isLiked || likedReelIds.includes(reel.id),
  saved: false,
  muted: true,
  description: reel.caption || '',
  hashtags: reel.hashtags || [],
  createdAt: new Date(reel.createdAt)
});

/**
 * Hook for managing reels data with cache-first loading pattern.
 * 
 * Property 4: Cache-First Reels Loading
 * - For any cached reels data, when navigating to the reels screen,
 *   the cached reels should be displayed before any network request completes.
 * 
 * Property 5: Reels Data Caching
 * - For any successfully loaded reels data, the data should be stored
 *   in cache with a valid timestamp for future retrieval.
 * 
 * Property 6: Non-Disruptive Reels Update
 * - For any current viewing index, when new reels data arrives,
 *   the current viewing position should be preserved.
 */
export function useReelsCache(options: UseReelsCacheOptions): UseReelsCacheResult {
  const { getToken, likedReelIds = [], onCacheHit, onFreshDataLoaded } = options;
  
  // State
  const [reels, setReels] = useState<ReelData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCacheHit, setIsCacheHit] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentViewingIndex, setCurrentViewingIndex] = useState(0);
  
  // Refs to track loading state
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const preloadedVideosRef = useRef<Set<string>>(new Set());

  /**
   * Load cached data immediately (Requirement 3.1)
   */
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    try {
      const cachedData = await cacheService.get<ReelsCacheData>(CACHE_KEYS.REELS_FEED);
      
      if (cachedData && cachedData.reels && cachedData.reels.length > 0) {
        // Restore dates from cached data
        const restoredReels = cachedData.reels.map(reel => ({
          ...reel,
          createdAt: new Date(reel.createdAt),
          // Update liked status from current likedReelIds
          liked: likedReelIds.includes(reel.id) || reel.liked
        }));
        
        setReels(restoredReels);
        setNextCursor(cachedData.nextCursor);
        setHasMore(cachedData.hasMore);
        setIsCacheHit(true);
        onCacheHit?.();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useReelsCache] Error loading from cache:', err);
      return false;
    }
  }, [likedReelIds, onCacheHit]);

  /**
   * Save data to cache (Requirement 3.4)
   */
  const saveToCache = useCallback(async (data: ReelsCacheData): Promise<void> => {
    try {
      await cacheService.set(CACHE_KEYS.REELS_FEED, data, CACHE_TTL.REELS);
    } catch (err) {
      console.error('[useReelsCache] Error saving to cache:', err);
    }
  }, []);

  /**
   * Fetch fresh data from backend (Requirement 3.5)
   * Merges new reels without disrupting current viewing (Requirement 3.6)
   */
  const fetchFreshData = useCallback(async (cursor?: string, forceRefresh = false): Promise<void> => {
    if (isLoadingRef.current && !forceRefresh) return;
    
    isLoadingRef.current = true;
    setError(null);
    
    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const result = await ReelsService.getFeed(token, cursor);
      
      if (result) {
        const transformedReels = result.reels.map(reel => transformBackendReel(reel, likedReelIds));
        
        if (cursor) {
          // Appending more reels - deduplicate
          setReels(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const newReels = transformedReels.filter(r => !existingIds.has(r.id));
            return [...prev, ...newReels];
          });
        } else {
          // Fresh load - preserve viewing position (Requirement 3.6)
          setReels(prev => {
            if (prev.length === 0 || forceRefresh) {
              return transformedReels;
            }
            
            // Merge new reels without disrupting current viewing
            // Keep existing reels up to current viewing position, then merge
            const currentReelId = prev[currentViewingIndex]?.id;
            const existingIds = new Set(prev.map(r => r.id));
            const newReels = transformedReels.filter(r => !existingIds.has(r.id));
            
            // If current reel is still in the new data, preserve position
            const newCurrentIndex = transformedReels.findIndex(r => r.id === currentReelId);
            if (newCurrentIndex >= 0) {
              // Current reel exists in new data, use new data
              return transformedReels;
            }
            
            // Current reel not in new data, prepend new reels
            return [...newReels, ...prev];
          });
        }
        
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        
        // Save to cache (Requirement 3.4)
        const cacheData: ReelsCacheData = {
          reels: cursor ? [...reels, ...transformedReels] : transformedReels,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          cachedAt: Date.now(),
        };
        await saveToCache(cacheData);
        
        hasLoadedRef.current = true;
        onFreshDataLoaded?.();
      }
    } catch (err: any) {
      console.error('[useReelsCache] Error fetching fresh data:', err);
      setError(err.message || 'Failed to load reels');
    } finally {
      isLoadingRef.current = false;
    }
  }, [getToken, likedReelIds, currentViewingIndex, reels, saveToCache, onFreshDataLoaded]);

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
      // Step 1: Try to load from cache first (Requirement 3.1)
      if (!forceRefresh && !hasLoadedRef.current) {
        const hasCachedData = await loadFromCache();
        
        if (hasCachedData) {
          // Show cached data immediately, then fetch fresh in background
          setIsLoading(false);
        }
      }

      // Step 2: Fetch fresh data in background (Requirement 3.5)
      await fetchFreshData(undefined, forceRefresh);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadFromCache, fetchFreshData]);

  /**
   * Load more reels (pagination)
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || isLoadingMoreRef.current || !nextCursor) return;
    
    isLoadingMoreRef.current = true;
    
    try {
      await fetchFreshData(nextCursor);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [hasMore, nextCursor, fetchFreshData]);

  /**
   * Preload next videos for smooth scrolling (Requirement 3.7)
   */
  const preloadNext = useCallback((currentIndex: number): void => {
    // Preload next 2 videos
    const indicesToPreload = [currentIndex + 1, currentIndex + 2];
    
    indicesToPreload.forEach(index => {
      if (index < reels.length) {
        const reel = reels[index];
        if (reel && !preloadedVideosRef.current.has(reel.id)) {
          preloadedVideosRef.current.add(reel.id);
          // Import and use the video preloader utility
          import('../utils/videoPreloader').then(({ preloadVideo }) => {
            preloadVideo(reel.videoUrl);
          }).catch(err => {
            console.warn('[useReelsCache] Failed to preload video:', err);
          });
        }
      }
    });
    
    // Load more if approaching end
    if (currentIndex >= reels.length - 3 && hasMore && nextCursor) {
      loadMore();
    }
  }, [reels, hasMore, nextCursor, loadMore]);

  /**
   * Update reel like status locally (for optimistic updates)
   */
  const updateReelLikeStatus = useCallback((reelId: string, liked: boolean): void => {
    setReels(prev => prev.map(reel =>
      reel.id === reelId
        ? { ...reel, liked, likes: liked ? reel.likes + 1 : reel.likes - 1 }
        : reel
    ));
  }, []);

  /**
   * Invalidate cache
   */
  const invalidateCache = useCallback(async (): Promise<void> => {
    await cacheService.invalidate(CACHE_KEYS.REELS_FEED);
    hasLoadedRef.current = false;
    setIsCacheHit(false);
    preloadedVideosRef.current.clear();
  }, []);

  // Update liked status when likedReelIds changes
  useEffect(() => {
    setReels(prev => prev.map(reel => ({
      ...reel,
      liked: likedReelIds.includes(reel.id)
    })));
  }, [likedReelIds]);

  // Initial load on mount
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    reels,
    isLoading,
    isRefreshing,
    isCacheHit,
    hasMore,
    nextCursor,
    error,
    currentViewingIndex,
    setCurrentViewingIndex,
    refresh,
    loadMore,
    preloadNext,
    updateReelLikeStatus,
    invalidateCache,
  };
}

export default useReelsCache;
