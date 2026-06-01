import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  Easing,
  FlatList,
  ActivityIndicator,
  Alert,
  ViewToken,
  Platform,
  Vibration,
  StatusBar,
} from 'react-native';
import * as Network from 'expo-network';
import {
  Heart,
  Eye,
  X,
  ChevronUp,
} from 'lucide-react-native';

// للـ Gradient
import { LinearGradient } from 'expo-linear-gradient';

// للـ Haptic Feedback
import * as Haptics from 'expo-haptics';

// Import new components and constants
import { ReelItem } from '../../components/reels/ReelItem';
import { COLORS } from '../../components/reels/constants';
import { useTranslation } from '../../src/i18n';
import { ReelData } from '../../components/reels/types';
import { useVideos } from '../../contexts/VideosContext';
import CommentsModal from '../../components/common/CommentsModal';
import { useAuth } from '@clerk/clerk-expo';
import { ReelsService, ReelFeedItem, FollowService } from '../../src/services/authService';
import { useFollowStore } from '../../src/store/useFollowStore';
import { useReelUploadEventsStore } from '../../src/store/useReelUploadEventsStore';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// videoPreloader is now handled by preloadManager
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../services/cacheService';
import { preloadManager } from '../../services/preloadManager';
import { ReelsCacheData } from '../../hooks/useReelsCache';
import { useReelsAudioManager, markVideoAsLoaded, markVideoAsUnloaded, clearLoadedVideos } from '../../hooks/useReelsAudioManager';
// useVideoReplayLimit is handled in UnifiedVideoPlayer component
import { globalState } from '../../globalState';
import { logger } from '../../utils/logger';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { ErrorDisplay } from '../../components/common/ErrorDisplay';
import { toastManager } from '../../services/toastManager';
import { ReportSystem } from '../../components/common/ReportSystem';
import { useReelReport } from '../../hooks/useReportSystem';
import { useReelEvents } from '../../hooks/useWebSocket';
import { ReelsFeedErrorBoundary } from '../../components/common/ReelsFeedErrorBoundary';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** iOS AVPlayer crashes with multiple simultaneous HLS instances — one player max. */
const REEL_PLAYER_MOUNT_DISTANCE = Platform.OS === 'ios' ? 0 : 1;
const REEL_LIST_WINDOW_SIZE = Platform.OS === 'ios' ? 3 : 5;
const REEL_INITIAL_RENDER = Platform.OS === 'ios' ? 1 : 2;
const REEL_MAX_BATCH = Platform.OS === 'ios' ? 1 : 3;

const ANIMATIONS = {
  spring: {
    friction: 4,
    tension: 40,
    useNativeDriver: true
  },
  timing: {
    duration: 200,
    useNativeDriver: true,
    easing: Easing.bezier(0.4, 0, 0.2, 1)
  }
};

// ====== TYPES ======
interface User {
  id: string;
  name: string;
  avatar?: string;
  verified?: boolean;
  followers?: number;
  isFollowing?: boolean;
}

interface Comment {
  id: string;
  user: User;
  text: string;
  timestamp: string;
  likes: number;
  liked: boolean;
  replies?: Comment[];
}

// ====== HOOKS ======
// Custom Hook for Haptic Feedback
const useHaptic = () => {
  const trigger = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (Platform.OS === 'ios') {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } else {
      Vibration.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
    }
  }, []);

  return { trigger };
};

// Track loaded videos - now managed by useReelsAudioManager
// The loadedVideosRef is kept for backward compatibility with VideoPlayer component
const loadedVideosRef = { current: new Set<string>() };

// ====== COMPONENTS ======

// Enhanced Action Button with better animations
const ActionButton: React.FC<{
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  color?: string;
  size?: number;
}> = ({ icon, count, active, onPress, accessibilityLabel, accessibilityHint, color = 'white', size = 28 }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHaptic();

  const handlePress = () => {
    haptic.trigger('light');

    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        })
      ]),
      active ? Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.elastic(1)
      }) : Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();

    onPress();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.actionButton}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: active }}
      activeOpacity={0.8}
    >
      <Animated.View style={[
        styles.actionIconContainer,
        active && styles.actionIconActive,
        {
          transform: [
            { scale: scaleAnim },
            { rotate: active ? spin : '0deg' }
          ]
        }
      ]}>
        {icon}
      </Animated.View>
      {count !== undefined && (
        <Text style={styles.actionCount}>
          {formatCount(count)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Enhanced Double Tap Animation with Confetti
const DoubleTapLikeAnimation: React.FC<{
  visible: boolean;
  position?: { x: number; y: number };
}> = ({ visible, position = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 } }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHaptic();

  useEffect(() => {
    if (visible) {
      haptic.trigger('medium');

      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            friction: 2,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease)
          })
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 400,
            delay: 200,
            useNativeDriver: true,
          })
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.elastic(1)
        })
      ]).start();
    }
  }, [visible, haptic]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.doubleTapHeart,
        {
          left: position.x - 50,
          top: position.y - 50,
          transform: [
            { scale: scaleAnim },
            { rotate: spin }
          ],
          opacity: opacityAnim
        }
      ]}
    >
      <Heart size={100} color={COLORS.primary} fill={COLORS.primary} />
    </Animated.View>
  );
};



// Main Reels Feed Component
const ReelsFeed: React.FC = () => {
  const params = useLocalSearchParams<{ reelId?: string; commentId?: string; autoOpenComments?: string; startFrom?: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState<string>('');
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Network & Error States (Requirements: Critical Priority #1, #2, #3)
  const [networkError, setNetworkError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Hashtag filtering
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);

  // Backend integration state - now managed by useReelsCache
  const [backendReels, setBackendReels] = useState<ReelData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [noReelsMessage, setNoReelsMessage] = useState(false);
  const hasLoadedRef = useRef(false);
  // Abort controller to cancel in-flight retries when component re-focuses
  const retryAbortRef = useRef<AbortController | null>(null);
  const viewedReelsRef = useRef<Set<string>>(new Set());
  const deepLinkFetchRef = useRef<string | null>(null);
  const deepLinkScrollDoneRef = useRef<string | null>(null);
  const deepLinkScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startFromDoneRef = useRef<string | null>(null);
  const startFromTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-flight dedupe: prevents a flicker between two adjacent reels from
  // firing two concurrent /view calls for the same reel.
  const pendingViewsRef = useRef<Set<string>>(new Set());
  const VIEWED_REELS_STORAGE_KEY = '@viewed_reels';
  const MAX_VIEWED_REELS_STORED = 500; // Cap to prevent unbounded AsyncStorage growth

  const videoRefs = useRef<Map<string, any>>(new Map());
  const flatListRef = useRef<FlatList>(null);
  const haptic = useHaptic();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { uploadedVideos, userVideoData, reelComments, addComment, toggleCommentLike, likedReelIds, toggleReelLike } = useVideos();

  const ownReelIds = useMemo(
    () => new Set(uploadedVideos.map((v) => v.id)),
    [uploadedVideos],
  );

  // Unified report system for reels
  const {
    isVisible: isReportVisible,
    reportConfig,
    reportReel,
    closeReport,
    handleSuccess,
    getToken: reportGetToken,
  } = useReelReport({
    onSuccess: () => {
      toastManager.showReportSuccess();
    }
  });

  // ✅ Ref to track previous comments for each reel to prevent unnecessary re-renders
  const commentsRef = useRef<Record<string, Comment[]>>({});

  // ✅ FIX: Memoize callbacks to prevent infinite focus/unfocus loop
  const handlePauseAll = useCallback(() => {
    logger.debug('[ReelsFeed] All videos paused');
  }, []);

  const handleResumeActive = useCallback((index: number) => {
    logger.debug(`[ReelsFeed] Resumed video at index ${index}`);
  }, []);

  // Use Reels Audio Manager for navigation and app state audio cleanup
  // Requirements 16.1, 16.2, 16.3: Stop audio on navigation, pause on background, resume on return
  const { pauseAllVideos, markVideoLoaded, markVideoUnloaded } = useReelsAudioManager({
    videoRefs,
    currentIndex,
    onPauseAll: handlePauseAll,
    onResumeActive: handleResumeActive,
  });

  // Import useReelsCache for cache-first loading (Requirements 3.1, 3.5, 3.6)
  // Note: The hook is available but we're keeping the existing implementation
  // to maintain backward compatibility. The hook can be fully integrated in a future refactor.

  // Transform backend reels to ReelData format with strong validation
  // Requirement: Critical Priority #4 - Fix handling of reels without videoUrl
  // ✅ FIX 6: Convert likedReelIds array to Set for O(1) lookup (declared here so transformBackendReel can use it)
  const likedReelIdsSet = useMemo(() => new Set(likedReelIds), [likedReelIds]);

  const transformBackendReel = useCallback((reel: ReelFeedItem): ReelData | null => {
    const followState = useFollowStore.getState();

    // Strong validation: Reject reels without valid videoUrl
    if (!reel.videoUrl || reel.videoUrl.trim() === '') {
      logger.warn('[ReelsFeed] Skipping reel with missing videoUrl', {
        reelId: reel.id,
        userId: reel.user?.id,
        caption: reel.caption?.substring(0, 50)
      });
      return null; // Return null for invalid reels
    }

    // Validate video URL format (basic check)
    try {
      new URL(reel.videoUrl);
    } catch (e) {
      logger.warn('[ReelsFeed] Skipping reel with invalid videoUrl format', {
        reelId: reel.id,
        videoUrl: reel.videoUrl.substring(0, 50)
      });
      return null;
    }

    return {
      id: reel.id || '',
      user: {
        id: reel.user?.id || '',
        username: reel.user?.username || 'user',
        name: reel.user?.displayName || reel.user?.username || 'User',
        avatar: reel.user?.avatar || 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff',
        verified: reel.user?.isVerified || false,
        followers: 0,
        isFollowing: reel.user?.id ? followState.isFollowing(reel.user.id) : false
      },
      videoUrl: reel.videoUrl, // Now guaranteed to be valid
      thumbnail: reel.thumbnail || '',
      duration: 0,
      likes: typeof reel.likesCount === 'number' ? reel.likesCount : 0,
      views: typeof reel.views === 'number' ? reel.views : 0,
      comments: typeof reel.commentsCount === 'number' ? reel.commentsCount : 0,
      shares: typeof reel.sharesCount === 'number' ? reel.sharesCount : 0,
      liked: reel.isLiked || (reel.id ? likedReelIdsSet.has(reel.id) : false),
      saved: reel.isSaved || false,
      muted: false, // Audio ON by default (Instagram/TikTok style)
      description: reel.caption || '',
      hashtags: reel.hashtags || [],
      mentions: reel.mentions || [],
      createdAt: reel.createdAt ? new Date(reel.createdAt) : new Date()
    };
  }, [likedReelIdsSet]);

  // Load reels from backend with cache-first pattern and retry mechanism
  // Requirements: 3.1, 3.4, 3.5 (cache), Critical Priority #1 (retry), #2 (network check)
  const loadReelsFromBackend = useCallback(async (
    cursor?: string,
    skipCache = false,
    attemptNumber = 0
  ) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [500, 1000, 2000]; // Reduced delays for faster retry

    try {
      // Use Promise.all for parallel loading of network state and cache
      const [networkState, cachedData] = await Promise.all([
        Network.getNetworkStateAsync(),
        !cursor && !skipCache && !selectedHashtag
          ? cacheService.get<ReelsCacheData>(CACHE_KEYS.REELS_FEED)
          : Promise.resolve(null)
      ]);

      // Check network connectivity (Critical Priority #2)
      // isInternetReachable is null on iOS while connected — treat as online
      if (!networkState.isConnected || networkState.isInternetReachable === false) {
        setIsOffline(true);
        setNetworkError(true);
        setLoadError(t.reels.offline);

        // Display cached data immediately if available (offline mode)
        if (cachedData?.reels && cachedData.reels.length > 0) {
          logger.debug('[ReelsFeed] Using cached reels (offline)');
          const restoredReels = cachedData.reels.map(reel => ({
            ...reel,
            createdAt: new Date(reel.createdAt),
            liked: likedReelIdsSet.has(reel.id) || reel.liked
          }));
          setBackendReels(restoredReels);
          setNextCursor(cachedData.nextCursor);
          setHasMore(false);
          setNoReelsMessage(restoredReels.length === 0);
          setIsInitialLoading(false);
        }
        return;
      }

      // Clear offline/error states if connection is good
      setIsOffline(false);
      setNetworkError(false);
      setLoadError(null);

      const token = await getToken();
      if (!token) {
        setLoadError(t.reels.authFailed);
        return;
      }

      // Display cached data immediately before fetching fresh data
      if (cachedData?.reels && cachedData.reels.length > 0 && !cursor) {
        logger.debug('[ReelsFeed] Displaying cached reels immediately');
        const restoredReels = cachedData.reels.map(reel => ({
          ...reel,
          createdAt: new Date(reel.createdAt),
          liked: likedReelIdsSet.has(reel.id) || reel.liked
        }));
        setBackendReels(restoredReels);
        setNextCursor(cachedData.nextCursor);
        setHasMore(cachedData.hasMore);
        setIsInitialLoading(false);
      }

      logger.debug('[ReelsFeed] Fetching fresh reels', { cursor, skipCache, attemptNumber });

      // Fetch fresh data
      let result;
      if (selectedHashtag) {
        result = await ReelsService.getByHashtag(token, selectedHashtag, cursor);
      } else {
        result = await ReelsService.getFeed(token, cursor);
      }

      if (result) {
        // Transform reels in parallel
        const transformPromises = result.reels.map(reel =>
          Promise.resolve(transformBackendReel(reel))
        );
        const transformed = (await Promise.all(transformPromises))
          .filter((reel): reel is ReelData => reel !== null);

        // Log filtered reels
        const filteredCount = result.reels.length - transformed.length;
        if (filteredCount > 0) {
          logger.warn('[ReelsFeed] Filtered invalid reels', {
            total: result.reels.length,
            filtered: filteredCount,
            valid: transformed.length
          });
        }

        // Update reels state
        if (cursor) {
          setBackendReels(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const newReels = transformed.filter(r => !existingIds.has(r.id));
            return [...prev, ...newReels];
          });
        } else {
          setBackendReels(transformed);
        }

        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setNoReelsMessage(transformed.length === 0 && !cursor);

        // Save to cache asynchronously without waiting
        if (!cursor && !selectedHashtag) {
          const cacheData: ReelsCacheData = {
            reels: transformed,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            cachedAt: Date.now(),
          };
          cacheService.set(CACHE_KEYS.REELS_FEED, cacheData, CACHE_TTL.REELS)
            .catch(err => logger.warn('[ReelsFeed] Cache save failed:', err));
        }

        // Auto-preload first 3 videos after initial load
        if (!cursor && transformed.length > 0) {
          preloadManager.preloadNextReelVideos(transformed, 0);
        }
      }
    } catch (error) {
      logger.error('[ReelsFeed] Error loading reels:', error);

      // Retry mechanism with faster delays (Critical Priority #1)
      if (attemptNumber < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attemptNumber];
        logger.debug(`[ReelsFeed] Retrying in ${delay}ms (${attemptNumber + 1}/${MAX_RETRIES})`);

        // Cancel any previous retry chain before starting a new one
        if (retryAbortRef.current) retryAbortRef.current.abort();
        const controller = new AbortController();
        retryAbortRef.current = controller;

        setTimeout(() => {
          // Don't retry if this chain was cancelled
          if (controller.signal.aborted) return;
          loadReelsFromBackend(cursor, skipCache, attemptNumber + 1);
        }, delay);

        setLoadError(
          t.reels.retryingAttempt
            .replace('{current}', String(attemptNumber + 1))
            .replace('{max}', String(MAX_RETRIES))
        );
      } else {
        // Max retries reached
        setLoadError(t.reels.feedLoadFailed);
        setNetworkError(true);
        setRetryCount(attemptNumber);
      }
    }
  }, [getToken, selectedHashtag, transformBackendReel, likedReelIdsSet]);

  // Initial load
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadReelsFromBackend().finally(() => setIsInitialLoading(false));
    }
  }, []);

  // ✅ FIX: Throttle focus refresh to prevent infinite loop
  const lastFocusRefreshRef = useRef<number>(0);
  const FOCUS_REFRESH_THROTTLE = 10000; // 10 seconds instead of 30
  const isRefreshingRef = useRef(false);

  // Reload when screen comes into focus (e.g., after uploading a reel)
  useFocusEffect(
    useCallback(() => {
      // ✅ Skip if already refreshing
      if (isRefreshingRef.current) {
        return;
      }

      // ✅ Throttle: Don't refresh if we just did recently
      const now = Date.now();
      if (now - lastFocusRefreshRef.current < FOCUS_REFRESH_THROTTLE) {
        return;
      }

      // Only reload if we've already loaded once (to avoid double loading on initial mount)
      if (hasLoadedRef.current && backendReels.length > 0) {
        // ✅ Don't clear existing reels - just refresh in background
        lastFocusRefreshRef.current = now;
        isRefreshingRef.current = true;

        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          logger.debug('[ReelsFeed] Screen focused, refreshing reels in background...');
          // ✅ Don't clear backendReels - keep existing content visible
          loadReelsFromBackend(undefined, true).finally(() => {
            isRefreshingRef.current = false;
          });
        }, 500);

        return () => {
          clearTimeout(timer);
          isRefreshingRef.current = false;
        };
      }
    }, []) // ✅ Empty deps - use refs to avoid re-creating callback
  );

  // ✅ Listen for cross-screen reel-ready events: when the profile screen
  // detects a freshly uploaded reel finished Mux processing, it bumps the
  // store's `readyTick`. We invalidate the feed cache and refetch so the new
  // reel appears immediately without waiting for tab focus / pull-to-refresh.
  const readyTick = useReelUploadEventsStore(s => s.readyTick);
  useEffect(() => {
    if (readyTick === 0) return; // initial value, not a real event
    (async () => {
      try {
        await cacheService.invalidate(CACHE_KEYS.REELS_FEED).catch(() => {});
        await loadReelsFromBackend(undefined, true);
      } catch (err) {
        logger.warn('[ReelsFeed] Failed to refresh after reel ready event:', err);
      }
    })();
    // loadReelsFromBackend captures stable refs; watching only the tick is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyTick]);

  // Reload when hashtag changes
  useEffect(() => {
    if (hasLoadedRef.current) {
      setIsInitialLoading(true);
      setBackendReels([]);
      setNextCursor(null);
      setHasMore(true);
      loadReelsFromBackend().finally(() => setIsInitialLoading(false));
    }
  }, [selectedHashtag]);

  // Reels state - ONLY backend reels (no local videos in global feed)
  const [reels, setReels] = useState<ReelData[]>([]);

  // ✅ FIX 6: Derive merged reels with useMemo instead of useEffect + manual ref guards
  // This avoids the O(n) includes() on every render and eliminates the string-join comparison overhead
  const mergedBackendReels = useMemo(() => {
    if (!backendReels || backendReels.length === 0) return backendReels;
    return backendReels.map(reel => ({
      ...reel,
      liked: likedReelIdsSet.has(reel.id),
    }));
  }, [backendReels, likedReelIdsSet]);

  // Sync merged reels into state (needed so optimistic updates like mute/save/share still work)
  useEffect(() => {
    if (!mergedBackendReels || mergedBackendReels.length === 0) {
      if (backendReels.length === 0 && !isInitialLoading) {
        setReels([]);
      }
      return;
    }
    setReels(mergedBackendReels);
  }, [mergedBackendReels, backendReels.length, isInitialLoading]);

  // Handle deep link navigation to specific reel and comment
  useEffect(() => {
    if (!params.reelId) return;

    const reelIndex = reels.findIndex(r => r.id === params.reelId);
    if (reelIndex >= 0) {
      if (deepLinkScrollDoneRef.current === params.reelId) return;
      deepLinkScrollDoneRef.current = params.reelId;

      if (deepLinkScrollTimerRef.current) clearTimeout(deepLinkScrollTimerRef.current);
      deepLinkScrollTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: reelIndex, animated: true });
        setCurrentIndex(reelIndex);
        setSelectedReelId(params.reelId!);

        if (params.commentId && params.autoOpenComments === 'true') {
          setHighlightCommentId(params.commentId);
          setShowComments(true);
        }
      }, 500);

      return () => {
        if (deepLinkScrollTimerRef.current) {
          clearTimeout(deepLinkScrollTimerRef.current);
          deepLinkScrollTimerRef.current = null;
        }
      };
    }

    if (isInitialLoading) return;
    if (deepLinkFetchRef.current === params.reelId) return;
    deepLinkFetchRef.current = params.reelId;

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (cancelled) return;
        const item = await ReelsService.getReelById(token, params.reelId!);
        if (cancelled) return;
        if (!item) {
          toastManager.showError(t.reels.reelNotFound, t.reels.reelNotFoundDetail);
          return;
        }
        const transformed = transformBackendReel(item);
        if (!transformed) {
          toastManager.showError(t.reels.reelNotFound, t.reels.reelNotFoundDetail);
          return;
        }
        setBackendReels(prev => {
          if (prev.some(r => r.id === transformed.id)) return prev;
          return [transformed, ...prev];
        });
        setReels(prev => {
          if (prev.some(r => r.id === transformed.id)) return prev;
          return [transformed, ...prev];
        });
      } catch (err) {
        if (cancelled) return;
        logger.error('[ReelsFeed] Deep link fetch failed:', err);
        toastManager.showError(t.reels.reelNotFound, t.reels.reelNotFoundDetail);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    params.reelId,
    params.commentId,
    params.autoOpenComments,
    reels,
    isInitialLoading,
    getToken,
    transformBackendReel,
    t.reels.reelNotFound,
    t.reels.reelNotFoundDetail,
  ]);

  // Handle startFrom param: scroll to a specific reel when navigating from Home screen
  useEffect(() => {
    if (!params.startFrom || reels.length === 0) return;

    const reelIndex = reels.findIndex(r => r.id === params.startFrom);
    if (reelIndex < 0) return;
    if (startFromDoneRef.current === params.startFrom) return;
    startFromDoneRef.current = params.startFrom;

    if (startFromTimerRef.current) clearTimeout(startFromTimerRef.current);
    startFromTimerRef.current = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: reelIndex, animated: false });
      setCurrentIndex(reelIndex);
    }, 300);

    return () => {
      if (startFromTimerRef.current) {
        clearTimeout(startFromTimerRef.current);
        startFromTimerRef.current = null;
      }
    };
  }, [params.startFrom, reels]);

  // Load viewed reels from AsyncStorage on mount
  useEffect(() => {
    const loadViewedReels = async () => {
      try {
        const stored = await AsyncStorage.getItem(VIEWED_REELS_STORAGE_KEY);
        if (stored) {
          const viewedIds = JSON.parse(stored) as string[];
          viewedReelsRef.current = new Set(viewedIds);
        }
      } catch (error) {
        logger.error('Error loading viewed reels:', error);
      }
    };
    loadViewedReels();
  }, []);

  // Record view when reel becomes active.
  //
  // Contract:
  //  - Do nothing if the reel is already locally marked as viewed.
  //  - Dedupe concurrent in-flight calls with `pendingViewsRef`.
  //  - Only mark as viewed (in-memory + AsyncStorage) AFTER a successful
  //    server response — failures (network/5xx) are retried on the next
  //    playback because we never marked the reel locally.
  //  - When the server reports `counted: true`, bump the displayed view
  //    count optimistically so the UI reflects the increment without a
  //    full feed refetch. For `owner` / `duplicate` / `not_found` we do
  //    not bump the UI; we still mark as viewed locally so we don't keep
  //    re-pinging the API for non-counting reels.
  const recordReelView = useCallback(async (reelId: string) => {
    if (viewedReelsRef.current.has(reelId)) return;
    if (pendingViewsRef.current.has(reelId)) return;
    pendingViewsRef.current.add(reelId);

    try {
      const token = await getToken();
      if (!token) {
        logger.warn('[ReelView] No auth token — will retry on next playback');
        return;
      }

      const result = await ReelsService.recordView(token, reelId);

      // ok=false means network/5xx — leave reelId unmarked so the next
      // playback retries automatically.
      if (!result.ok) {
        logger.warn('[ReelView] Record failed; will retry on next playback', { reelId });
        return;
      }

      // Mark as viewed locally (success or accepted skip) so we don't
      // keep hitting the API for the same reel.
      viewedReelsRef.current.add(reelId);

      // Cap the set to prevent unbounded growth.
      if (viewedReelsRef.current.size > MAX_VIEWED_REELS_STORED) {
        const entries = Array.from(viewedReelsRef.current);
        const toRemove = Math.ceil(MAX_VIEWED_REELS_STORED * 0.2);
        for (let i = 0; i < toRemove; i++) {
          viewedReelsRef.current.delete(entries[i]);
        }
      }

      // Persist the (possibly trimmed) viewed set.
      try {
        const viewedArray = Array.from(viewedReelsRef.current);
        await AsyncStorage.setItem(VIEWED_REELS_STORAGE_KEY, JSON.stringify(viewedArray));
      } catch (storageErr) {
        logger.error('Error saving viewed reels:', storageErr);
      }

      // Optimistic UI bump — only when the server actually counted.
      if (result.counted) {
        setReels((prev) =>
          prev.map((r) =>
            r.id === reelId
              ? {
                  ...r,
                  views:
                    typeof result.views === 'number'
                      ? result.views
                      : (r.views ?? 0) + 1,
                }
              : r,
          ),
        );
      }
    } catch (error) {
      logger.warn('[ReelView] Unexpected error; will retry on next playback', {
        reelId,
        error,
      });
    } finally {
      pendingViewsRef.current.delete(reelId);
    }
  }, [getToken]);

  // Load more reels when reaching end
  const loadMoreReels = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;

    setIsLoadingMore(true);
    await loadReelsFromBackend(nextCursor);
    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, nextCursor, loadReelsFromBackend]);

  // When hashtag filter is active the API already returns matching reels
  const filteredReels = reels;

  const activeReelId = filteredReels[currentIndex]?.id;

  const handleWsLike = useCallback((payload: { reelId: string; likesCount: number }) => {
    setReels((prev) =>
      prev.map((r) =>
        r.id === payload.reelId ? { ...r, likes: payload.likesCount } : r,
      ),
    );
    setBackendReels((prev) =>
      prev.map((r) =>
        r.id === payload.reelId ? { ...r, likes: payload.likesCount } : r,
      ),
    );
  }, []);

  const handleWsComment = useCallback((payload: { reelId: string }) => {
    setReels((prev) =>
      prev.map((r) =>
        r.id === payload.reelId ? { ...r, comments: (r.comments ?? 0) + 1 } : r,
      ),
    );
    setBackendReels((prev) =>
      prev.map((r) =>
        r.id === payload.reelId ? { ...r, comments: (r.comments ?? 0) + 1 } : r,
      ),
    );
  }, []);

  useReelEvents(activeReelId, { onLike: handleWsLike, onComment: handleWsComment });

  // Video Ref Management — prune stale entries to prevent memory leak
  const handleVideoRef = useCallback((ref: any, id: string) => {
    if (ref) {
      videoRefs.current.set(id, ref);
    } else {
      videoRefs.current.delete(id);
    }
    // Prune: keep only refs for reels currently in the window (max 10)
    // This prevents unbounded growth during long scroll sessions
    if (videoRefs.current.size > 10) {
      const keys = Array.from(videoRefs.current.keys());
      const toRemove = keys.slice(0, keys.length - 10);
      for (const key of toRemove) {
        videoRefs.current.delete(key);
      }
    }
  }, []);

  const likeTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingLikeRef = useRef<Map<string, boolean>>(new Map());

  // Cleanup videos on unmount - now handled by useReelsAudioManager
  // The hook automatically pauses all videos and clears tracking on unmount
  // This effect is kept for backward compatibility with loadedVideosRef
  useEffect(() => {
    return () => {
      // Clear local loaded videos tracking (for backward compatibility)
      loadedVideosRef.current.clear();
      // Also clear the audio manager's tracking
      clearLoadedVideos();
      likeTimeoutRef.current.forEach(clearTimeout);
      likeTimeoutRef.current.clear();
    };
  }, []);

  // Optimistic like + debounced API sync (allows rapid taps; one request with final state)
  const handleLike = useCallback((reelId: string) => {
    haptic.trigger('medium');

    const currentReel = reels.find(r => r.id === reelId);
    if (!currentReel) return;

    const wasLiked = currentReel.liked ?? false;
    const prevLikes = currentReel.likes ?? 0;
    const nextLiked = !wasLiked;
    const nextLikes = nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1);

    pendingLikeRef.current.set(reelId, nextLiked);
    toggleReelLike(reelId);

    const applyLikeState = (liked: boolean, likes: number) => {
      setReels(prev => prev.map(reel =>
        reel.id === reelId ? { ...reel, liked, likes } : reel
      ));
      setBackendReels(prev => prev.map(reel =>
        reel.id === reelId ? { ...reel, liked, likes } : reel
      ));
    };
    applyLikeState(nextLiked, nextLikes);

    const existingTimeout = likeTimeoutRef.current.get(reelId);
    if (existingTimeout) clearTimeout(existingTimeout);

    likeTimeoutRef.current.set(reelId, setTimeout(async () => {
      likeTimeoutRef.current.delete(reelId);
      const targetLiked = pendingLikeRef.current.get(reelId);
      pendingLikeRef.current.delete(reelId);
      if (targetLiked === undefined) return;

      try {
        const token = await getToken();
        if (!token) throw new Error('No auth token');
        const result = targetLiked
          ? await ReelsService.likeReel(token, reelId)
          : await ReelsService.unlikeReel(token, reelId);
        if (!result.success) {
          throw new Error('Like sync failed');
        }
        if (result.likesCount !== undefined) {
          applyLikeState(targetLiked, result.likesCount);
        }
      } catch (error) {
        logger.error('Error syncing like, rolling back:', error);
        if (targetLiked !== wasLiked) {
          toggleReelLike(reelId);
        }
        applyLikeState(wasLiked, prevLikes);
      }
    }, 300));
  }, [toggleReelLike, haptic, getToken, reels]);


  // Handle Mute Toggle
  const handleToggleMute = useCallback((reelId: string) => {
    haptic.trigger('light');
    setReels(prev => prev.map(reel =>
      reel.id === reelId
        ? { ...reel, muted: !reel.muted }
        : reel
    ));
  }, [haptic]);

  // Handle Save - with Backend sync
  const handleSave = useCallback(async (reelId: string) => {
    haptic.trigger('light');

    // Get current state for rollback
    const currentReel = reels.find(r => r.id === reelId);
    const wasSaved = currentReel?.saved ?? false;

    // Optimistic UI update — use functional setState so the rollback path
    // never restores stale values when the user taps multiple times in quick
    // succession.
    const updateSaveState = (saved: boolean) => {
      setReels(prev => prev.map(reel =>
        reel.id === reelId ? { ...reel, saved } : reel
      ));
      setBackendReels(prev => prev.map(reel =>
        reel.id === reelId ? { ...reel, saved } : reel
      ));
    };

    updateSaveState(!wasSaved);

    // ✅ Use the non-blocking toast instead of Alert.alert which steals focus
    // and pauses video playback.
    if (wasSaved) {
      toastManager.showInfo(t.reels.unsaved, '');
    } else {
      toastManager.showSuccess(t.reels.saved, '');
    }

    // Sync with backend
    try {
      const token = await getToken();
      if (token) {
        if (wasSaved) {
          await ReelsService.unsaveReel(token, reelId);
        } else {
          await ReelsService.saveReel(token, reelId);
        }
      }
    } catch (error) {
      // Rollback on failure
      logger.error('Error syncing save, rolling back:', error);
      updateSaveState(wasSaved);
    }
  }, [haptic, reels, getToken, t.reels.unsaved, t.reels.saved]);

  // Handle Add Comment
  const handleAddComment = useCallback((reelId: string, comment: Comment) => {
    addComment(reelId, comment);

    // Update comment count in reel
    setReels(prevReels => prevReels.map(reel =>
      reel.id === reelId
        ? { ...reel, comments: reel.comments + 1 }
        : reel
    ));
  }, [addComment]);

  // Handle Toggle Comment Like
  const handleToggleCommentLike = useCallback((reelId: string, commentId: string) => {
    toggleCommentLike(reelId, commentId);
  }, [toggleCommentLike]);

  // Handle Hashtag Press
  const handleHashtagPress = useCallback((tag: string) => {
    haptic.trigger('light');
    setSelectedHashtag(tag);
    // Scroll to top
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [haptic]);

  // Clear Hashtag Filter
  const handleClearHashtag = useCallback(() => {
    haptic.trigger('light');
    setSelectedHashtag(null);
  }, [haptic]);

  // Record share count only (ReelItem already opened WhatsApp/FB/copy — no second sheet)
  const recordReelShare = useCallback(async (reelId: string, activityType = 'unknown') => {
    try {
      const token = await getToken();
      if (!token) return;
      const shareResult = await ReelsService.recordShare(token, reelId, activityType);
      if (shareResult.success && shareResult.sharesCount !== undefined) {
        setReels(prev => prev.map(r =>
          r.id === reelId ? { ...r, shares: shareResult.sharesCount! } : r
        ));
        setBackendReels(prev => prev.map(r =>
          r.id === reelId ? { ...r, shares: shareResult.sharesCount! } : r
        ));
      }
    } catch (error) {
      logger.error('Error recording share:', error);
    }
  }, [getToken]);

  // Open Comments
  const openComments = useCallback((reelId: string) => {
    haptic.trigger('light');
    setSelectedReelId(reelId);
    setShowComments(true);
  }, [haptic]);

  // Open Report
  const openReport = useCallback((reelId: string) => {
    haptic.trigger('light');
    setSelectedReelId(reelId); // keep for context in UI if needed
    reportReel(reelId);
  }, [haptic]);

  // Handle Delete Reel (own reels only)
  const handleDeleteReel = useCallback(async (reelId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const result = await ReelsService.deleteReel(token, reelId);
      if (result.success) {
        setReels(prev => {
          const next = prev.filter(r => r.id !== reelId);
          setCurrentIndex(i => Math.min(i, Math.max(0, next.length - 1)));
          return next;
        });
        setBackendReels(prev => prev.filter(r => r.id !== reelId));
        toastManager.showSuccess(t.reels.deleteSuccess, result.message || t.reels.deleteSuccessDetail);
      } else {
        Alert.alert(t.common.error, result.message || t.reels.deleteFailed);
      }
    } catch (error) {
      logger.error('Error deleting reel:', error);
      Alert.alert(t.common.error, t.reels.deleteFailed);
    }
  }, [getToken]);

  // Handle Edit Reel caption & hashtags (own reels only)
  const handleEditReel = useCallback(async (reelId: string, caption: string, hashtags: string[]) => {
    try {
      const token = await getToken();
      if (!token) return;

      const result = await ReelsService.editReel(token, reelId, { caption, hashtags });
      if (result.success) {
        // Update local state immediately (optimistic)
        const updateReel = (r: ReelData) =>
          r.id === reelId ? { ...r, description: caption, hashtags } : r;
        setReels(prev => prev.map(updateReel));
        setBackendReels(prev => prev.map(updateReel));
        toastManager.showSuccess(t.reels.editSuccess, t.reels.editSuccessDetail);
      } else {
        Alert.alert(t.common.error, result.message || t.reels.editFailed);
      }
    } catch (error) {
      logger.error('Error editing reel:', error);
      Alert.alert(t.common.error, t.reels.editFailed);
    }
  }, [getToken]);

  // ✅ Get comments for modal with stable reference - only updates when IDs actually change
  // ✅ FIX: Use refs to prevent infinite loop by avoiding dependency on object property
  const prevCommentsIdsRef = useRef<string>('');
  const prevCommentsResultRef = useRef<Comment[]>([]);

  const commentsForModal = useMemo(() => {
    if (!selectedReelId) {
      prevCommentsIdsRef.current = '';
      prevCommentsResultRef.current = [];
      return [];
    }

    const currentComments = reelComments[selectedReelId] || [];
    const currentIds = currentComments.map(c => c.id).join(',');

    // ✅ Only return new array reference if IDs actually changed
    if (currentIds === prevCommentsIdsRef.current) {
      return prevCommentsResultRef.current;
    }

    // Update refs and return new comments
    prevCommentsIdsRef.current = currentIds;
    prevCommentsResultRef.current = currentComments;
    commentsRef.current[selectedReelId] = currentComments;
    return currentComments;
  }, [selectedReelId, reelComments]); // ✅ Depend on full object, but use refs to prevent unnecessary updates

  // Handle Refresh - reload from backend (skip cache for fresh data)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptic.trigger('light');

    // Reset pagination
    setNextCursor(null);
    setHasMore(true);
    viewedReelsRef.current.clear();

    // Reload from backend, skip cache for fresh data
    await loadReelsFromBackend(undefined, true);

    setIsRefreshing(false);
  }, [haptic, loadReelsFromBackend]);

  // ✅ FIX: Use refs for stable callbacks to prevent "Changing onViewableItemsChanged on the fly" warning
  const reelsRef = useRef<ReelData[]>([]);
  const recordReelViewRef = useRef(recordReelView);

  // Keep refs updated
  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);

  useEffect(() => {
    recordReelViewRef.current = recordReelView;
  }, [recordReelView]);

  // ✅ FIX: viewabilityConfig must be stable - use useRef
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  // ✅ FIX: onViewableItemsChanged must be stable - use useRef with callback
  // This prevents "Changing onViewableItemsChanged on the fly is not supported" warning
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);

      // Record view for the current reel (use ref for latest function)
      const currentReel = viewableItems[0].item as ReelData;
      if (currentReel?.id) {
        recordReelViewRef.current(currentReel.id);
      }

      // Preload next 2-3 videos for smooth scrolling (Requirements 19.2, 19.3)
      // Use PreloadManager for centralized video preloading (use ref for latest reels)
      if (reelsRef.current.length > 0) {
        preloadManager.preloadNextReelVideos(reelsRef.current, newIndex);
      }
    }
  }).current;

  // Navigate to user profile
  const handleUserPress = useCallback((username: string) => {
    haptic.trigger('light');
    router.push({
      pathname: '/user/[username]',
      params: { username }
    });
  }, [haptic]);

  // Navigate to user profile from mention
  const handleMentionPress = useCallback((username: string) => {
    haptic.trigger('light');
    router.push({
      pathname: '/user/[username]',
      params: { username: username.replace('@', '') }
    });
  }, [haptic]);

  // Use global follow store
  const { follow, unfollow } = useFollowStore();

  // Helper to update local reels state when follow state changes
  const updateReelsFollowState = useCallback((userId: string, isFollowing: boolean) => {
    setReels(prev => prev.map(reel =>
      reel.user.id === userId
        ? { ...reel, user: { ...reel.user, isFollowing } }
        : reel
    ));
    setBackendReels(prev => prev.map(reel =>
      reel.user.id === userId
        ? { ...reel, user: { ...reel.user, isFollowing } }
        : reel
    ));
  }, []);

  // Handle follow from reel - Ultra Fast with Rollback (Requirements 18.3, 18.5)
  const handleFollow = useCallback(async (username: string, userId: string) => {
    haptic.trigger('medium');

    // Optimistic UI update - INSTANT (0ms) - Requirement 18.3
    follow(userId); // Update global store
    updateReelsFollowState(userId, true); // Update local state

    // Sync with backend in background (fire and forget with rollback) - Requirement 18.5
    try {
      const token = await getToken();
      if (token) {
        await FollowService.followUser(token, username);
      }
    } catch (error) {
      // ROLLBACK on failure
      logger.error('Error following user, rolling back:', error);
      unfollow(userId);
      updateReelsFollowState(userId, false);
    }
  }, [haptic, getToken, follow, unfollow, updateReelsFollowState]);

  // Handle unfollow from reel - Ultra Fast with Rollback (Requirements 18.3, 18.5)
  const handleUnfollow = useCallback(async (username: string, userId: string) => {
    haptic.trigger('medium');

    // Optimistic UI update - INSTANT (0ms) - Requirement 18.3
    unfollow(userId); // Update global store
    updateReelsFollowState(userId, false); // Update local state

    // Sync with backend in background (fire and forget with rollback) - Requirement 18.5
    try {
      const token = await getToken();
      if (token) {
        await FollowService.unfollowUser(token, username);
      }
    } catch (error) {
      // ROLLBACK on failure
      logger.error('Error unfollowing user, rolling back:', error);
      follow(userId);
      updateReelsFollowState(userId, true);
    }
  }, [haptic, getToken, follow, unfollow, updateReelsFollowState]);

  const currentUserId = globalState.userProfile?.id;
  const currentUsername = globalState.userProfile?.username?.toLowerCase();

  const resolveIsOwnReel = useCallback(
    (item: ReelData): boolean => {
      if (ownReelIds.has(item.id)) return true;
      if (currentUserId && item.user?.id && String(currentUserId) === String(item.user.id)) {
        return true;
      }
      const reelUsername = item.user?.username?.toLowerCase();
      if (currentUsername && reelUsername && currentUsername === reelUsername) return true;
      return false;
    },
    [ownReelIds, currentUserId, currentUsername],
  );

  const renderItem = useCallback(({ item, index }: { item: ReelData; index: number }) => (
    <ReelItem
      reel={item}
      isActive={index === currentIndex}
      shouldMountPlayer={Math.abs(index - currentIndex) <= REEL_PLAYER_MOUNT_DISTANCE}
      isOwnReel={resolveIsOwnReel(item)}
      onLike={() => handleLike(item.id)}
      onToggleMute={() => handleToggleMute(item.id)}
      onComment={() => openComments(item.id)}
      onReport={() => openReport(item.id)}
      onRecordShare={(platform) => { void recordReelShare(item.id, platform); }}
      onSave={() => handleSave(item.id)}
      onUserPress={() => handleUserPress(item.user.username)}
      onFollow={() => handleFollow(item.user.username, item.user.id)}
      onUnfollow={() => handleUnfollow(item.user.username, item.user.id)}
      onHashtagPress={handleHashtagPress}
      onMentionPress={handleMentionPress}
      onVideoRef={handleVideoRef}
      onDeleteReel={handleDeleteReel}
      onEditReel={handleEditReel}
    />
  ), [currentIndex, resolveIsOwnReel, handleLike, handleToggleMute, openComments, openReport, recordReelShare, handleSave, handleVideoRef, handleHashtagPress, handleUserPress, handleMentionPress, handleFollow, handleUnfollow, handleDeleteReel, handleEditReel]);

  const handleScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    flatListRef.current?.scrollToOffset({
      offset: Math.max(0, info.averageItemLength * info.index),
      animated: true,
    });
    setCurrentIndex(info.index);
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: ReelData) => item.id, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}

      {/* Hashtag Filter Bar */}
      {selectedHashtag && (
        <View style={styles.hashtagFilterBar}>
          <Text style={styles.hashtagFilterText}>
            #{selectedHashtag}
          </Text>
          <TouchableOpacity onPress={handleClearHashtag} style={styles.clearFilterButton}>
            <X size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Initial Loading with Skeleton (Medium Priority #7) */}
      {isInitialLoading && !loadError && (
        <SkeletonLoader variant="reel" />
      )}

      {/* Error Display (Critical Priority #3) */}
      {loadError && !isInitialLoading && (
        <ErrorDisplay
          type={isOffline ? 'offline' : networkError ? 'network' : 'server'}
          message={loadError}
          showRetry={true}
          onRetry={() => {
            setLoadError(null);
            setNetworkError(false);
            setIsInitialLoading(true);
            loadReelsFromBackend().finally(() => setIsInitialLoading(false));
          }}
          showRefresh={!isOffline}
          onRefresh={handleRefresh}
        />
      )}

      {/* No Reels Message - Improved empty state with guidance (Requirement 3.2) */}
      {!isInitialLoading && noReelsMessage && reels.length === 0 && (
        <View style={styles.noReelsContainer}>
          <View style={styles.noReelsIconContainer}>
            <Eye size={64} color="rgba(255,255,255,0.3)" />
          </View>
          <Text style={styles.noReelsTitle}>{t.reels.noVideosTitle}</Text>
          <Text style={styles.noReelsSubtitle}>{t.reels.noVideosSubtitle}</Text>
          <TouchableOpacity
            style={styles.noReelsButton}
            onPress={() => {
              haptic.trigger('light');
              router.push('/(tabs)/rank');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.noReelsButtonText}>{t.reels.noVideosCallToAction}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reels List */}
      {!isInitialLoading && reels.length > 0 && (
        <FlatList
          ref={flatListRef}
          data={filteredReels}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          // Performance optimizations — iOS: minimal window to avoid AVPlayer OOM/crash
          windowSize={REEL_LIST_WINDOW_SIZE}
          initialNumToRender={REEL_INITIAL_RENDER}
          maxToRenderPerBatch={REEL_MAX_BATCH}
          updateCellsBatchingPeriod={100} // Increased from 50 to 100ms for better batching
          removeClippedSubviews={false}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}
          onEndReached={loadMoreReels}
          onEndReachedThreshold={0.5}
          // Accessibility (Low Priority #13)
          accessible={true}
          accessibilityLabel={t.reels.a11yVideoList}
          accessibilityHint={t.reels.a11yVideoHint}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingMoreText}>{t.reels.loadingMore}</Text>
              </View>
            ) : !hasMore && reels.length > 0 ? (
              <View style={styles.endOfListContainer}>
                <Text style={styles.endOfListText}>{t.reels.endOfFeed}</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Swipe Hint */}
      {currentIndex === 0 && (
        <Animated.View style={styles.swipeHint}>
          <ChevronUp size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.swipeHintText}>{t.reels.swipeUp}</Text>
        </Animated.View>
      )}

      {/* Comments Modal */}
      <CommentsModal
        visible={showComments}
        onClose={() => {
          setShowComments(false);
          setHighlightCommentId(null);
        }}
        reelId={selectedReelId}
        comments={commentsForModal} // ✅ Use memoized comments
        onAddComment={(comment) => handleAddComment(selectedReelId, comment)}
        onToggleLike={(commentId) => handleToggleCommentLike(selectedReelId, commentId)}
        highlightCommentId={highlightCommentId}
      />

      {/* Unified Report System */}
      {reportConfig && (
        <ReportSystem
          visible={isReportVisible}
          onClose={closeReport}
          contentType={reportConfig.contentType}
          contentId={reportConfig.contentId}
          getToken={reportGetToken}
          onSuccess={handleSuccess}
        />
      )}
    </View>
  );
};

// Helper Functions
const formatCount = (count?: number): string => {
  if (count === undefined || count === null || isNaN(count)) return '0';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Loading & Empty States
  initialLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  initialLoadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 16,
  },
  noReelsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 40,
  },
  noReelsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  noReelsTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  noReelsSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  noReelsButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  noReelsButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingMoreText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  endOfListContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endOfListText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressContainer: {
    position: 'absolute',
    top: 95,
    right: 16,
    zIndex: 100,
    gap: 4,
  },
  progressBar: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  progressBarActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  progressBarCompleted: {
    backgroundColor: 'rgba(255,215,0,0.6)',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: COLORS.background,
  },
  videoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
  },
  retryText: {
    color: COLORS.background,
    fontWeight: '600',
  },
  // Replay overlay styles (Requirement 17.2)
  replayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  replayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  replayText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  doubleTapHeart: {
    position: 'absolute',
    zIndex: 999,
    pointerEvents: 'none',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 5,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 5,
  },
  userInfoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 100,
    left: 16,
    right: 80,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userFollowers: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },
  followButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
    zIndex: 10,
  },
  description: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  hashtag: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  statsContainer: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    flexDirection: 'row',
    gap: 24,
    zIndex: 10,
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  location: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  actionsColumn: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    gap: 4,
    zIndex: 100,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    backdropFilter: 'blur(10px)',
  },
  actionIconActive: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeHint: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  swipeHintText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  commentsContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  commentsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentLikeCount: {
    fontSize: 12,
    color: '#999',
  },
  commentLikeCountActive: {
    color: COLORS.error,
    fontWeight: '600',
  },
  commentInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'white',
    gap: 12,
  },
  commentTextInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 24,
    fontSize: 14,
    backgroundColor: '#f8f8f8',
    maxHeight: 100,
    color: '#000',
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  reportContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  reasonsList: {
    maxHeight: 300,
    marginBottom: 24,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
    gap: 12,
  },
  reasonItemSelected: {
    backgroundColor: '#ffebeb',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: COLORS.error,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.error,
  },
  reasonText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  reasonTextSelected: {
    color: COLORS.error,
    fontWeight: '500',
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: 'white',
    marginTop: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reportButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.error,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  reportSuccess: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  hashtagFilterBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  hashtagFilterText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearFilterButton: {
    padding: 8,
  },
});

function ReelsTabScreen() {
  const { t } = useTranslation();
  const retryKeyRef = useRef(0);

  return (
    <ReelsFeedErrorBoundary
      labels={{
        title: t.reels.feedErrorTitle,
        repeatedTitle: t.reels.feedErrorRepeated,
        repeatedHint: t.reels.feedErrorRepeatedHint,
        retry: t.reels.feedErrorRetry,
        hint: t.reels.feedErrorHint,
      }}
      onRetry={() => {
        retryKeyRef.current += 1;
      }}
    >
      <ReelsFeed key={retryKeyRef.current} />
    </ReelsFeedErrorBoundary>
  );
}

export default ReelsTabScreen;