import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Text, Share, Alert, ActionSheetIOS, Platform, RefreshControl, AppState, AppStateStatus, TouchableOpacity, Dimensions, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import ImageViewerModal from '../../components/common/ImageViewerModal';
import ReelUploadModal from '../../components/common/ReelUploadModal';
import VideoPlayerModal from '../../components/common/VideoPlayerModal';
import UploadProgressModal from '../../components/common/UploadProgressModal';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import ProfileHeader from '../../components/profile/ProfileHeader';
import ProfileCard from '../../components/profile/ProfileCard';
import UserInfo from '../../components/profile/UserInfo';
import StatsRow from '../../components/profile/StatsRow';
import ContentTabs from '../../components/profile/ContentTabs';
import VideoGrid from '../../components/profile/VideoGrid';
import ActionButtons from '../../components/profile/ActionButtons';
import { ProfileSkeleton } from '../../components/profile/ProfileSkeleton';
import ProfileTopBar from '../../components/profile/ProfileTopBar';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { getProfileCardOverlapMargin } from '../../constants/profileLayout';
import { DEFAULT_COUNTRY_FLAG, DEFAULT_POSITION, DEFAULT_STATS } from '../../constants/profileDefaults';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Flame } from 'lucide-react-native';
import { useXp } from '../../contexts/XpContext';
import { useLevelUpCelebrationOnFocus } from '../../hooks/useLevelUpCelebrationOnFocus';
import * as ImagePicker from 'expo-image-picker';
import { usePhotoPermission } from '../../hooks/usePhotoPermission';
import { useVideos, Comment } from '../../contexts/VideosContext';
import { globalState } from '../../globalState';
import { AuthService, CardProfileService, ProfileService, ReelsService } from '../../src/services/authService';
import { StorageService } from '../../src/services/storageService';
import { useImageUpload } from '../../hooks/useImageUpload';
import { toastManager } from '../../services/toastManager';
import { reelUploadNotification } from '../../services/reelUploadNotification';
import { syncExpoPushToken } from '../../services/pushTokenRegistration.service';
import { localProfileStorage } from '../../services/localProfileStorage';
import * as Haptics from 'expo-haptics';
import { useProfileCache, type ProfileUserData } from '../../hooks/useProfileCache';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import { useTranslation } from '../../src/i18n';
import {
  formatReelTooLargeMessage,
  getVideoFileSizeBytes,
  isReelVideoOverSizeLimit,
} from '../../src/utils/reelVideoLimits';
import { getProfileCompletionStepLabel } from '../../utils/i18nHelpers';
import {
  isCooldownApiError,
  isGatewayOrServerError,
  isReelUploadConflictError,
} from '../../utils/profileErrorHelpers';
import BadgesDisplay from '../../components/profile/BadgesDisplay';
import { getApiUrl } from '../../config/api.config';
import { buildProfileShareUrl } from '../../constants/shareLinks';
import { compressImage } from '@/utils/imageCompressor';
import { logger } from '../../utils/logger';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import CountryPickerModal from '../../components/common/CountryPickerModal';
import PositionPickerModal from '../../components/common/PositionPickerModal';
import ClubPickerModal from '../../components/common/ClubPickerModal';
import StatsEditModal, { Stats } from '../../components/common/StatsEditModal';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';
import { useReelUploadEventsStore } from '../../src/store/useReelUploadEventsStore';
import FollowersListModal from '../../components/profile/FollowersListModal';
import QRCodeModal from '../../components/profile/QRCodeModal';
import { useOptimisticProfile, useProfileFieldUpdate } from '../../hooks/useOptimisticProfile';
import SocialLinksSection from '../../components/profile/SocialLinksSection';
import { TopClub } from '../../data/top5LeaguesClubs';
import { DiamondProfile } from '../../types/profile';
import { ProfileAnalyticsTab } from '../../components/profile/ProfileAnalyticsTab';
import { ProfileSavedGrid } from '../../components/profile/ProfileVideoGrid';
import { ImagePreviewModal, AndroidImageSourceSheet, showImageSourceSheet } from '../../components/common/ImagePreviewModal';
import { CooldownBlockModal } from '../../components/common/CooldownBlockModal';
import { ProfileErrorBoundary } from '../../components/common/ProfileErrorBoundary';
import { useReelStatusPoller } from '../../hooks/useReelStatusPoller';
import { useWebSocketEvent } from '../../hooks/useWebSocket';
import type { AvatarProgressPayload } from '../../types/websocket';
import { useScreenFont } from '../../utils/fontSetup';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = getApiUrl();

/** Minimum gap between automatic profile API refreshes (tab focus / app resume) */
const PROFILE_UI_REFRESH_INTERVAL_MS = 30_000; // 30s — fast enough to feel live, gentle enough to skip duplicate fetches

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375; // iPhone SE and smaller
const isLargeScreen = screenWidth > 414;  // iPhone Plus and larger

// Responsive font sizes
const getFontSize = (base: number) => {
  if (isSmallScreen) return base * 0.9;
  if (isLargeScreen) return base * 1.1;
  return base;
};

// Responsive spacing
const getSpacing = (base: number) => {
  if (isSmallScreen) return base * 0.8;
  if (isLargeScreen) return base * 1.2;
  return base;
};

/**
 * XP required to go from currentLevel to currentLevel+1.
 * Mirrors backend xp.service.ts formula.
 */
const xpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  if (level === 2) return 290;
  return 40 + 125 * level * (level - 1);
};
const getXpForNextLevel = (currentLevel: number): number => {
  return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel);
};

// Types for profile handlers
interface Country {
  code: string;
  name: string;
  flag: string;
}

// Performance: Memoize expensive calculations outside component
const DEFAULT_FOLLOW_STATS = { followersCount: 0, followingCount: 0, reelsCount: 0, savedReelsCount: 0 };
// Helper function to get step icons
const getStepIcon = (stepId: string): keyof typeof Ionicons.glyphMap => {
  switch (stepId) {
    case 'avatar': return 'person-circle-outline';
    case 'country': return 'globe-outline';
    case 'club': return 'football-outline';
    case 'bio': return 'document-text-outline';
    case 'position': return 'location-outline';
    case 'cardData': return 'card-outline';
    case 'socialLinks': return 'link-outline';
    default: return 'checkmark-circle-outline';
  }
};

// StyleSheet definition - moved to top to avoid "used before declaration" errors
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ProfileTheme.colors.deepBlack,
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  hiddenTab: {
    display: 'none',
  },
  profileCardContainer: {
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: ProfileTheme.colors.textSecondary,
    fontSize: getFontSize(16),
    marginTop: getSpacing(16),
  },
  analyticsContainer: {
    paddingHorizontal: 20,
  },
  analyticsTitle: {
    fontSize: getFontSize(20),
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: getSpacing(20),
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  analyticsCard: {
    width: isSmallScreen ? '100%' : '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: getSpacing(16),
    padding: getSpacing(20),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: isSmallScreen ? getSpacing(12) : 0,
  },
  analyticsValue: {
    fontSize: getFontSize(28),
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    marginTop: getSpacing(8),
  },
  analyticsLabel: {
    fontSize: getFontSize(14),
    color: ProfileTheme.colors.textSecondary,
    marginTop: getSpacing(4),
  },
  analyticsSection: {
    marginTop: 24,
  },
  analyticsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ProfileTheme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgesContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  streakMasterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.35)',
  },
  streakMasterText: {
    color: '#FFAB76',
    fontSize: 13,
    fontWeight: '800',
  },
});

// ── Completion pill styles (outside main StyleSheet for clarity) ─────────────
const completionStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    backgroundColor: 'transparent',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(168,85,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBg: {
    width: 60,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 2,
  },
  pct: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'right',
  },
});

function ProfileScreen() {
  useScreenFont();
  useLevelUpCelebrationOnFocus();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const cardOverlap = getProfileCardOverlapMargin(screenHeight);
  const [activeTab, setActiveTab] = useState('videos');
  const [isOffline, setIsOffline] = useState(false);
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { user: clerkUser } = useUser();
  const { streak: loginStreak, refresh: refreshXp } = useXp();
  
  // Optimistic Profile Updates
  const { 
    updateUsername, 
    updateDisplayName, 
    updateBio, 
    updateFIFACard, 
    updateSocialLinks, 
    updateFavorites,
    isUpdating: isOptimisticUpdating 
  } = useProfileFieldUpdate();

  // Performance: Memoize these to prevent re-creation
  const {
    uploadedVideos,
    addVideo,
    setUserVideoData,
    removeVideo,
    reelComments,
    addComment,
    toggleCommentLike,
    likedReelIds,
    reelUploadUi,
    setReelUploadUi,
    resetReelUploadUi,
  } = useVideos();
  const { t, language } = useTranslation();
  const { requestLibraryPermission, requestCameraPermission } = usePhotoPermission();

  // Optimization: Prevent guest access - redirect to auth
  useEffect(() => {
    if (!isSignedIn) {
      router.replace('/auth');
    }
  }, [isSignedIn]);

  // Use the profile cache hook for cache-first loading
  const {
    userData: cachedUserData,
    followStats: cachedFollowStats,
    videos: cachedVideos,
    analytics: cachedAnalytics,
    cooldowns: cachedCooldowns,
    isLoading,
    isRefreshing,
    isCacheHit,
    error: cacheError,
    refresh: refreshCache,
    loadVideos,
    updateUserData: updateCachedUserData,
    updateFollowStats: updateCachedFollowStats,
  } = useProfileCache({
    getToken,
    clerkUserImageUrl: clerkUser?.imageUrl,
    clerkUserId: clerkUser?.id,
    clerkFallback: clerkUser
      ? {
          clerkUserId: clerkUser.id,
          username: clerkUser.username,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
          primaryEmail: clerkUser.primaryEmailAddress?.emailAddress,
        }
      : undefined,
  });

  // ✅ FIXED: Profile completion hook with infinite loop protection
  const {
    completionStatus,
    isLoading: isCompletionLoading,
    error: completionError,
    refresh: refreshCompletion,
    markStepCompleted,
  } = useProfileCompletion();

  // Log cache errors
  useEffect(() => {
    if (cacheError) {
      logger.error('Profile cache error:', cacheError);
    }
  }, [cacheError]);

  // Log loading state changes
  useEffect(() => {
    logger.debug('[ProfileScreen] State:', {
      isLoading,
      hasUserData: !!cachedUserData,
      isCacheHit,
      error: cacheError,
    });
  }, [isLoading, cachedUserData, isCacheHit, cacheError]);

  // CRITICAL FIX: Auto-retry on ANY error (not just 502)
  const lastAutoRetryAtRef = useRef<number>(0);
  const autoRetryCountRef = useRef<number>(0);
  const MAX_AUTO_RETRIES = 3; // defined here for use in render
  useEffect(() => {
    const now = Date.now();
    const hasError = !!cacheError && !cachedUserData;
    const isGatewayError = hasError && /502|bad gateway|gateway/i.test(cacheError!);
    // Retry delay: 5s for gateway errors (cold start), 3s for other errors
    const retryDelay = isGatewayError ? 8000 : 3000;
    // Minimum gap between retries: 10s
    const minGap = 10_000;

    if (hasError && !isLoading && autoRetryCountRef.current < MAX_AUTO_RETRIES && now - lastAutoRetryAtRef.current > minGap) {
      lastAutoRetryAtRef.current = now;
      autoRetryCountRef.current += 1;
      const retryTimeout = setTimeout(() => {
        logger.debug(`[ProfileScreen] Auto-retry #${autoRetryCountRef.current} after error (${retryDelay}ms delay)`);
        refreshCache(true).catch(err => {
          logger.error('[ProfileScreen] Auto-retry failed:', err);
        });
      }, retryDelay);

      return () => clearTimeout(retryTimeout);
    }
  }, [cacheError, cachedUserData, isLoading, refreshCache]);

  // Reset retry counter when error clears
  useEffect(() => {
    if (!cacheError) {
      autoRetryCountRef.current = 0;
    }
  }, [cacheError]);

  // Countdown timer for error screen - shows user when next retry will happen
  useEffect(() => {
    if (!cacheError || !!cachedUserData || isLoading) {
      setRetryCountdown(null);
      return;
    }
    if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
      setRetryCountdown(null);
      return;
    }
    // Show countdown: 3s for normal errors, 8s for gateway errors
    const isGatewayError = /502|bad gateway|gateway/i.test(cacheError);
    const totalSeconds = isGatewayError ? 8 : 3;
    setRetryCountdown(totalSeconds);
    const interval = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cacheError, cachedUserData, isLoading]);

  // CRITICAL FIX: Timeout fallback if loading takes too long (first-ever launch only)
  const hasForcedRefreshRef = useRef(false);
  useEffect(() => {
    if (isLoading && !cachedUserData && !hasForcedRefreshRef.current) {
      const timeout = setTimeout(() => {
        logger.warn('Profile loading slow - attempting refresh');
        hasForcedRefreshRef.current = true;
        refreshCache(true).catch(err => {
          logger.error('[ProfileScreen] Refresh failed:', err);
          toastManager.showError(t.common.error, t.profile.refreshFailedMessage);
        });
      }, 15000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, cachedUserData, refreshCache]);
  // Local state for UI-specific data not in cache
  const [localImage, setLocalImageState] = useState<string | null>(globalState.localAvatar || null);
  const setLocalImage = (image: string | null) => {
    setLocalImageState(image);
    globalState.setLocalAvatar(image || undefined);
  };

  // Modal visibility states
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [isPositionModalVisible, setIsPositionModalVisible] = useState(false);
  const [isClubModalVisible, setIsClubModalVisible] = useState(false);
  const [isStatsModalVisible, setIsStatsModalVisible] = useState(false);
  const [isEditProfileModalVisible, setIsEditProfileModalVisible] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const [selectedReelSocial, setSelectedReelSocial] = useState({
    liked: false,
    likes: 0,
    saved: false,
    shares: 0,
    views: 0,
  });

  // UX Fix 1+2: Image preview + cross-platform action sheet state
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'avatar' | 'cover'>('avatar');
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [pendingUploadFn, setPendingUploadFn] = useState<(() => void) | null>(null);
  const [androidSheetVisible, setAndroidSheetVisible] = useState(false);
  const [androidSheetOptions, setAndroidSheetOptions] = useState<any>(null);

  // UX Fix 3: Cooldown block modal state
  const [cooldownBlockVisible, setCooldownBlockVisible] = useState(false);
  const [cooldownBlockType, setCooldownBlockType] = useState<'avatar' | 'cover' | 'reel'>('avatar');
  const handleCooldownBlockClose = useCallback(() => {
    setCooldownBlockVisible(false);
  }, []);

  // UX Fix 4: Reel status polling
  const [pollingReelId, setPollingReelId] = useState<string | null>(null);
  const handledPollReelRef = useRef<string | null>(null);
  const reelStatus = useReelStatusPoller(pollingReelId, getToken, !!pollingReelId);

  // Cross-screen event store — notifies the reels feed when a reel becomes READY
  const markReelReady = useReelUploadEventsStore(s => s.markReady);
  const markReelFailed = useReelUploadEventsStore(s => s.markFailed);

  // ✅ FIX: When a polled reel finishes processing, refresh the profile videos
  // grid AND signal the reels feed so it invalidates its cache.
  // Without this, freshly uploaded reels stayed hidden until tab focus + 10s
  // throttle window passed.
  useEffect(() => {
    if (!pollingReelId) {
      handledPollReelRef.current = null;
      return;
    }
    if (reelStatus.stage === 'ready') {
      if (handledPollReelRef.current === pollingReelId) return;
      handledPollReelRef.current = pollingReelId;
      (async () => {
        try {
          await cacheService.invalidate(CACHE_KEYS.REELS_FEED).catch(() => {});
          if (userData?.username) {
            await loadVideos(userData.username, true);
          }
          markReelReady(pollingReelId);
        } finally {
          setPollingReelId(null);
        }
      })();
    } else if (reelStatus.stage === 'failed') {
      if (handledPollReelRef.current === pollingReelId) return;
      handledPollReelRef.current = pollingReelId;
      markReelFailed(pollingReelId);
      setPollingReelId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelStatus.stage, pollingReelId]);

  // Loading states for profile operations
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [isCoverUploading, setIsCoverUploading] = useState(false);

  // Subscribe to real-time server-side avatar upload progress.
  // The backend emits 'avatar:progress' events as the upload moves through
  // (received -> validating -> uploading -> persisting -> completed/failed).
  // We only animate while the local upload UI is active to avoid resetting
  // the bar on stale events from a previous attempt.
  useWebSocketEvent('avatar:progress', useCallback((message) => {
    const payload = message.payload as unknown as AvatarProgressPayload;
    if (!payload || typeof payload.pct !== 'number') return;
    if (!isAvatarUploading && payload.stage !== 'completed' && payload.stage !== 'failed') {
      // Late event for a finished session — ignore.
      return;
    }
    setAvatarUploadProgress(payload.pct);
    if (payload.stage === 'completed' || payload.stage === 'failed') {
      // Reset shortly so the next session starts from 0.
      setTimeout(() => setAvatarUploadProgress(0), 600);
    }
  }, [isAvatarUploading]));
  const [isCountryUpdating, setIsCountryUpdating] = useState(false);
  const [isClubUpdating, setIsClubUpdating] = useState(false);
  const [isStatsUpdating, setIsStatsUpdating] = useState(false);

  // Video upload progress state
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadMessage, setVideoUploadMessage] = useState(t.profile.uploadingVideo);

  // Unified image upload (progress + retries + timeout) for iOS/Android
  const { upload: uploadImage, isUploading: isImageUploading, progress: imageUploadProgress } = useImageUpload();
  const [imageUploadMessage, setImageUploadMessage] = useState(t.profile.updating);

  // New modals for profile features
  const [isFollowersModalVisible, setIsFollowersModalVisible] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);
  const [isTasksModalVisible, setIsTasksModalVisible] = useState(false);
  const [isCompletionDetailVisible, setIsCompletionDetailVisible] = useState(false);

  // Cover image state
  const [coverImage, setCoverImageState] = useState<string | null>(globalState.localCover || null);
  const setCoverImage = (image: string | null) => {
    setCoverImageState(image);
    globalState.setLocalCover(image || undefined);
  };

  // Video Management State
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  // Auto-retry countdown for error screen
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Optimization: Token state for BadgesDisplay
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Optimization: Fetch token for badges (memoized)
  useEffect(() => {
    let isMounted = true;
    const fetchToken = async () => {
      try {
        const token = await getToken();
        if (isMounted && token) {
          setAuthToken(token);
        }
      } catch (error) {
        // Silent fail - badges will handle missing token
      }
    };
    fetchToken();
    return () => { isMounted = false; };
  }, []);

  // Optimization: Derive state from cache with memoization
  const userData = cachedUserData;
  const followStats = useMemo(() =>
    cachedFollowStats || DEFAULT_FOLLOW_STATS,
    [cachedFollowStats]
  );

  const displayCountryFlag = useMemo(
    () => (userData?.countryFlag?.trim() ? userData.countryFlag! : DEFAULT_COUNTRY_FLAG),
    [userData?.countryFlag]
  );
  const displayLocation = useMemo(
    () => (userData?.country || userData?.location || '').trim(),
    [userData?.country, userData?.location]
  );
  const displayPosition = useMemo(
    () => (userData?.position?.trim() ? userData.position! : DEFAULT_POSITION),
    [userData?.position]
  );
  const displayClubLogo = userData?.clubLogo;
  const displayStats = useMemo(
    () => ({
      age:
        userData?.age != null && userData.age > 0
          ? String(userData.age)
          : DEFAULT_STATS.age,
      height:
        userData?.height != null && userData.height > 0
          ? String(userData.height)
          : DEFAULT_STATS.height,
      weight:
        userData?.weight != null && userData.weight > 0
          ? String(userData.weight)
          : DEFAULT_STATS.weight,
      foot: (userData?.preferredFoot as 'R' | 'L' | 'B') || DEFAULT_STATS.foot,
    }),
    [userData?.age, userData?.height, userData?.weight, userData?.preferredFoot]
  );

  // Helper function to validate and get token
  const getValidatedToken = async (): Promise<string | null> => {
    if (!userData) {
      toastManager.showError(t.common.error, t.profile.userDataNotAvailable);
      return null;
    }
    const token = await getToken();
    if (!token) {
      toastManager.showAuthError();
      return null;
    }
    return token;
  };

  // Saved videos state — now managed by ProfileSavedGrid component
  // (removed from this component to reduce re-render surface)

  const myVideos = React.useMemo(() => {
    const cached = cachedVideos || [];
    const uploaded = uploadedVideos || [];

    // Merge uploaded videos first (they have priority for optimistic updates)
    const allVideos = [...uploaded, ...cached];

    // O(n) deduplication using Map instead of O(n²) reduce+find
    const seen = new Map<string, boolean>();
    const uniqueVideos = allVideos.filter(video => {
      if (seen.has(video.id)) return false;
      seen.set(video.id, true);
      return true;
    });

    // Helper — reject thumbnail/image URLs so the player is never handed one.
    const isPlayableVideoUrl = (url: any): boolean => {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      if (trimmed.length === 0) return false;
      if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('file://')) return false;
      const lower = trimmed.toLowerCase();
      if (lower.includes('/thumbnails/') || lower.includes('/thumbnail/')) return false;
      if (/\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(lower)) return false;
      return true;
    };

    return uniqueVideos
      .map((video: any) => {
        const rawVideoUrl = video.videoUrl || video.uri || '';
        // Never fall back to thumbnail — that's an image URL and would
        // cause "Failed to load video" in the player.
        const videoUrl = isPlayableVideoUrl(rawVideoUrl) ? rawVideoUrl : '';
        // Backend returns status: 'PROCESSING' for reels still being encoded
        // Also treat FAILED status so user can see and retry
        const isProcessing = video.status === 'PROCESSING' || (!videoUrl && !video.isUploading && video.status !== 'FAILED');
        const isFailed = video.status === 'FAILED';
        return {
          id: video.id,
          thumbnail: video.thumbnail || video.uri,
          videoUrl,
          views: video.views || '0',
          likes: typeof video.likes === 'number' ? video.likes : Number(video.likes) || 0,
          shares: typeof video.shares === 'number' ? video.shares : Number(video.shares) || 0,
          duration: video.duration || '',
          isUploading: video.isUploading || false,
          isProcessing,
          isFailed,
          uploadProgress: video.uploadProgress,
          status: video.status,
        };
      })
      // Show: uploading, processing, failed, or ready (has videoUrl)
      .filter((v: any) => v.isUploading || v.isProcessing || v.isFailed || v.videoUrl.length > 0);
  }, [cachedVideos, uploadedVideos]);

  const likedReelIdsSet = React.useMemo(() => new Set(likedReelIds), [likedReelIds]);
  
  const analytics = cachedAnalytics;
  const cooldowns = cachedCooldowns;

  // Predictions store — hydrate from cache on mount for instant analytics
  const predictionStats = usePredictionsStore((s) => s.stats);
  const allPredictions = usePredictionsStore((s) => s.allPredictions);
  const hydratePredictionsCache = usePredictionsStore((s) => s.hydrateFromCache);

  const PREDICTIONS_REFRESH_MS = 30_000;
  const lastPredictionsFetchRef = useRef(0);
  const predictionsBootstrappedForRef = useRef<string | null>(null);

  const refreshProfilePredictions = useCallback(async (force = false) => {
    if (!clerkUser?.id) return;
    const now = Date.now();
    if (!force && now - lastPredictionsFetchRef.current < PREDICTIONS_REFRESH_MS) return;
    lastPredictionsFetchRef.current = now;
    try {
      const { getClerkBearerToken } = await import('../../utils/clerkAuthToken');
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return;
      await usePredictionsStore.getState().preloadProfilePredictions(token, clerkUser.id);
    } catch (error) {
      logger.error('Error refreshing profile predictions:', error);
    }
  }, [clerkUser?.id]);

  useEffect(() => {
    if (!clerkUser?.id) return;
    void hydratePredictionsCache(clerkUser.id);
  }, [clerkUser?.id, hydratePredictionsCache]);

  useEffect(() => {
    if (!clerkUser?.id) return;
    if (predictionsBootstrappedForRef.current === clerkUser.id) return;
    predictionsBootstrappedForRef.current = clerkUser.id;
    void refreshProfilePredictions(true);
  }, [clerkUser?.id, refreshProfilePredictions]);

  const lastMergedServerSigRef = useRef<string>('');
  const lastClerkIdForMergeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (clerkUser?.id !== lastClerkIdForMergeRef.current) {
      lastMergedServerSigRef.current = '';
      lastClerkIdForMergeRef.current = clerkUser?.id;
    }
  }, [clerkUser?.id]);

  useEffect(() => {
    if (!userData) return;

    const serverSig = [
      clerkUser?.id ?? '',
      userData.username,
      userData.avatar ?? '',
      userData.coverImage ?? '',
      userData.countryFlag ?? '',
      userData.country ?? '',
      userData.position ?? '',
      userData.clubLogo ?? '',
      userData.age ?? '',
      userData.height ?? '',
      userData.weight ?? '',
      userData.preferredFoot ?? '',
    ].join('|');

    if (serverSig === lastMergedServerSigRef.current) {
      return;
    }
    lastMergedServerSigRef.current = serverSig;

    let cancelled = false;
    (async () => {
      try {
        const merged = await localProfileStorage.mergeWithServerData(userData);
        if (cancelled) return;

        const patch: Partial<ProfileUserData> = {};
        if (merged.countryFlag != null && merged.countryFlag !== userData.countryFlag) {
          patch.countryFlag = merged.countryFlag;
        }
        if (merged.country != null && merged.country !== userData.country) {
          patch.country = merged.country;
          patch.location = merged.country;
        }
        if (merged.position != null && merged.position !== userData.position) {
          patch.position = merged.position;
        }
        if (merged.clubLogo != null && merged.clubLogo !== userData.clubLogo) {
          patch.clubLogo = merged.clubLogo;
        }
        if (merged.favoriteTeam != null && merged.favoriteTeam !== userData.favoriteTeam) {
          patch.favoriteTeam = merged.favoriteTeam;
        }
        if (merged.age != null && merged.age !== userData.age) patch.age = merged.age;
        if (merged.height != null && merged.height !== userData.height) patch.height = merged.height;
        if (merged.weight != null && merged.weight !== userData.weight) patch.weight = merged.weight;
        if (merged.preferredFoot != null && merged.preferredFoot !== userData.preferredFoot) {
          patch.preferredFoot = merged.preferredFoot;
        }

        if (Object.keys(patch).length > 0) {
          updateCachedUserData(patch);
        }
      } catch (error) {
        logger.error('Error merging local profile into cache:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userData, clerkUser?.id, updateCachedUserData]);

  useEffect(() => {
    if (!userData) return;
    if (userData.avatar) {
      setLocalImage(userData.avatar);
      globalState.setLocalAvatar(userData.avatar);
    }
    if (userData.coverImage) {
      setCoverImage(userData.coverImage);
    }
    globalState.username = userData.username;
  }, [userData?.avatar, userData?.coverImage, userData?.username]);

  // Ref to store refreshCache to avoid dependency issues
  const refreshCacheRef = useRef(refreshCache);
  refreshCacheRef.current = refreshCache;

  // Throttle refresh calls to prevent request storms (iOS/Android focus + AppState + preload)
  // Initialize to now so the first useFocusEffect call is suppressed — the hook's
  // own useEffect already fires refresh() on mount.
  const lastUiRefreshAtRef = useRef<number>(Date.now());
  const profileSaveInFlightRef = useRef(false);
  const maybeRefreshProfile = useCallback((reason: 'focus' | 'app_active') => {
    const now = Date.now();
    if (isOffline) return;
    if (profileSaveInFlightRef.current) return;
    if (isLoading || isRefreshing) return;
    if (now - lastUiRefreshAtRef.current < PROFILE_UI_REFRESH_INTERVAL_MS) return;
    lastUiRefreshAtRef.current = now;
    logger.debug(`[ProfileScreen] Refresh triggered (${reason})`);
    refreshCacheRef.current(false);
  }, [isOffline, isLoading, isRefreshing]);

  // Refresh on focus - use cache hook's refresh + fresh prediction stats (throttled)
  useFocusEffect(
    useCallback(() => {
      maybeRefreshProfile('focus');
      void refreshProfilePredictions(false);
    }, [maybeRefreshProfile, refreshProfilePredictions])
  );

  // Auto-refresh when app returns from background
  const appStateRef = useRef(AppState.currentState);
  // ✅ FIX: Prevent refresh when image/video picker is open
  const isPickerActiveRef = useRef(false);
  const reelUploadInFlightRef = useRef(false);
  const lastGridProgressRef = useRef(-1);
  const lastUploadUiProgressRef = useRef(-1);
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        !isPickerActiveRef.current // ← لا تعمل refresh لو الـ picker مفتوح
      ) {
        maybeRefreshProfile('app_active');
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [maybeRefreshProfile]);

  // Offline detection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected ?? true));
    });
    return () => unsubscribe();
  }, []);

  // Optimization: Memoize cover press handler
  const handleCoverPress = useCallback(() => {
    const options = [t.profile.viewImage, t.profile.changeImage, t.profile.cancel];
    const cancelButtonIndex = 2;

    const handlePress = (buttonIndex: number) => {
      if (buttonIndex === 0) {
        setIsImageViewerVisible(true);
      } else if (buttonIndex === 1) {
        handleCoverUpload();
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        handlePress
      );
    } else {
      Alert.alert(
        t.profile.coverImage,
        t.profile.whatToDo,
        [
          { text: t.profile.viewImage, onPress: () => handlePress(0) },
          { text: t.profile.changeImage, onPress: () => handlePress(1) },
          { text: t.profile.cancel, style: 'cancel' },
        ]
      );
    }
  }, [t]);

  const handleCoverUpload = async () => {
    if (!userData) {
      toastManager.showError(t.common.error, t.profile.userDataNotAvailable);
      return;
    }

    // UX Fix 3: Check cooldown BEFORE opening picker
    if (cooldowns && !cooldowns.cover.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setCooldownBlockType('cover');
      setCooldownBlockVisible(true);
      return;
    }

    const hasLibrary = await requestLibraryPermission();
    if (!hasLibrary) return;

    // UX Fix 2: Cross-platform action sheet
    showImageSourceSheet(
      {
        title: t.profile.coverImageTitle,
        hasExistingImage: !!userData.coverImage,
        onGallery: () => _pickCoverFromGallery(),
        onCamera: () => _pickCoverFromCamera(),
      },
      setAndroidSheetVisible,
      setAndroidSheetOptions,
    );
  };

  const _pickCoverFromGallery = async () => {
    isPickerActiveRef.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled) return;
      const imageUri = result.assets[0]?.uri;
      if (!imageUri) return;
      await _prepareCoverPreview(imageUri);
    } finally {
      isPickerActiveRef.current = false;
    }
  };

  const _pickCoverFromCamera = async () => {
    const hasCamera = await requestCameraPermission();
    if (!hasCamera) return;
    isPickerActiveRef.current = true;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled) return;
      const imageUri = result.assets[0]?.uri;
      if (!imageUri) return;
      await _prepareCoverPreview(imageUri);
    } finally {
      isPickerActiveRef.current = false;
    }
  };

  const _prepareCoverPreview = async (imageUri: string) => {
    let finalUri = imageUri;
    try {
      toastManager.showInfo(t.profile.processing, t.profile.compressingCoverImage);
      const compressed = await compressImage(imageUri, { maxWidth: 1920, maxHeight: 1080, quality: 0.8 });
      finalUri = compressed.uri;
    } catch {
      finalUri = imageUri;
    }
    // UX Fix 1: Show preview before uploading
    setPreviewUri(finalUri);
    setPreviewType('cover');
    setPendingUploadFn(() => () => _executeCoverUpload(finalUri));
    setIsPreviewVisible(true);
  };

  const _executeCoverUpload = async (finalUri: string) => {
    if (!userData) return;
    const originalCover = userData.coverImage;
    setCoverImage(finalUri);
    setImageUploadMessage(t.profile.uploading);
    setIsCoverUploading(true);
    try {
      const token = await getToken();
      if (!token) {
        setCoverImage(originalCover || null);
        toastManager.showAuthError();
        return;
      }
      const uploadResult = await uploadImage(finalUri, {
        endpoint: '/upload/cover',
        fieldName: 'file',
        maxRetries: 2,
        timeoutMs: 55_000,
      });
      if (uploadResult.success && uploadResult.url) {
        setCoverImage(uploadResult.url);
        globalState.setLocalCover(uploadResult.url);
        await updateCachedUserData({ coverImage: uploadResult.url });
        refreshCache(false).catch(err => logger.error('Background refresh error:', err));
        toastManager.showUploadSuccess('image');
      } else {
        setCoverImage(originalCover || null);
        const errorMessage = uploadResult.error || t.profile.coverUploadFailed;
        if (isCooldownApiError(uploadResult.data)) {
          toastManager.showWarning(t.profile.waitABit, errorMessage);
        } else {
          toastManager.showUploadError('image');
        }
      }
    } catch (err: any) {
      logger.error('Cover upload exception:', err);
      setCoverImage(originalCover || null);
      toastManager.showError(t.common.error, t.profile.coverUploadFailed || t.profile.coverUploadFailedFallback);
    } finally {
      setIsCoverUploading(false);
    }
  };
  const handleImageUpload = async () => {
    if (!userData) {
      toastManager.showError(t.common.error, t.profile.userDataNotAvailable);
      return;
    }

    // UX Fix 3: Check cooldown BEFORE opening picker
    if (cooldowns && !cooldowns.avatar.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setCooldownBlockType('avatar');
      setCooldownBlockVisible(true);
      return;
    }

    // UX Fix 2: Cross-platform action sheet with "remove" option
    showImageSourceSheet(
      {
        title: t.profile.avatarImageTitle,
        hasExistingImage: !!(userData.avatar || localImage),
        onGallery: () => _pickAvatarFromGallery(),
        onCamera: () => _pickAvatarFromCamera(),
        onRemove: () => _removeAvatar(),
      },
      setAndroidSheetVisible,
      setAndroidSheetOptions,
    );
  };

  // UX Fix 5: Remove avatar
  const _removeAvatar = async () => {
    const token = await getToken();
    if (!token) { toastManager.showAuthError(); return; }
    setIsAvatarUploading(true);
    try {
      const res = await fetch(`${API_URL}/upload/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === 'SUCCESS') {
        setLocalImage(null);
        globalState.setLocalAvatar(undefined);
        await updateCachedUserData({ avatar: null });
        toastManager.showSuccess(t.common.done, t.profile.avatarRemoved);
        // Note: We're keeping the success toast simple — the user already saw the avatar disappear.
      } else {
        toastManager.showError(t.common.error, json.message || t.profile.avatarRemoveFailed);
      }
    } catch (err: any) {
      logger.error('Remove avatar error:', err);
      toastManager.showError(t.common.error, t.profile.avatarRemoveNetworkError);
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const _pickAvatarFromGallery = async () => {
    const hasLibrary = await requestLibraryPermission();
    if (!hasLibrary) return;
    isPickerActiveRef.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const imageUri = result.assets[0]?.uri;
      if (!imageUri) return;
      await _prepareAvatarPreview(imageUri);
    } finally {
      isPickerActiveRef.current = false;
    }
  };

  const _pickAvatarFromCamera = async () => {
    const hasCamera = await requestCameraPermission();
    if (!hasCamera) return;
    isPickerActiveRef.current = true;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const imageUri = result.assets[0]?.uri;
      if (!imageUri) return;
      await _prepareAvatarPreview(imageUri);
    } finally {
      isPickerActiveRef.current = false;
    }
  };

  const _prepareAvatarPreview = async (imageUri: string) => {
    let finalUri = imageUri;
    try {
      const compressed = await compressImage(imageUri, { maxWidth: 1080, maxHeight: 1080, quality: 0.7 });
      finalUri = compressed.uri;
    } catch { finalUri = imageUri; }
    // UX Fix 1: Show preview before uploading
    setPreviewUri(finalUri);
    setPreviewType('avatar');
    setPendingUploadFn(() => () => _executeAvatarUpload(finalUri));
    setIsPreviewVisible(true);
  };

  const _executeAvatarUpload = async (finalUri: string) => {
    if (!userData) return;
    const originalAvatar = userData.avatar;
    setLocalImage(finalUri);
    setImageUploadMessage(t.profile.uploading);
    setIsAvatarUploading(true);
    setAvatarUploadProgress(5);
    try {
      const uploadResult = await uploadImage(finalUri, {
        endpoint: '/upload/avatar',
        fieldName: 'file',
        maxRetries: 2,
        timeoutMs: 55_000,
      });
      if (uploadResult.success && uploadResult.url) {
        setLocalImage(uploadResult.url);
        if (globalState.userProfile) globalState.userProfile.avatar = uploadResult.url;
        globalState.setLocalAvatar(uploadResult.url);
        await updateCachedUserData({ avatar: uploadResult.url });
        refreshCache(false).catch(err => logger.error('Background refresh error:', err));
        await refreshXp();
        toastManager.showUploadSuccess('image');
      } else {
        setLocalImage(originalAvatar || null);
        const errorMessage = uploadResult.error || t.profile.avatarUploadFailed;
        if (isCooldownApiError(uploadResult.data)) {
          toastManager.showWarning(t.profile.waitABit, errorMessage);
        } else {
          toastManager.showUploadError('image');
        }
      }
    } catch (err: any) {
      logger.error('Avatar upload exception:', err);
      setLocalImage(originalAvatar || null);
      toastManager.showError(t.common.error, t.profile.avatarUploadFailed || t.profile.avatarUploadFailedFallback);
    } finally {
      setIsAvatarUploading(false);
    }
  };

  // Handle upload video function
  const handleUploadVideo = async (newVideo: any) => {
    // Cooldowns load in the background after profile paint — fetch explicitly
    // so upload is not blocked by a stale cache missing cooldowns.
    let reelCooldowns = cooldowns;
    if (!reelCooldowns) {
      try {
        const token = await getToken();
        if (token) {
          reelCooldowns = (await ProfileService.getCooldowns(token)) ?? null;
        }
      } catch (err) {
        logger.warn('[Profile] Failed to fetch cooldowns before reel upload:', err);
      }
    }
    if (!reelCooldowns) {
      logger.warn('[ReelUpload] Cooldowns unavailable after fetch');
      toastManager.showInfo(t.common.loading, t.profile.loadingUploadInfo);
      return;
    }

    // UX Fix 3: Show cooldown block modal BEFORE opening upload modal
    if (!reelCooldowns.reelUpload.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setCooldownBlockType('reel');
      setCooldownBlockVisible(true);
      return;
    }

    // Validate video duration
    if (newVideo.duration) {
      const durationInSeconds = parseFloat(newVideo.duration);
      if (durationInSeconds < 5) {
        toastManager.showWarning(t.profile.videoTooShortTitle, t.profile.videoTooShortMessage);
        return;
      }
      if (durationInSeconds > 60) {
        toastManager.showWarning(t.profile.videoTooLongTitle, t.profile.videoTooLongMessage);
        return;
      }
    }

    try {
      const sizeBytes = await getVideoFileSizeBytes(
        newVideo.uri,
        (newVideo as { fileSize?: number }).fileSize,
      );
      if (sizeBytes != null && isReelVideoOverSizeLimit(sizeBytes)) {
        toastManager.showWarning(
          t.profile.videoTooLargeTitle,
          formatReelTooLargeMessage(t.profile.videoTooLargeMessage, sizeBytes),
        );
        return;
      }
    } catch (sizeErr) {
      logger.warn('[ReelUpload] Client size check failed (continuing):', sizeErr);
    }

    if (reelUploadInFlightRef.current) {
      toastManager.showWarning(t.profile.waitABit, t.profile.uploadAlreadyInProgress);
      return;
    }

    toastManager.showSuccess(t.profile.videoSelectedTitle, t.profile.videoSelectedMessage);

    reelUploadInFlightRef.current = true;
    lastUploadUiProgressRef.current = -1;
    lastGridProgressRef.current = -1;

    try {
    setUserVideoData({
      username: userData?.username || 'user',
      avatar: localImage || userData?.avatar || null,
      displayName: userData?.displayName || userData?.username || 'User',
    });

    setActiveTab('videos');

    // Create optimistic video with loading state
    const tempVideo = {
      id: newVideo.id,
      uri: newVideo.uri,
      thumbnail: newVideo.thumbnail,
      createdAt: new Date(),
      isUploading: true,
      uploadProgress: 0,
      views: '0',
      duration: newVideo.duration || '0:00',
    };

    // Add video to UI immediately (optimistic update)
    addVideo(tempVideo);

    // ✅ Show upload progress modal
    setIsVideoUploading(true);
    setVideoUploadProgress(0);
    setVideoUploadMessage(t.profile.preparingUpload);
    void activateKeepAwakeAsync('reel-upload');

    try {
      const token = await getToken();
      if (!token) {
        removeVideo(newVideo.id);
        setIsVideoUploading(false);
        toastManager.showAuthError();
        return;
      }

      // Ensure backend user row exists (iOS can upload before /clerk/me completes).
      try {
        await AuthService.syncUserWithBackend(token, { getToken });
      } catch (syncErr) {
        logger.warn('[ReelUpload] Pre-upload sync failed (continuing):', syncErr);
      }

      const caption = newVideo.caption || '';
      const hashtags = caption.match(/#[\w\u0600-\u06FF]+/g) || [];
      const mentions = caption.match(/@[\w]+/g) || [];

      const syncReelProgress = (progress: number) => {
        const safeProgress = Math.min(Math.max(Math.round(progress), 0), 100);
        let label = t.profile.preparingUpload;
        if (safeProgress >= 20 && safeProgress < 90) label = t.profile.uploadingVideo;
        else if (safeProgress >= 90 && safeProgress < 100) label = t.profile.processingVideo;
        else if (safeProgress >= 100) label = t.profile.uploadSuccessPhase;

        const shouldUpdateUi =
          safeProgress === 0 ||
          safeProgress >= 100 ||
          safeProgress - lastUploadUiProgressRef.current >= 5;
        if (shouldUpdateUi) {
          lastUploadUiProgressRef.current = safeProgress;
          setVideoUploadProgress(safeProgress);
          setVideoUploadMessage(label);
          setReelUploadUi({ active: true, progress: safeProgress, phaseLabel: label });
          void reelUploadNotification.updateProgress(safeProgress, label);
        }
      };

      setReelUploadUi({ active: true, progress: 0, phaseLabel: t.profile.preparingUpload });
      await reelUploadNotification.begin(getToken);

      logger.info('[ReelUpload] Starting POST to /api/upload/reel...', {
        uri: newVideo.uri?.slice(0, 80),
      });

      const uploadResult = await StorageService.uploadReel(
        token,
        newVideo.uri,
        newVideo.thumbnail,
        caption,
        hashtags.map((h: string) => h.replace('#', '')),
        mentions.map((m: string) => m.replace('@', '')),
        (progress: number) => {
          syncReelProgress(progress);
          const rounded = Math.round(progress);
          if (rounded === lastGridProgressRef.current && rounded < 100) return;
          lastGridProgressRef.current = rounded;
          addVideo({
            ...tempVideo,
            uploadProgress: progress,
            isUploading: true,
          });
        },
        {
          mimeType: (newVideo as { mimeType?: string }).mimeType,
          fileName: (newVideo as { fileName?: string }).fileName,
        },
      );

      if (uploadResult.success) {
        // UX Fix 4: Start polling for Mux processing status
        const reelId = (uploadResult as any)?.reelId || (uploadResult as any)?.data?.reelId;
        if (reelId) {
          setPollingReelId(reelId);
        }

        setVideoUploadMessage(t.profile.uploadSuccessPhase);
        setVideoUploadProgress(100);
        setReelUploadUi({ active: true, progress: 100, phaseLabel: t.profile.uploadSuccessPhase });
        await reelUploadNotification.success(undefined, getToken);
        void syncExpoPushToken(getToken);

        await new Promise(resolve => setTimeout(resolve, 1000));

        removeVideo(newVideo.id);
        setIsVideoUploading(false);
        toastManager.showUploadSuccess('video');

        // Invalidate reels feed cache immediately so new reel appears
        await cacheService.invalidate(CACHE_KEYS.REELS_FEED).catch(() => {});

        await refreshCache(true);
        if (userData?.username) {
          await loadVideos(userData.username, true);
        }
      } else {
        removeVideo(newVideo.id);
        setIsVideoUploading(false);
        const errMsg = uploadResult.error || '';
        await reelUploadNotification.failure(
          errMsg || t.profile.videoUploadFailedMessage
        );
        if (isReelUploadConflictError(errMsg) || isCooldownApiError((uploadResult as { data?: unknown }).data)) {
          toastManager.showWarning(t.profile.waitABit, errMsg || t.profile.cooldownActive);
        } else {
          toastManager.showError(t.profile.uploadFailedTitle, errMsg || t.profile.videoUploadFailedMessage);
        }
      }
    } catch (error: any) {
      logger.error('Video upload error:', error);
      removeVideo(newVideo.id);
      setIsVideoUploading(false);
      const msg = error.message || t.profile.videoUploadError;
      await reelUploadNotification.failure(msg);
      toastManager.showError(t.common.error, msg);
    }
    } finally {
      reelUploadInFlightRef.current = false;
      resetReelUploadUi();
      void reelUploadNotification.clear();
      deactivateKeepAwake('reel-upload');
    }
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    try {
      toastManager.showInfo(t.profile.updating, t.profile.refreshingProfileData);
      
      await refreshCache(true);
      await refreshProfilePredictions(true);
      
      toastManager.showSuccess(t.profile.updated, t.profile.profileDataRefreshed);
    } catch (error) {
      logger.error('Refresh error:', error);
      toastManager.showError(t.profile.refreshFailedTitle, t.profile.refreshFailedMessage);
    }
  };

  // Optimization: Memoize simple handlers
  const handleEditProfile = useCallback(() => {
    setIsEditProfileModalVisible(true);
  }, []);

  const handleUploadPress = useCallback(() => {
    if (reelUploadUi.active) {
      toastManager.showWarning(t.profile.uploading, reelUploadUi.phaseLabel || t.profile.uploadAlreadyInProgress);
      return;
    }
    setIsUploadModalVisible(true);
  }, [reelUploadUi.active, reelUploadUi.phaseLabel, t.profile.uploading, t.profile.uploadAlreadyInProgress]);

  const handleSharePress = useCallback(async () => {
    try {
      const profileUrl = buildProfileShareUrl(userData?.username || '');
      await Share.share({
        message: `${t.profile.checkMyProfile} @${userData?.username}\n${profileUrl}`,
        url: profileUrl,
      });
      toastManager.showSuccess(t.profile.shared, t.profile.profileSharedSuccess);
    } catch (error) {
      logger.warn('Share error:', error);
      toastManager.showError(t.profile.shareFailedTitle, t.profile.profileShareFailed);
    }
  }, [userData?.username, t.profile.checkMyProfile, t.profile.shared, t.profile.profileSharedSuccess, t.profile.shareFailedTitle, t.profile.profileShareFailed]);

  const handleQRPress = useCallback(() => setIsQRModalVisible(true), []);

  const handleFollowersPress = useCallback(() => {
    setFollowersModalTab('followers');
    setIsFollowersModalVisible(true);
  }, []);

  const handleFollowingPress = useCallback(() => {
    setFollowersModalTab('following');
    setIsFollowersModalVisible(true);
  }, []);

  const handleVideoPress = useCallback((video: { id: string; videoUrl?: string; uri?: string; views?: string | number; likes?: number; saved?: boolean; shares?: number }, _index: number) => {
    const src = video.videoUrl || video.uri || '';
    if (src && typeof src === 'string' && src.length > 0) {
      setSelectedVideoUrl(src);
      setSelectedReelId(video.id);
      const viewsRaw = video.views;
      setSelectedReelSocial({
        liked: likedReelIdsSet.has(video.id),
        likes: Number(video.likes) || 0,
        saved: !!video.saved,
        shares: Number(video.shares) || 0,
        views:
          typeof viewsRaw === 'number'
            ? viewsRaw
            : parseInt(String(viewsRaw ?? '0').replace(/,/g, ''), 10) || 0,
      });
      setIsVideoPlayerVisible(true);
    } else {
      toastManager.showWarning(t.profile.videoNotReadyTitle, t.profile.videoNotReadyMessage);
    }
  }, [likedReelIdsSet, t.profile.videoNotReadyTitle, t.profile.videoNotReadyMessage]);

  const handleVideoLongPress = useCallback(() => {
    setIsDeleteMode((prev) => !prev);
  }, []);

  const handleDeleteVideo = useCallback((videoId: string) => {
    removeVideo(videoId);
    toastManager.showDeleteSuccess('video');
  }, [removeVideo]);

  // CRITICAL: Compute social links BEFORE early returns to avoid hooks count mismatch
  const socialLinks = useMemo(() => {
    if (userData?.socialLinks && Array.isArray(userData.socialLinks) && userData.socialLinks.length > 0) {
      return userData.socialLinks.map((link: any) => ({
        platform: link.platform || 'website',
        url: link.url || '',
        username: link.username,
      })).filter((link: any) => link.url && link.url.trim() !== '');
    }

    if (userData?.socials && typeof userData.socials === 'object') {
      const links: Array<{ platform: string; url: string; username?: string }> = [];
      if (userData.socials.instagram) {
        links.push({
          platform: 'instagram',
          url: userData.socials.instagram.startsWith('http')
            ? userData.socials.instagram
            : `https://instagram.com/${userData.socials.instagram.replace('@', '')}`,
          username: userData.socials.instagram.replace('@', ''),
        });
      }
      if (userData.socials.twitter) {
        links.push({
          platform: 'twitter',
          url: userData.socials.twitter.startsWith('http')
            ? userData.socials.twitter
            : `https://twitter.com/${userData.socials.twitter.replace('@', '')}`,
          username: userData.socials.twitter.replace('@', ''),
        });
      }
      if (userData.socials.facebook) {
        links.push({
          platform: 'facebook',
          url: userData.socials.facebook.startsWith('http')
            ? userData.socials.facebook
            : `https://facebook.com/${userData.socials.facebook.replace('@', '')}`,
          username: userData.socials.facebook.replace('@', ''),
        });
      }
      return links;
    }

    return [];
  }, [userData?.socialLinks, userData?.socials]);

  // Prevent guest access - redirect to auth
  if (!isSignedIn) {
    return null;
  }

  // Loading state - show skeleton when loading and no cache
  if ((isLoading || !userData) && !cacheError) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />
        <ProfileSkeleton />
      </View>
    );
  }

  // CRITICAL FIX: Show error state ONLY if no data at all (not even stale cache)
  // If we have cacheError but userData exists (stale), show the profile normally
  if (!userData && cacheError && !isLoading) {
    const isAutoRetrying = retryCountdown !== null && autoRetryCountRef.current < MAX_AUTO_RETRIES;
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />
        <Ionicons name="alert-circle-outline" size={64} color={ProfileTheme.colors.textSecondary} />
        <Text style={[styles.loadingText, { marginTop: 16, textAlign: 'center', paddingHorizontal: 40 }]}>
          {t.profile.profileLoadFailed}
        </Text>
        <Text style={[styles.loadingText, { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40, color: 'rgba(255,255,255,0.5)' }]}>
          {isGatewayOrServerError(cacheError) ? t.profile.serverDown : t.profile.checkConnection}
        </Text>
        {isAutoRetrying && (
          <Text style={[styles.loadingText, { fontSize: 13, marginTop: 12, textAlign: 'center', color: ProfileTheme.colors.neonGreen }]}>
            {`${t.profile.retryIn} ${retryCountdown}s...`}
          </Text>
        )}
        <View style={{ marginTop: 24, paddingHorizontal: 40, width: '100%', flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
          <TouchableOpacity 
            style={{
              backgroundColor: ProfileTheme.colors.neonGreen,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 24,
              minWidth: 120,
              alignItems: 'center'
            }}
            onPress={async () => {
              logger.debug('[ProfileScreen] Manual retry triggered');
              autoRetryCountRef.current = 0; // Reset counter on manual retry
              try {
                await refreshCache(true);
                toastManager.showInfo(t.profile.updating, t.profile.reloadingData);
              } catch (err) {
                logger.error('[ProfileScreen] Manual retry failed:', err);
                toastManager.showError(t.profile.refreshFailedTitle, t.profile.retryFailed);
              }
            }}
          >
            <Text style={{ color: ProfileTheme.colors.deepBlack, fontWeight: 'bold', fontSize: 16 }}>
              {t.profile.retryButton}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 24,
              minWidth: 120,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }}
            onPress={() => {
              logger.debug('[ProfileScreen] Navigating to auth');
              router.replace('/auth');
            }}
          >
            <Text style={{ color: ProfileTheme.colors.textPrimary, fontWeight: 'bold', fontSize: 16 }}>
              {t.profile.logoutButton}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // If no userData after loading, show skeleton (will retry)
  if (!userData) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />
        <ProfileSkeleton />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />

      {/* Offline Banner */}
      {isOffline && (
        <View style={{ backgroundColor: '#FF4444', paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
            {t.matches.networkOffline}
          </Text>
        </View>
      )}

      {/* Fixed top bar — 90PLUS brand + LVL badge + purple coin badge */}
      <ProfileTopBar topInset={insets.top} level={userData?.level ?? undefined} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={ProfileTheme.colors.neonGreen}
            colors={[ProfileTheme.colors.neonGreen]}
            progressBackgroundColor={ProfileTheme.colors.deepBlack}
          />
        }
      >
        <ProfileHeader
          coverImage={coverImage ? { uri: coverImage } : undefined}
          onPress={handleCoverPress}
        />

        {/* Profile FIFA Card Frame */}
        <View style={[styles.profileCardContainer, { marginTop: cardOverlap }]}>
          <ProfileCard
            playerImage={localImage ? { uri: localImage } : (userData?.avatar ? { uri: userData.avatar } : undefined)}
            cardType="gold"
            scale={0.60}
            onImageUpload={handleImageUpload}
            uploadedImage={localImage || userData?.avatar || null}
            countryFlag={displayCountryFlag}
            onCountryPress={() => setIsCountryModalVisible(true)}
            position={displayPosition}
            onPositionPress={() => setIsPositionModalVisible(true)}
            age={displayStats.age}
            height={displayStats.height}
            weight={displayStats.weight}
            foot={displayStats.foot}
            onStatsPress={() => setIsStatsModalVisible(true)}
            clubLogo={displayClubLogo}
            onClubPress={() => setIsClubModalVisible(true)}
            isAvatarUploading={isAvatarUploading}
            isCountryUpdating={isCountryUpdating}
            isClubUpdating={isClubUpdating}
            isStatsUpdating={isStatsUpdating}
          />
        </View>

        <UserInfo
          name={userData?.displayName || userData?.username || 'User'}
          username={userData?.username || 'user'}
          bio={userData?.bio}
          location={displayLocation}
          countryFlag={displayCountryFlag}
          team={userData?.favoriteTeam || ''}
          isVerified={userData?.isVerified || false}
          isDeveloper={userData?.isDeveloper || false}
          onBioLongPress={() => setIsEditProfileModalVisible(true)}
          onNameLongPress={() => setIsEditProfileModalVisible(true)}
          clubLogo={displayClubLogo}
          onEditPress={handleEditProfile}
          socials={userData?.socials}
          consecutiveLoginDays={Math.max(userData?.consecutiveLoginDays || 0, loginStreak.current)}
        />

        {loginStreak.current >= 10 && (
          <View style={styles.streakMasterRow}>
            <Flame size={16} color="#FF8C42" fill="#FF6B35" strokeWidth={2} />
            <Text style={styles.streakMasterText}>
              {t.profile.streakMaster.replace('{count}', String(loginStreak.current))}
            </Text>
          </View>
        )}

        {/* Profile Completion — compact liquid glass pill */}
        {completionStatus && completionStatus.percentage < 100 && (() => {
          const GlassCompletion = isLiquidGlassSupported ? LiquidGlassView : BlurView;
          const glassP = isLiquidGlassSupported
            ? { effect: 'clear' as const, interactive: true }
            : { intensity: 22, tint: 'dark' as const };
          const pct = completionStatus.percentage;
          return (
            <View style={completionStyles.wrapper}>
              <TouchableOpacity
                style={completionStyles.pill}
                activeOpacity={0.82}
                onPress={() => setIsCompletionDetailVisible(true)}
              >
                <GlassCompletion {...(glassP as any)} style={StyleSheet.absoluteFill} />
                {/* Purple-to-cyan tint */}
                <LinearGradient
                  colors={['rgba(124,58,237,0.18)', 'rgba(0,217,255,0.08)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />

                {/* Left: icon + label */}
                <View style={completionStyles.left}>
                  <View style={completionStyles.iconDot}>
                    <Ionicons name="checkmark-done" size={12} color="#A855F7" />
                  </View>
                  <Text style={completionStyles.label}>{t.profile.completeYourProfile}</Text>
                </View>

                {/* Right: progress bar + percentage */}
                <View style={completionStyles.right}>
                  <View style={completionStyles.barBg}>
                    <View style={[completionStyles.barFill, { width: `${pct}%` as any }]} />
                  </View>
                  <Text style={completionStyles.pct}>{pct}%</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Social Links Section */}
        <SocialLinksSection
          links={socialLinks}
          isOwnProfile={true}
          onEditPress={handleEditProfile}
        />

        {/* Badges need backend user UUID; Clerk-only fallback uses user_* id */}
        {userData?.id && !String(userData.id).startsWith('user_') && (
          <View style={styles.badgesContainer}>
            <BadgesDisplay
              userId={userData.id}
              token={authToken}
              compact={true}
            />
          </View>
        )}

        <ActionButtons
          onEditPress={handleUploadPress}
          onSharePress={handleSharePress}
          onQRPress={handleQRPress}
          uploadCooldown={cooldowns?.reelUpload}
          reelUploadActive={reelUploadUi.active}
          reelUploadProgress={reelUploadUi.progress}
        />

        <StatsRow
          followers={followStats.followersCount.toString()}
          following={followStats.followingCount.toString()}
          videos={(followStats.reelsCount || myVideos.length).toString()}
          onFollowersPress={handleFollowersPress}
          onFollowingPress={handleFollowingPress}
        />

        <ContentTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          videoCount={myVideos.length}
          savedCount={followStats.savedReelsCount ?? 0}
          isOwnProfile={true}
        />

        {activeTab === 'videos' && (
          <VideoGrid
            videos={myVideos}
            onVideoPress={handleVideoPress}
            onVideoLongPress={handleVideoLongPress}
            onDeleteVideo={handleDeleteVideo}
            isDeleteMode={isDeleteMode}
          />
        )}

        {activeTab === 'saved' && (
          <ProfileSavedGrid
            getToken={getToken}
            onCountChange={(count) => {
              updateCachedFollowStats({ ...followStats, savedReelsCount: count });
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <ProfileAnalyticsTab
            analytics={analytics}
            predictionStats={predictionStats}
            predictions={allPredictions}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* UX Fix 1+2: Image preview modal + Android action sheet */}
      <ImagePreviewModal
        visible={isPreviewVisible}
        imageUri={previewUri}
        type={previewType}
        isUploading={previewType === 'avatar' ? isAvatarUploading : isCoverUploading}
        uploadProgress={previewType === 'avatar' ? avatarUploadProgress : 0}
        onConfirm={() => {
          setIsPreviewVisible(false);
          if (pendingUploadFn) pendingUploadFn();
        }}
        onCancel={() => {
          setIsPreviewVisible(false);
          setPreviewUri(null);
          setPendingUploadFn(null);
        }}
      />

      <AndroidImageSourceSheet
        visible={androidSheetVisible}
        options={androidSheetOptions}
        onClose={() => setAndroidSheetVisible(false)}
      />

      {/* UX Fix 3: Cooldown block modal */}
      <CooldownBlockModal
        visible={cooldownBlockVisible}
        cooldown={
          cooldownBlockType === 'avatar' ? cooldowns?.avatar ?? null
          : cooldownBlockType === 'cover' ? cooldowns?.cover ?? null
          : cooldowns?.reelUpload ?? null
        }
        type={cooldownBlockType}
        onClose={handleCooldownBlockClose}
      />

      {/* Modals */}
      <CountryPickerModal
        visible={isCountryModalVisible}
        onClose={() => setIsCountryModalVisible(false)}
        onSelect={async (country) => {
          setIsCountryModalVisible(false);

          // Snapshot the current values so we can fully roll back (UI + cache +
          // local storage) if the server rejects or the request throws.
          const prevFlag = userData?.countryFlag ?? null;
          const prevCountry = userData?.country ?? null;
          const prevLocation = userData?.location ?? null;

          const rollback = async () => {
            updateCachedUserData({
              countryFlag: prevFlag,
              country: prevCountry,
              location: prevLocation,
            });
            await localProfileStorage
              .saveProfileData({
                countryFlag: prevFlag ?? undefined,
                country: prevCountry ?? undefined,
              })
              .catch(() => {});
          };

          setIsCountryUpdating(true);
          try {
            await localProfileStorage.saveProfileData({
              countryFlag: country.flag,
              country: country.nameAr,
            });

            updateCachedUserData({
              countryFlag: country.flag,
              country: country.nameAr,
              location: country.nameAr,
            });

            toastManager.showInfo(
              t.profile.updating,
              t.profile.updatingCountry.replace('{country}', country.nameAr),
            );

            const result = await updateFIFACard({
              countryFlag: country.flag,
              country: country.nameAr,
            });

            if (result?.success) {
              toastManager.showSuccess(
                t.profile.updated,
                t.profile.countryUpdatedSuccess.replace('{country}', country.nameAr),
              );
              await markStepCompleted('country');
            } else {
              // Server did not confirm — revert so UI never shows an unsaved flag.
              await rollback();
              toastManager.showError(
                t.common.error,
                'تعذر تحديث العلم. حاول مرة أخرى.',
              );
            }
          } catch {
            await rollback();
            toastManager.showError(
              t.common.error,
              'تعذر تحديث العلم. حاول مرة أخرى.',
            );
          } finally {
            setIsCountryUpdating(false);
          }
        }}
        selectedCountryId={displayCountryFlag}
      />

      <PositionPickerModal
        visible={isPositionModalVisible}
        onClose={() => setIsPositionModalVisible(false)}
        onSelect={async (pos) => {
          setIsPositionModalVisible(false);

          const prevPosition = userData?.position ?? null;
          const rollback = async () => {
            updateCachedUserData({ position: prevPosition ?? undefined });
            await localProfileStorage
              .saveProfileData({ position: prevPosition ?? undefined })
              .catch(() => {});
            if (globalState.userProfile) {
              globalState.setUserProfile({
                ...globalState.userProfile,
                position: prevPosition ?? undefined,
              });
            }
          };

          try {
            await localProfileStorage.saveProfileData({ position: pos });
            updateCachedUserData({ position: pos });

            toastManager.showInfo(t.profile.updating, t.profile.updatingPosition.replace('{position}', pos));

            const result = await updateFIFACard({ position: pos });

            if (result?.success) {
              toastManager.showSuccess(t.profile.updated, t.profile.positionUpdatedSuccess.replace('{position}', pos));
              await markStepCompleted('position');
            } else {
              await rollback();
              toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
            }
          } catch {
            await rollback();
            toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
          }
        }}
        selectedPosition={displayPosition}
      />

      <ClubPickerModal
        visible={isClubModalVisible}
        onClose={() => setIsClubModalVisible(false)}
        onSelect={async (selectedClub) => {
          const clubDisplayName =
            language === 'ar'
              ? selectedClub.nameAr || selectedClub.name
              : selectedClub.name || selectedClub.nameAr;
          logger.debug('[ClubPicker] Selected club:', clubDisplayName);

          const prevClubLogo = userData?.clubLogo ?? null;
          const prevFavoriteTeam = userData?.favoriteTeam ?? null;

          const rollback = async () => {
            updateCachedUserData({
              clubLogo: prevClubLogo ?? undefined,
              favoriteTeam: prevFavoriteTeam ?? undefined,
            });
            await localProfileStorage
              .saveProfileData({
                clubLogo: prevClubLogo ?? undefined,
                favoriteTeam: prevFavoriteTeam ?? undefined,
              })
              .catch(() => {});
            if (globalState.userProfile) {
              globalState.setUserProfile({
                ...globalState.userProfile,
                clubLogo: prevClubLogo ?? undefined,
                favoriteTeam: prevFavoriteTeam ?? undefined,
              });
            }
          };

          setIsClubModalVisible(false);

          try {
            await localProfileStorage.saveProfileData({
              clubLogo: selectedClub.logo,
              favoriteTeam: clubDisplayName,
            });

            updateCachedUserData({
              clubLogo: selectedClub.logo,
              favoriteTeam: clubDisplayName,
            });

            if (globalState.userProfile) {
              globalState.setUserProfile({
                ...globalState.userProfile,
                clubLogo: selectedClub.logo,
                favoriteTeam: clubDisplayName,
              });
            }

            toastManager.showInfo(
              t.profile.updating,
              t.profile.updatingClub.replace('{club}', clubDisplayName),
            );

            const result = await updateFavorites({
              favoriteClub: clubDisplayName,
              favoriteTeam: clubDisplayName,
              clubLogo: selectedClub.logo,
            });

            if (result?.success) {
              toastManager.showSuccess(
                t.profile.updated,
                t.profile.clubUpdatedSuccess.replace('{club}', clubDisplayName),
              );
              await markStepCompleted('club');
            } else {
              await rollback();
              toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
            }
          } catch {
            await rollback();
            toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
          }
        }}
      />

      <StatsEditModal
        visible={isStatsModalVisible}
        onClose={() => setIsStatsModalVisible(false)}
        onSave={async (newStats) => {
          setIsStatsModalVisible(false);

          toastManager.showInfo(t.profile.updating, t.profile.updatingPlayerStats);

          const ageNum = parseInt(newStats.age);
          const heightNum = parseInt(newStats.height);
          const weightNum = parseInt(newStats.weight);
          const preferredFoot = newStats.foot || undefined;

          const prevAge = userData?.age;
          const prevHeight = userData?.height;
          const prevWeight = userData?.weight;
          const prevFoot = userData?.preferredFoot;

          const rollback = async () => {
            updateCachedUserData({
              age: prevAge,
              height: prevHeight,
              weight: prevWeight,
              preferredFoot: prevFoot,
            });
            await localProfileStorage
              .saveProfileData({
                age: prevAge,
                height: prevHeight,
                weight: prevWeight,
                preferredFoot: prevFoot,
              })
              .catch(() => {});
          };

          try {
            await localProfileStorage.saveProfileData({
              age: Number.isFinite(ageNum) ? ageNum : undefined,
              height: Number.isFinite(heightNum) ? heightNum : undefined,
              weight: Number.isFinite(weightNum) ? weightNum : undefined,
              preferredFoot,
            });

            updateCachedUserData({
              age: Number.isFinite(ageNum) ? ageNum : undefined,
              height: Number.isFinite(heightNum) ? heightNum : undefined,
              weight: Number.isFinite(weightNum) ? weightNum : undefined,
              preferredFoot,
            });

            const result = await updateFIFACard({
              age: Number.isFinite(ageNum) ? ageNum : undefined,
              height: Number.isFinite(heightNum) ? heightNum : undefined,
              weight: Number.isFinite(weightNum) ? weightNum : undefined,
              preferredFoot,
            });

            if (result?.success) {
              toastManager.showSuccess(t.profile.updated, t.profile.playerStatsUpdatedSuccess);
              await markStepCompleted('cardData');
            } else {
              await rollback();
              toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
            }
          } catch {
            await rollback();
            toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
          }
        }}
        initialStats={displayStats}
      />

      <ProfileEditModal
        visible={isEditProfileModalVisible}
        onClose={() => setIsEditProfileModalVisible(false)}
        initialData={{
          name: userData?.displayName || userData?.username || 'User',
          username: userData?.username || 'user',
          bio: userData?.bio || '',
          socials: socialLinks as any,
          lastUsernameChange: userData?.lastUsernameChange || undefined
        }}
        onSave={async (newData) => {
          // Close modal immediately
          setIsEditProfileModalVisible(false);
          
          // Prepare updates object
          const updates: any = {};
          
          const currentName = userData?.displayName || userData?.username || 'User';
          const currentUsername = userData?.username || 'user';
          const currentBio = userData?.bio || '';

          if (newData.name !== currentName) {
            updates.displayName = newData.name;
          }
          
          if (newData.username !== currentUsername) {
            updates.username = newData.username;
          }
          
          if (newData.bio !== currentBio) {
            updates.bio = newData.bio;
          }
          
          // Handle social links (including clearing all links)
          const normalizeLinks = (links: Array<any>) =>
            links
              .filter((social: any) => social?.platform && social?.url)
              .map((social: any) => ({
                platform: String(social.platform).toLowerCase(),
                url: String(social.url).trim(),
              }))
              .sort((a: any, b: any) => a.platform.localeCompare(b.platform));

          const incomingSocialLinks = normalizeLinks(newData.socials || []);
          const currentSocialLinks = normalizeLinks((socialLinks as any[]) || []);
          if (JSON.stringify(incomingSocialLinks) !== JSON.stringify(currentSocialLinks)) {
            updates.socialLinks = incomingSocialLinks;
          }
          
          // Send updates if there are any changes
          if (Object.keys(updates).length > 0) {
            profileSaveInFlightRef.current = true;
            toastManager.showInfo(t.profile.updating, t.profile.savingProfileChanges);
            
            try {
            if (updates.username) {
              const result = await updateUsername(updates.username);
              if (result.success) {
                updateCachedUserData({ username: updates.username });
                if (globalState.userProfile) {
                  globalState.setUserProfile({
                    ...globalState.userProfile,
                    username: updates.username,
                  });
                }
                toastManager.showSuccess(t.profile.updated, t.profile.usernameUpdatedTo.replace('{username}', `@${updates.username}`));
              } else {
                updateCachedUserData({ username: currentUsername });
                if (globalState.userProfile) {
                  globalState.setUserProfile({
                    ...globalState.userProfile,
                    username: currentUsername,
                  });
                }
              }
              delete updates.username;
            }

            if (updates.displayName) {
              const result = await updateDisplayName(updates.displayName);
              if (result.success) {
                updateCachedUserData({ displayName: updates.displayName });
                if (globalState.userProfile) {
                  globalState.setUserProfile({
                    ...globalState.userProfile,
                    displayName: updates.displayName,
                  });
                }
                toastManager.showSuccess(t.profile.updated, t.profile.nameUpdatedTo.replace('{name}', updates.displayName));
              } else {
                updateCachedUserData({ displayName: currentName });
                if (globalState.userProfile) {
                  globalState.setUserProfile({
                    ...globalState.userProfile,
                    displayName: currentName,
                  });
                }
              }
              delete updates.displayName;
            }
            
            if (Object.prototype.hasOwnProperty.call(updates, 'bio')) {
              const previousBio = userData?.bio || '';
              updateCachedUserData({ bio: updates.bio });
              const result = await updateBio(updates.bio);
              if (result.success) {
                toastManager.showSuccess(t.profile.updated, t.profile.bioUpdatedSuccess);
                await markStepCompleted('bio');
              } else {
                updateCachedUserData({ bio: previousBio });
                toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
              }
              delete updates.bio;
            }
            
            if (Object.prototype.hasOwnProperty.call(updates, 'socialLinks')) {
              const previousSocialLinks = (socialLinks as any[]) || [];
              const newSocialLinks = (updates.socialLinks as Array<{ platform: string; url: string }>).map((link) => ({
                platform: link.platform,
                url: link.url,
                username: typeof link.url === 'string' ? link.url.replace(/.*\//, '').replace('@', '') : undefined
              }));
              
              updateCachedUserData({ socialLinks: newSocialLinks });
              
              if (globalState.userProfile) {
                globalState.setUserProfile({
                  ...globalState.userProfile,
                  socialLinks: newSocialLinks
                });
              }
              
              const result = await updateSocialLinks(newSocialLinks);
              if (result.success) {
                toastManager.showSuccess(t.profile.updated, t.profile.socialLinksUpdatedSuccess);
                await markStepCompleted('socialLinks');
              } else {
                updateCachedUserData({ socialLinks: previousSocialLinks });
                if (globalState.userProfile) {
                  globalState.setUserProfile({
                    ...globalState.userProfile,
                    socialLinks: previousSocialLinks
                  });
                }
                toastManager.showError(t.profile.updated, t.profile.profileSaveFailed);
              }
            }
            } finally {
              profileSaveInFlightRef.current = false;
            }
          } else {
            toastManager.showInfo(t.profile.noChanges, t.profile.noProfileChanges);
          }
        }}
        usernameCooldown={cooldowns?.username}
      />

      <ReelUploadModal
        visible={isUploadModalVisible}
        onClose={() => setIsUploadModalVisible(false)}
        onPickerOpen={() => { isPickerActiveRef.current = true; }}
        onPickerClose={() => { isPickerActiveRef.current = false; }}
        uploadLocked={reelUploadUi.active}
        onUpload={(newVideo) => {
          setIsUploadModalVisible(false);
          handleUploadVideo(newVideo);
        }}
        canUploadVideo={true}
        missingRequiredSteps={[]}
      />

      <VideoPlayerModal
        visible={isVideoPlayerVisible}
        videoUrl={selectedVideoUrl}
        onClose={() => {
          setIsVideoPlayerVisible(false);
          setSelectedReelId(null);
        }}
        userImage={localImage}
        username={userData?.username || 'user'}
        reelId={selectedReelId}
        initialLiked={selectedReelSocial.liked}
        initialLikes={selectedReelSocial.likes}
        initialSaved={selectedReelSocial.saved}
        initialShares={selectedReelSocial.shares}
        initialViews={selectedReelSocial.views}
        comments={reelComments[selectedReelId || ''] || []}
        onAddComment={(comment: Comment) => {
          if (selectedReelId) addComment(selectedReelId, comment);
        }}
        onToggleLike={(commentId: string) => {
          if (selectedReelId) toggleCommentLike(selectedReelId, commentId);
        }}
      />

      {/* Upload Progress Modal for Video */}
      <UploadProgressModal
        visible={isVideoUploading}
        progress={videoUploadProgress}
        message={videoUploadMessage}
      />
      
      {/* Upload Progress Modal for Image (Avatar/Cover) */}
      <UploadProgressModal
        visible={isImageUploading}
        progress={imageUploadProgress}
        message={imageUploadMessage}
      />

      <ImageViewerModal
        visible={isImageViewerVisible}
        imageUrl={coverImage || 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=2070&auto=format&fit=crop'}
        onClose={() => setIsImageViewerVisible(false)}
      />

      <FollowersListModal
        visible={isFollowersModalVisible}
        onClose={() => setIsFollowersModalVisible(false)}
        userId={userData?.id || ''}
        initialTab={followersModalTab}
        username={userData?.username}
      />

      <QRCodeModal
        visible={isQRModalVisible}
        onClose={() => setIsQRModalVisible(false)}
        username={userData?.username || 'user'}
        displayName={userData?.displayName || undefined}
        avatar={localImage || userData?.avatar || undefined}
      />

      {/* ── Profile Completion Detail Modal — full-screen blur ──── */}
      {isCompletionDetailVisible && completionStatus && (() => {
        const pct = completionStatus.percentage;
        const allSteps = completionStatus.steps ?? [];
        return (
          <Modal
            visible={isCompletionDetailVisible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setIsCompletionDetailVisible(false)}
          >
            {/* Full-screen blur backdrop */}
            <BlurView intensity={55} tint="dark" style={{ flex: 1 }}>
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,1,13,0.45)' }}>

                {/* Sheet */}
                <View style={{
                  backgroundColor: 'rgba(10,4,22,0.97)',
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  paddingTop: 0,
                  paddingHorizontal: 24,
                  paddingBottom: insets.bottom + 24,
                  maxHeight: '88%',
                  borderTopWidth: 1,
                  borderColor: 'rgba(168,85,247,0.25)',
                  overflow: 'hidden',
                }}>
                  {/* Purple top accent line */}
                  <LinearGradient
                    colors={['#A855F7', '#7C3AED', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
                  />

                  {/* Drag handle */}
                  <View style={{ alignItems: 'center', paddingTop: 14, marginBottom: 20 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(168,85,247,0.4)' }} />
                  </View>

                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <View>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.2 }}>
                        {t.profile.completeYourProfile}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 }}>
                        {`${completionStatus.completedSteps} ${t.profile.of} ${completionStatus.totalSteps} ${t.profile.stepsCompleted}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsCompletionDetailVisible(false)}
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <Ionicons name="close" size={17} color="rgba(255,255,255,0.75)" />
                    </TouchableOpacity>
                  </View>

                  {/* Big percentage + progress bar */}
                  <View style={{ alignItems: 'center', marginBottom: 28 }}>
                    <Text style={{ color: '#A855F7', fontSize: 56, fontWeight: '900', letterSpacing: -3, lineHeight: 60 }}>{pct}%</Text>
                    <View style={{ width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, marginTop: 16, overflow: 'hidden' }}>
                      <LinearGradient
                        colors={['#A855F7', '#7C3AED', '#4F46E5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ height: '100%', width: `${pct}%`, borderRadius: 4 }}
                      />
                    </View>
                  </View>

                  {/* All steps list */}
                  <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    {allSteps.map((step, i) => (
                      <View
                        key={step.id ?? i}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 13,
                          paddingHorizontal: 16,
                          marginBottom: 8,
                          borderRadius: 16,
                          backgroundColor: step.completed
                            ? 'rgba(168,85,247,0.1)'
                            : 'rgba(255,255,255,0.04)',
                          borderWidth: 1,
                          borderColor: step.completed
                            ? 'rgba(168,85,247,0.3)'
                            : 'rgba(255,255,255,0.07)',
                        }}
                      >
                        {/* Status icon */}
                        <View style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: step.completed
                            ? 'rgba(168,85,247,0.25)'
                            : 'rgba(255,255,255,0.06)',
                          marginRight: 14,
                          borderWidth: 1,
                          borderColor: step.completed
                            ? 'rgba(168,85,247,0.5)'
                            : 'rgba(255,255,255,0.1)',
                        }}>
                          <Ionicons
                            name={step.completed ? 'checkmark' : 'ellipse-outline'}
                            size={14}
                            color={step.completed ? '#A855F7' : 'rgba(255,255,255,0.3)'}
                          />
                        </View>

                        {/* Label */}
                        <Text style={{
                          flex: 1,
                          color: step.completed ? '#fff' : 'rgba(255,255,255,0.55)',
                          fontSize: 14,
                          fontWeight: step.completed ? '700' : '500',
                        }}
                        numberOfLines={1}
                        >
                          {getProfileCompletionStepLabel(step.id, language, step.label)}
                        </Text>

                        {/* Required badge */}
                        {step.required && !step.completed && (
                          <View style={{
                            backgroundColor: 'rgba(168,85,247,0.15)',
                            borderRadius: 8,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderWidth: 1,
                            borderColor: 'rgba(168,85,247,0.3)',
                          }}>
                            <Text style={{ color: '#A855F7', fontSize: 10, fontWeight: '700' }}>{t.profile.stepRequired}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>

                  {/* Close button */}
                  <TouchableOpacity onPress={() => setIsCompletionDetailVisible(false)} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#A855F7', '#7C3AED']}
                      style={{ height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{t.profile.okay}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
          </Modal>
        );
      })()}
    </View>
  );
}

// Wrap the profile screen in its dedicated error boundary so a render failure
// (e.g. while editing the flag/avatar) shows a recoverable fallback instead of
// a white screen, and trips the infinite-loop guard if a bad state recurs.
export default function ProfileScreenWithBoundary() {
  return (
    <ProfileErrorBoundary>
      <ProfileScreen />
    </ProfileErrorBoundary>
  );
}