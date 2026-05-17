import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Text, Share, Alert, ActionSheetIOS, Platform, RefreshControl, AppState, AppStateStatus, TouchableOpacity, Dimensions } from 'react-native';
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
import { DEFAULT_COUNTRY_FLAG, DEFAULT_POSITION, DEFAULT_STATS } from '../../constants/profileDefaults';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useVideos, Comment } from '../../contexts/VideosContext';
import { globalState } from '../../globalState';
import { AuthService, CardProfileService, ProfileService, ReelsService } from '../../src/services/authService';
import { StorageService } from '../../src/services/storageService';
import { useImageUpload } from '../../hooks/useImageUpload';
import { toastManager } from '../../services/toastManager';
import { reelUploadNotification } from '../../services/reelUploadNotification';
import { localProfileStorage } from '../../services/localProfileStorage';
import * as Haptics from 'expo-haptics';
import { useProfileCache, type ProfileUserData } from '../../hooks/useProfileCache';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import { useTranslation } from '../../src/i18n';
import BadgesDisplay from '../../components/profile/BadgesDisplay';
import LevelCard from '../../components/profile/LevelCard';
import { getApiUrl } from '../../config/api.config';
import { compressImage } from '@/utils/imageCompressor';
import { logger } from '../../utils/logger';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import CountryPickerModal from '../../components/common/CountryPickerModal';
import PositionPickerModal from '../../components/common/PositionPickerModal';
import ClubPickerModal from '../../components/common/ClubPickerModal';
import BrandPickerModal from '../../components/common/BrandPickerModal';
import StatsEditModal, { Stats } from '../../components/common/StatsEditModal';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';
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
import { useReelStatusPoller } from '../../hooks/useReelStatusPoller';
import { useScreenFont } from '../../utils/fontSetup';

const API_URL = getApiUrl();

/** Minimum gap between automatic profile API refreshes (tab focus / app resume) */
const PROFILE_UI_REFRESH_INTERVAL_MS = 120_000;

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

interface Brand {
  id: string;
  name: string;
  logo: string;
}

// Performance: Memoize expensive calculations outside component
const DEFAULT_FOLLOW_STATS = { followersCount: 0, followingCount: 0, reelsCount: 0 };
// Helper function to get step icons
const getStepIcon = (stepId: string): keyof typeof Ionicons.glyphMap => {
  switch (stepId) {
    case 'avatar': return 'person-circle-outline';
    case 'country': return 'globe-outline';
    case 'club': return 'football-outline';
    case 'bio': return 'document-text-outline';
    case 'position': return 'location-outline';
    case 'cardData': return 'card-outline';
    case 'brand': return 'shirt-outline';
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
  profileCardContainer: {
    alignItems: 'center',
    marginTop: -300,
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
});

export default function ProfileScreen() {
  useScreenFont();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('videos');
  const [isOffline, setIsOffline] = useState(false);
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  
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
    reelUploadUi,
    setReelUploadUi,
    resetReelUploadUi,
  } = useVideos();
  const { t } = useTranslation();

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
  const [isBrandModalVisible, setIsBrandModalVisible] = useState(false);
  const [isStatsModalVisible, setIsStatsModalVisible] = useState(false);
  const [isEditProfileModalVisible, setIsEditProfileModalVisible] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

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

  // UX Fix 4: Reel status polling
  const [pollingReelId, setPollingReelId] = useState<string | null>(null);
  const reelStatus = useReelStatusPoller(pollingReelId, getToken, !!pollingReelId);

  // Loading states for profile operations
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [isCountryUpdating, setIsCountryUpdating] = useState(false);
  const [isClubUpdating, setIsClubUpdating] = useState(false);
  const [isBrandUpdating, setIsBrandUpdating] = useState(false);
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
  const displayBrandLogo = userData?.brandLogo;
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
        const isProcessing = video.status === 'PROCESSING' || (!videoUrl && !video.isUploading);
        return {
          id: video.id,
          thumbnail: video.thumbnail || video.uri,
          videoUrl,
          views: video.views || '0',
          duration: video.duration || '',
          isUploading: video.isUploading || false,
          isProcessing,
          uploadProgress: video.uploadProgress,
        };
      })
      // Hide rows that have no video URL and are NOT currently uploading
      // or processing. PROCESSING reels (Mux still encoding) should appear
      // with a processing overlay so the user sees their upload immediately.
      .filter((v: any) => v.isUploading || v.isProcessing || v.videoUrl.length > 0);
  }, [cachedVideos, uploadedVideos]);
  
  const analytics = cachedAnalytics;
  const cooldowns = cachedCooldowns;

  // Predictions store for prediction stats
  const { stats: predictionStats, fetchPredictionStats } = usePredictionsStore();

  // Optimization: Fetch prediction stats when authenticated (with cleanup)
  useEffect(() => {
    let isMounted = true;
    const loadPredictionStats = async () => {
      try {
        const token = await getToken();
        if (isMounted && token) {
          await fetchPredictionStats(token);
        }
      } catch (error) {
        logger.error('Error loading prediction stats:', error);
      }
    };
    loadPredictionStats();
    return () => { isMounted = false; };
  }, []);
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
      userData.brandLogo ?? '',
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
        if (merged.brandLogo != null && merged.brandLogo !== userData.brandLogo) {
          patch.brandLogo = merged.brandLogo;
        }
        if (merged.favoriteBrand != null && merged.favoriteBrand !== userData.favoriteBrand) {
          patch.favoriteBrand = merged.favoriteBrand;
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
  const maybeRefreshProfile = useCallback((reason: 'focus' | 'app_active') => {
    const now = Date.now();
    if (isOffline) return;
    if (isLoading || isRefreshing) return;
    if (now - lastUiRefreshAtRef.current < PROFILE_UI_REFRESH_INTERVAL_MS) return;
    lastUiRefreshAtRef.current = now;
    logger.debug(`[ProfileScreen] Refresh triggered (${reason})`);
    refreshCacheRef.current(false);
  }, [isOffline, isLoading, isRefreshing]);

  // Refresh on focus - use cache hook's refresh
  useFocusEffect(
    useCallback(() => {
      maybeRefreshProfile('focus');
    }, [maybeRefreshProfile])
  );

  // Auto-refresh when app returns from background
  const appStateRef = useRef(AppState.currentState);
  // ✅ FIX: Prevent refresh when image/video picker is open
  const isPickerActiveRef = useRef(false);
  const reelUploadInFlightRef = useRef(false);
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

    // UX Fix 6: Check permission FIRST, then show toast
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toastManager.showWarning(t.profile.permissionRequired, t.profile.coverPermissionRequired);
      return;
    }

    // UX Fix 2: Cross-platform action sheet
    showImageSourceSheet(
      {
        title: 'صورة الغلاف',
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
    setImageUploadMessage(t.profile.uploading || 'جاري رفع الصورة...');
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
        if (errorMessage.includes('يمكنك تغيير') || errorMessage.includes('يوم') || errorMessage.includes('ساعة')) {
          toastManager.showWarning(t.profile.waitABit, errorMessage);
        } else {
          toastManager.showUploadError('image');
        }
      }
    } catch (err: any) {
      logger.error('Cover upload exception:', err);
      setCoverImage(originalCover || null);
      toastManager.showError(t.common.error, t.profile.coverUploadFailed || 'فشل رفع صورة الغلاف');
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
        title: 'صورة البروفايل',
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
        toastManager.showSuccess('تم', 'تم إزالة صورة البروفايل');
      } else {
        toastManager.showError(t.common.error, json.message || 'فشل إزالة الصورة');
      }
    } catch (err: any) {
      logger.error('Remove avatar error:', err);
      toastManager.showError(t.common.error, 'فشل إزالة الصورة. تحقق من اتصالك بالإنترنت.');
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const _pickAvatarFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toastManager.showWarning(t.profile.permissionRequired, t.profile.avatarPermissionRequired);
      return;
    }
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
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toastManager.showWarning(t.profile.permissionRequired, t.profile.avatarPermissionRequired);
      return;
    }
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
    setImageUploadMessage(t.profile.uploading || 'جاري رفع الصورة...');
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
        toastManager.showUploadSuccess('image');
      } else {
        setLocalImage(originalAvatar || null);
        const errorMessage = uploadResult.error || t.profile.avatarUploadFailed;
        if (errorMessage.includes('يمكنك تغيير') || errorMessage.includes('يوم') || errorMessage.includes('ساعة')) {
          toastManager.showWarning(t.profile.waitABit, errorMessage);
        } else {
          toastManager.showUploadError('image');
        }
      }
    } catch (err: any) {
      logger.error('Avatar upload exception:', err);
      setLocalImage(originalAvatar || null);
      toastManager.showError(t.common.error, t.profile.avatarUploadFailed || 'فشل رفع صورة البروفايل');
    }
  };

  // Handle upload video function
  const handleUploadVideo = async (newVideo: any) => {
    if (!cooldowns) {
      await refreshCache(false);
      toastManager.showInfo(t.common.loading, t.profile.loadingUploadInfo);
      return;
    }

    // UX Fix 3: Show cooldown block modal BEFORE opening upload modal
    if (!cooldowns.reelUpload.canChange) {
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

    if (reelUploadInFlightRef.current) {
      toastManager.showWarning(t.profile.waitABit, t.profile.uploadAlreadyInProgress);
      return;
    }
    reelUploadInFlightRef.current = true;

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

    try {
      const token = await getToken();
      if (!token) {
        removeVideo(newVideo.id);
        setIsVideoUploading(false);
        toastManager.showAuthError();
        return;
      }

      const caption = newVideo.caption || '';
      const hashtags = caption.match(/#[\w\u0600-\u06FF]+/g) || [];
      const mentions = caption.match(/@[\w]+/g) || [];

      const syncReelProgress = (progress: number) => {
        let label = t.profile.preparingUpload;
        if (progress >= 20 && progress < 90) label = t.profile.uploadingVideo;
        else if (progress >= 90 && progress < 100) label = t.profile.processingVideo;
        else if (progress >= 100) label = t.profile.uploadSuccessPhase;
        setVideoUploadProgress(progress);
        setVideoUploadMessage(label);
        setReelUploadUi({ active: true, progress, phaseLabel: label });
        void reelUploadNotification.updateProgress(progress, label);
      };

      setReelUploadUi({ active: true, progress: 0, phaseLabel: t.profile.preparingUpload });
      await reelUploadNotification.begin();

      const uploadResult = await StorageService.uploadReel(
        token,
        newVideo.uri,
        newVideo.thumbnail,
        caption,
        hashtags.map((h: string) => h.replace('#', '')),
        mentions.map((m: string) => m.replace('@', '')),
        (progress: number) => {
          syncReelProgress(progress);
          addVideo({
            ...tempVideo,
            uploadProgress: progress,
            isUploading: true,
          });
        }
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
        await reelUploadNotification.success();

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
        if (errMsg.includes('يتم رفع فيديو') || errMsg.includes('بالفعل')) {
          toastManager.showWarning(t.profile.waitABit, errMsg);
        } else if (errMsg.includes('يمكنك رفع فيديو جديد بعد')) {
          toastManager.showWarning(t.profile.waitABit, errMsg);
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
    }
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    try {
      toastManager.showInfo(t.profile.updating, t.profile.refreshingProfileData);
      
      await refreshCache(true);
      const token = await getToken();
      if (token) {
        fetchPredictionStats(token);
      }
      
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
          {cacheError?.includes('المحفوظة') ? t.profile.serverDown : t.profile.checkConnection}
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

      {/* Fixed top bar — 90PLUS brand + purple coin badge */}
      <ProfileTopBar topInset={insets.top} />

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
        <View style={styles.profileCardContainer}>
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
            brandLogo={displayBrandLogo}
            onBrandPress={() => setIsBrandModalVisible(true)}
            isAvatarUploading={isAvatarUploading}
            isCountryUpdating={isCountryUpdating}
            isClubUpdating={isClubUpdating}
            isBrandUpdating={isBrandUpdating}
            isStatsUpdating={isStatsUpdating}
          />
        </View>

        <UserInfo
          name={userData?.displayName || userData?.username || 'User'}
          username={userData?.username || 'user'}
          bio={userData?.bio}
          location={displayLocation}
          team={userData?.favoriteTeam || ''}
          isVerified={userData?.isVerified || false}
          isDeveloper={userData?.isDeveloper || false}
          onBioLongPress={() => setIsEditProfileModalVisible(true)}
          onNameLongPress={() => setIsEditProfileModalVisible(true)}
          clubLogo={displayClubLogo}
          onEditPress={handleEditProfile}
          socials={userData?.socials}
          consecutiveLoginDays={userData?.consecutiveLoginDays || 0}
        />

        {/* Profile Completion Card - FIXED: No more infinite loop */}
        {completionStatus && completionStatus.percentage < 100 && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(34, 197, 94, 0.3)',
              }}
              onPress={() => {
                // Show completion details
                Alert.alert(
                  t.profile.completeYourProfile,
                  `${t.profile.completedPercentage.replace('{percentage}', String(completionStatus.percentage))}\n\n${t.profile.remainingSteps}:\n${completionStatus.missingRequiredSteps.map(step => `• ${step}`).join('\n')}`,
                  [{ text: t.profile.okay, style: 'default' }]
                );
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ProfileTheme.colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
                    {t.profile.completeYourProfile}
                  </Text>
                  <Text style={{ color: ProfileTheme.colors.textSecondary, fontSize: 14 }}>
                    {`${completionStatus.completedSteps} ${t.profile.of} ${completionStatus.totalSteps} ${t.profile.stepsCompleted}`}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: ProfileTheme.colors.neonGreen, fontSize: 24, fontWeight: 'bold' }}>
                    {completionStatus.percentage}%
                  </Text>
                </View>
              </View>
              
              {/* Progress Bar */}
              <View style={{ marginTop: 12, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                <View 
                  style={{ 
                    height: '100%', 
                    width: `${completionStatus.percentage}%`, 
                    backgroundColor: ProfileTheme.colors.neonGreen,
                    borderRadius: 4,
                  }} 
                />
              </View>
            </TouchableOpacity>
          </View>
        )}

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

        {/* Level & XP Card */}
        {userData?.level != null && (
          <LevelCard
            level={userData.level || 1}
            currentXP={(userData.xp || 0) - xpForLevel(userData.level || 1)}
            maxXP={getXpForNextLevel(userData.level || 1)}
            coins={userData.coins || 0}
          />
        )}

        <ActionButtons
          onEditPress={() => {
            if (reelUploadUi.active) {
              toastManager.showWarning(t.profile.uploading, reelUploadUi.phaseLabel || t.profile.uploadAlreadyInProgress);
              return;
            }
            setIsUploadModalVisible(true);
          }}
          onSharePress={async () => {
            try {
              await Share.share({
                message: `${t.profile.checkMyProfile} @${userData?.username}\nhttps://90plus.app/@${userData?.username}`,
              });
              toastManager.showSuccess(t.profile.shared, t.profile.profileSharedSuccess);
            } catch (error) {
              logger.warn('Share error:', error);
              toastManager.showError(t.profile.shareFailedTitle, t.profile.profileShareFailed);
            }
          }}
          onQRPress={() => setIsQRModalVisible(true)}
          uploadCooldown={cooldowns?.reelUpload}
          reelUploadActive={reelUploadUi.active}
          reelUploadProgress={reelUploadUi.progress}
        />

        <StatsRow
          followers={followStats.followersCount.toString()}
          following={followStats.followingCount.toString()}
          videos={(followStats.reelsCount || myVideos.length).toString()}
          onFollowersPress={() => {
            setFollowersModalTab('followers');
            setIsFollowersModalVisible(true);
          }}
          onFollowingPress={() => {
            setFollowersModalTab('following');
            setIsFollowersModalVisible(true);
          }}
        />

        <ContentTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          videoCount={myVideos.length}
          savedCount={0}
          isOwnProfile={true}
        />

        {activeTab === 'videos' && (
          <VideoGrid
            videos={myVideos}
            onVideoPress={(video, _index) => {
              const src = (video as any).videoUrl;
              // Only open the player if we actually have a video URL — never
              // pass a thumbnail (image) as the video source.
              if (src && typeof src === 'string' && src.length > 0) {
                setSelectedVideoUrl(src);
                setIsVideoPlayerVisible(true);
              } else {
                toastManager.showWarning('الفيديو غير جاهز', 'لا يوجد مصدر فيديو صالح للتشغيل');
              }
            }}
            onVideoLongPress={() => setIsDeleteMode(prev => !prev)}
            onDeleteVideo={(videoId) => {
              removeVideo(videoId);
              toastManager.showDeleteSuccess('video');
            }}
            isDeleteMode={isDeleteMode}
          />
        )}

        {activeTab === 'saved' && (
          <ProfileSavedGrid getToken={getToken} />
        )}

        {activeTab === 'analytics' && (
          <ProfileAnalyticsTab
            analytics={analytics}
            predictionStats={predictionStats}
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
        uploadProgress={0}
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
        onClose={() => setCooldownBlockVisible(false)}
      />

      {/* Modals */}
      <CountryPickerModal
        visible={isCountryModalVisible}
        onClose={() => setIsCountryModalVisible(false)}
        onSelect={async (country) => {
          await localProfileStorage.saveProfileData({
            countryFlag: country.flag,
            country: country.nameAr
          });

          updateCachedUserData({
            countryFlag: country.flag,
            country: country.nameAr,
            location: country.nameAr,
          });
          
          setIsCountryModalVisible(false);
          
          toastManager.showInfo(t.profile.updating, t.profile.updatingCountry.replace('{country}', country.nameAr));
          
          // Send to backend with optimistic updates
          const result = await updateFIFACard({ 
            countryFlag: country.flag
          });
          
          if (result.success) {
            toastManager.showSuccess(t.profile.updated, t.profile.countryUpdatedSuccess.replace('{country}', country.nameAr));
            // Mark country step as completed
            await markStepCompleted('country');
          }
        }}
        selectedCountryId={displayCountryFlag}
      />

      <PositionPickerModal
        visible={isPositionModalVisible}
        onClose={() => setIsPositionModalVisible(false)}
        onSelect={async (pos) => {
          setIsPositionModalVisible(false);

          await localProfileStorage.saveProfileData({ position: pos });
          updateCachedUserData({ position: pos });

          toastManager.showInfo(t.profile.updating, t.profile.updatingPosition.replace('{position}', pos));

          const result = await updateFIFACard({ position: pos });
          
          if (result.success) {
            toastManager.showSuccess(t.profile.updated, t.profile.positionUpdatedSuccess.replace('{position}', pos));
            // Mark position step as completed
            await markStepCompleted('position');
          }
        }}
        selectedPosition={displayPosition}
      />

      <ClubPickerModal
        visible={isClubModalVisible}
        onClose={() => setIsClubModalVisible(false)}
        onSelect={async (selectedClub) => {
          logger.debug('[ClubPicker] Selected club:', selectedClub.nameAr);
          
          await localProfileStorage.saveProfileData({
            clubLogo: selectedClub.logo,
            favoriteTeam: selectedClub.nameAr
          });

          updateCachedUserData({
            clubLogo: selectedClub.logo,
            favoriteTeam: selectedClub.nameAr
          });
          
          // Update global state for immediate UI refresh
          if (globalState.userProfile) {
            globalState.setUserProfile({
              ...globalState.userProfile,
              clubLogo: selectedClub.logo,
              favoriteTeam: selectedClub.nameAr
            });
          }
          
          setIsClubModalVisible(false);
          
          toastManager.showInfo(t.profile.updating, t.profile.updatingClub.replace('{club}', selectedClub.nameAr));
          
          // Send to backend with optimistic updates
          const result = await updateFavorites({ 
            favoriteClub: selectedClub.nameAr,
            favoriteTeam: selectedClub.nameAr,
            clubLogo: selectedClub.logo
          });
          
          if (result.success) {
            toastManager.showSuccess(t.profile.updated, t.profile.clubUpdatedSuccess.replace('{club}', selectedClub.nameAr));
            // Mark club step as completed
            await markStepCompleted('club');
          }
        }}
      />

      <BrandPickerModal
        visible={isBrandModalVisible}
        onClose={() => setIsBrandModalVisible(false)}
        onSelect={async (selectedBrand) => {
          await localProfileStorage.saveProfileData({
            brandLogo: selectedBrand.logo,
            favoriteBrand: selectedBrand.nameAr
          });

          updateCachedUserData({
            brandLogo: selectedBrand.logo,
            favoriteBrand: selectedBrand.nameAr
          });
          
          setIsBrandModalVisible(false);
          
          toastManager.showInfo(t.profile.updating, t.profile.updatingBrand.replace('{brand}', selectedBrand.nameAr));
          
          // Send to backend with optimistic updates
          const result = await updateFavorites({ 
            favoriteBrand: selectedBrand.nameAr,
            brandLogo: selectedBrand.logo
          });
          
          if (result.success) {
            toastManager.showSuccess(t.profile.updated, t.profile.brandUpdatedSuccess.replace('{brand}', selectedBrand.nameAr));
            // Mark brand step as completed
            await markStepCompleted('brand');
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
          
          // Send to backend with optimistic updates
          const result = await updateFIFACard({
            age: Number.isFinite(ageNum) ? ageNum : undefined,
            height: Number.isFinite(heightNum) ? heightNum : undefined,
            weight: Number.isFinite(weightNum) ? weightNum : undefined,
            preferredFoot
          });
          
          if (result.success) {
            toastManager.showSuccess(t.profile.updated, t.profile.playerStatsUpdatedSuccess);
            // Mark cardData step as completed (age, height, weight, foot)
            await markStepCompleted('cardData');
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
            toastManager.showInfo(t.profile.updating, t.profile.savingProfileChanges);
            
            if (updates.username) {
              // Update UI immediately before sending to backend
              updateCachedUserData({ username: updates.username });
              
              // Also update global state for immediate UI refresh
              if (globalState.userProfile) {
                globalState.setUserProfile({
                  ...globalState.userProfile,
                  username: updates.username
                });
              }
              
              const result = await updateUsername(updates.username);
              if (result.success) {
                toastManager.showSuccess(t.profile.updated, t.profile.usernameUpdatedTo.replace('{username}', `@${updates.username}`));
              }
              delete updates.username; // Remove from batch update
            }
            
            if (updates.displayName) {
              // Update UI immediately before sending to backend
              updateCachedUserData({ displayName: updates.displayName });
              
              // Also update global state for immediate UI refresh
              if (globalState.userProfile) {
                globalState.setUserProfile({
                  ...globalState.userProfile,
                  displayName: updates.displayName
                });
              }
              
              const result = await updateDisplayName(updates.displayName);
              if (result.success) {
                toastManager.showSuccess(t.profile.updated, t.profile.nameUpdatedTo.replace('{name}', updates.displayName));
              }
              delete updates.displayName;
            }
            
            if (Object.prototype.hasOwnProperty.call(updates, 'bio')) {
              // Update UI immediately before sending to backend
              updateCachedUserData({ bio: updates.bio });
              const result = await updateBio(updates.bio);
              if (result.success) {
                toastManager.showSuccess(t.profile.updated, t.profile.bioUpdatedSuccess);
                // Mark bio step as completed
                await markStepCompleted('bio');
              }
              delete updates.bio;
            }
            
            if (Object.prototype.hasOwnProperty.call(updates, 'socialLinks')) {
              // Update UI immediately before sending to backend
              const newSocialLinks = (updates.socialLinks as Array<{ platform: string; url: string }>).map((link) => ({
                platform: link.platform,
                url: link.url,
                username: typeof link.url === 'string' ? link.url.replace(/.*\//, '').replace('@', '') : undefined
              }));
              
              // Update cached data immediately (synchronous now)
              updateCachedUserData({ socialLinks: newSocialLinks });
              
              // Also update global state for immediate UI refresh
              if (globalState.userProfile) {
                globalState.setUserProfile({
                  ...globalState.userProfile,
                  socialLinks: newSocialLinks
                });
              }
              
              const result = await updateSocialLinks(newSocialLinks);
              if (result.success) {
                toastManager.showSuccess(t.profile.updated, t.profile.socialLinksUpdatedSuccess);
                // Mark socialLinks step as completed
                await markStepCompleted('socialLinks');
              }
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
          
          toastManager.showSuccess(t.profile.videoSelectedTitle, t.profile.videoSelectedMessage);
          
          handleUploadVideo(newVideo);
        }}
        canUploadVideo={true}
        missingRequiredSteps={[]}
      />

      <VideoPlayerModal
        visible={isVideoPlayerVisible}
        videoUrl={selectedVideoUrl}
        onClose={() => setIsVideoPlayerVisible(false)}
        userImage={localImage}
        username={userData?.username || 'user'}
        reelId={selectedVideoUrl}
        comments={reelComments[selectedVideoUrl || ''] || []}
        onAddComment={(comment: Comment) => { 
          if (selectedVideoUrl) addComment(selectedVideoUrl, comment); 
        }}
        onToggleLike={(commentId: string) => { 
          if (selectedVideoUrl) toggleCommentLike(selectedVideoUrl, commentId); 
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
    </View>
  );
}