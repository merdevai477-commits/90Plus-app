import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Text, Share, Alert, ActionSheetIOS, Platform, RefreshControl, AppState, AppStateStatus, TouchableOpacity, Dimensions } from 'react-native';
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
import { CoinsBadge } from '../../components/common/CoinsBadge';
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
import { useProfileCache } from '../../hooks/useProfileCache';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import { useTranslation } from '../../src/i18n';
import BadgesDisplay from '../../components/profile/BadgesDisplay';
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

const API_URL = getApiUrl();

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
  coinsBadgeContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel: {
    fontSize: 14,
    color: ProfileTheme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: ProfileTheme.colors.neonBlue,
  },
  achievementBadge: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    opacity: 0.4,
  },
  achievementUnlocked: {
    opacity: 1,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  achievementLabel: {
    fontSize: 11,
    color: ProfileTheme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  coinsSummaryCard: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  badgesContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
});

export default function ProfileScreen() {
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
      console.error('[ProfileScreen] ❌ Cache error:', cacheError);
      logger.error('Profile cache error:', cacheError);
    }
  }, [cacheError]);

  // Log loading state changes
  useEffect(() => {
    console.log('[ProfileScreen] 📊 State:', {
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
        console.log(`[ProfileScreen] 🔄 Auto-retry #${autoRetryCountRef.current} after error (${retryDelay}ms delay)`);
        refreshCache(true).catch(err => {
          console.error('[ProfileScreen] ❌ Auto-retry failed:', err);
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

  // CRITICAL FIX: Timeout fallback if loading takes too long
  const hasForcedRefreshRef = useRef(false);
  useEffect(() => {
    if (isLoading && !cachedUserData && !hasForcedRefreshRef.current) {
      const timeout = setTimeout(() => {
        console.error('[ProfileScreen] ⏰ Loading timeout - forcing refresh');
        logger.error('Profile loading timeout - forcing refresh');
        hasForcedRefreshRef.current = true;
        refreshCache(true).catch(err => {
          console.error('[ProfileScreen] ❌ Refresh failed:', err);
          toastManager.showError('خطأ', 'فشل تحديث البيانات. يرجى المحاولة مرة أخرى');
        });
      }, 30000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, cachedUserData, refreshCache]);
  // Local state for UI-specific data not in cache
  const [localImage, setLocalImageState] = useState<string | null>(globalState.localAvatar || null);
  const setLocalImage = (image: string | null) => {
    setLocalImageState(image);
    globalState.setLocalAvatar(image || undefined);
  };

  const [countryFlag, setCountryFlag] = useState<string>(DEFAULT_COUNTRY_FLAG);
  const [location, setLocation] = useState<string>('');
  const [position, setPosition] = useState<string>(DEFAULT_POSITION);
  const [club, setClub] = useState<string | undefined>(undefined);
  const [brand, setBrand] = useState<string | undefined>(undefined);

  // Stats State - MUST be defined before useEffect that uses it
  const [stats, setStats] = useState({
    age: DEFAULT_STATS.age,
    height: DEFAULT_STATS.height,
    weight: DEFAULT_STATS.weight,
    foot: DEFAULT_STATS.foot
  });

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
  const [videoUploadMessage, setVideoUploadMessage] = useState('جاري الرفع...');

  // Unified image upload (progress + retries + timeout) for iOS/Android
  const { upload: uploadImage } = useImageUpload();

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

  // Helper function to validate and get token
  const getValidatedToken = async (): Promise<string | null> => {
    if (!userData) {
      toastManager.showError('خطأ', 'بيانات المستخدم غير متاحة');
      return null;
    }
    const token = await getToken();
    if (!token) {
      toastManager.showAuthError();
      return null;
    }
    return token;
  };

  // Saved videos state
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [savedVideosCursor, setSavedVideosCursor] = useState<string | null>(null);
  const [hasMoreSaved, setHasMoreSaved] = useState(true);

  // Optimization: Load saved videos (with cancellation support)
  const loadSavedVideos = useCallback(async (cursor?: string) => {
    setIsLoadingSaved(true);
    try {
      const token = await getToken();
      if (!token) {
        setIsLoadingSaved(false);
        return;
      }

      const result = await ReelsService.getSavedReels(token, cursor);
      if (result) {
        if (cursor) {
          setSavedVideos(prev => [...prev, ...result.savedReels]);
        } else {
          setSavedVideos(result.savedReels);
        }
        setSavedVideosCursor(result.nextCursor);
        setHasMoreSaved(result.hasMore);
      }
    } catch (error) {
      logger.error('Error loading saved videos:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  // Optimization: Load saved videos when saved tab is active
  const hasLoadedSavedRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'saved' && !hasLoadedSavedRef.current && !isLoadingSaved) {
      hasLoadedSavedRef.current = true;
      loadSavedVideos();
    }
  }, [activeTab, isLoadingSaved, loadSavedVideos]);

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

    return uniqueVideos.map((video: any) => ({
      id: video.id,
      thumbnail: video.thumbnail || video.uri,
      views: video.views || '0',
      duration: video.duration || '',
      isUploading: video.isUploading || false,
      uploadProgress: video.uploadProgress,
    }));
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
  // Optimization: Sync local state with cached data (reduced re-renders)
  const prevUserDataRef = useRef(userData);
  useEffect(() => {
    if (!userData) return;

    // Load local profile data and merge with server data
    const loadLocalData = async () => {
      try {
        const mergedData = await localProfileStorage.mergeWithServerData(userData);
        
        // Update state with merged data
        if (mergedData.position) setPosition(mergedData.position);
        if (mergedData.countryFlag) setCountryFlag(mergedData.countryFlag);
        if (mergedData.country) setLocation(mergedData.country);
        if (mergedData.clubLogo) setClub(mergedData.clubLogo);
        if (mergedData.brandLogo) setBrand(mergedData.brandLogo);
        
        // Update stats
        if (mergedData.age || mergedData.height || mergedData.weight || mergedData.preferredFoot) {
          setStats({
            age: mergedData.age?.toString() || DEFAULT_STATS.age,
            height: mergedData.height?.toString() || DEFAULT_STATS.height,
            weight: mergedData.weight?.toString() || DEFAULT_STATS.weight,
            foot: (mergedData.preferredFoot as 'R' | 'L' | 'B') || DEFAULT_STATS.foot,
          });
        }
      } catch (error) {
        logger.error('Error loading local profile data:', error);
      }
    };

    const prev = prevUserDataRef.current;
    const hasChanged = !prev ||
      prev.position !== userData.position ||
      prev.countryFlag !== userData.countryFlag ||
      prev.avatar !== userData.avatar ||
      prev.coverImage !== userData.coverImage ||
      prev.clubLogo !== userData.clubLogo ||
      prev.brandLogo !== userData.brandLogo ||
      prev.age !== userData.age ||
      prev.height !== userData.height ||
      prev.weight !== userData.weight ||
      prev.preferredFoot !== userData.preferredFoot;

    if (!hasChanged) return;

    prevUserDataRef.current = userData;

    // Load local data first, then fallback to server data
    loadLocalData();
    if (userData.avatar) {
      setLocalImage(userData.avatar);
      globalState.setLocalAvatar(userData.avatar);
    }
    if (userData.coverImage) {
      setCoverImage(userData.coverImage);
    }

    globalState.username = userData.username;
  }, [userData, updateCachedUserData]);

  // Ref to store refreshCache to avoid dependency issues
  const refreshCacheRef = useRef(refreshCache);
  refreshCacheRef.current = refreshCache;

  // Throttle refresh calls to prevent request storms (iOS/Android focus + AppState + preload)
  const lastUiRefreshAtRef = useRef<number>(0);
  const MIN_UI_REFRESH_MS = 15_000;
  const maybeRefreshProfile = useCallback((reason: 'focus' | 'app_active') => {
    const now = Date.now();
    if (isOffline) return;
    if (isLoading || isRefreshing) return;
    if (now - lastUiRefreshAtRef.current < MIN_UI_REFRESH_MS) return;
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
      toastManager.showError('خطأ', 'بيانات المستخدم غير متاحة');
      return;
    }

    // Show loading toast immediately
    toastManager.showInfo('جاري التحضير', 'جاري تحضير رفع صورة الغلاف...');

    // Check cooldown first
    if (cooldowns && !cooldowns.cover.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.cover.daysRemaining;
      const hours = cooldowns.cover.hoursRemaining;
      const timeText = days > 0 ? `${days} ${t.common.days} ${t.common.and} ${hours} ${t.common.hours}` : `${hours} ${t.common.hours}`;

      toastManager.showWarning('انتظر قليلاً', `يمكنك تغيير صورة الغلاف بعد ${timeText}`);
      return;
    }

    try {
      // طلب الصلاحية قبل فتح الـ picker
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toastManager.showWarning('صلاحية مطلوبة', 'نحتاج إلى صلاحية الوصول للمعرض لتغيير صورة الغلاف.');
        return;
      }

      isPickerActiveRef.current = true;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      isPickerActiveRef.current = false;

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0]?.uri;
      if (!imageUri) {
        toastManager.showError('خطأ في الاختيار', 'لم يتم اختيار صورة صالحة للغلاف');
        return;
      }

      let finalUri = imageUri;
      try {
        toastManager.showInfo('جاري المعالجة', 'جاري ضغط صورة الغلاف...');
        const compressed = await compressImage(imageUri, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8,
        });
        finalUri = compressed.uri;
        console.log(`Cover compressed: ${compressed.compressionRatio.toFixed(1)}% saved`);
      } catch (error) {
        console.warn('Cover compression failed, using original:', error);
        finalUri = imageUri;
      }

      const originalCover = userData.coverImage;
      setCoverImage(finalUri);

      // Show upload start toast
      toastManager.showInfo('جاري الرفع', 'جاري رفع صورة الغلاف...');

      const token = await getToken();
      if (!token) {
        setCoverImage(originalCover || null);
        toastManager.showAuthError();
        return;
      }

      setIsCoverUploading(true);
      const uploadResult = await uploadImage(finalUri, {
        endpoint: '/upload/cover',
        fieldName: 'file',
        maxRetries: 2,
        timeoutMs: 55_000,
      });

      if (uploadResult.success && uploadResult.url) {
        const newCoverUrl = uploadResult.url;
        setCoverImage(newCoverUrl);
        globalState.setLocalCover(newCoverUrl);
        await updateCachedUserData({ coverImage: newCoverUrl });
        refreshCache(false).catch(err => logger.error('Background refresh error:', err));
        toastManager.showUploadSuccess('image');
      } else {
        setCoverImage(originalCover || null);
        
        // Handle specific error cases
        const errorMessage = uploadResult.error || 'حدث خطأ أثناء رفع صورة الغلاف';
        
        // Check if it's a cooldown error
        if (errorMessage.includes('يمكنك تغيير') || errorMessage.includes('يوم') || errorMessage.includes('ساعة')) {
          toastManager.showWarning('انتظر قليلاً', errorMessage);
        } else {
          toastManager.showUploadError('image');
        }
      }
    } catch (error: any) {
      setCoverImage(userData?.coverImage || null);
      
      // Handle specific error cases
      const errorMessage = error.message || 'حدث خطأ غير متوقع';
      
      // Check if it's a cooldown error
      if (errorMessage.includes('يمكنك تغيير') || errorMessage.includes('يوم') || errorMessage.includes('ساعة')) {
        // Don't log cooldown errors as errors since they're expected behavior
        logger.info('Cover upload cooldown:', errorMessage);
        toastManager.showCooldownError(errorMessage);
      } else {
        // Log actual errors
        logger.error('Cover upload error:', error);
        toastManager.showUploadError('image');
      }
    } finally {
      setIsCoverUploading(false);
    }
  };
  const handleImageUpload = async () => {
    if (!userData) {
      toastManager.showError('خطأ', 'بيانات المستخدم غير متاحة');
      return;
    }

    // Show loading toast immediately
    toastManager.showInfo('جاري التحضير', 'جاري تحضير رفع الصورة...');

    // Check cooldown first
    if (cooldowns && !cooldowns.avatar.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.avatar.daysRemaining;
      const hours = cooldowns.avatar.hoursRemaining;
      const timeText = days > 0 ? `${days} ${t.common.days} ${t.common.and} ${hours} ${t.common.hours}` : `${hours} ${t.common.hours}`;

      toastManager.showWarning('انتظر قليلاً', `يمكنك تغيير الصورة الشخصية بعد ${timeText}`);
      return;
    }

    try {
      // طلب الصلاحية قبل فتح الـ picker
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toastManager.showWarning('صلاحية مطلوبة', 'نحتاج إلى صلاحية الوصول للمعرض لتغيير صورة البروفايل.');
        return;
      }

      isPickerActiveRef.current = true;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      isPickerActiveRef.current = false;

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0]?.uri;
      if (!imageUri) {
        toastManager.showError('خطأ في الاختيار', 'لم يتم اختيار صورة صالحة للملف الشخصي');
        return;
      }

      let finalUri = imageUri;
      try {
        toastManager.showInfo('جاري المعالجة', 'جاري ضغط الصورة...');
        const compressed = await compressImage(imageUri, {
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.7,
        });
        finalUri = compressed.uri;
        console.log(`Avatar compressed: ${compressed.compressionRatio.toFixed(1)}% saved`);
      } catch (error) {
        console.warn('Avatar compression failed, using original:', error);
        finalUri = imageUri;
      }

      const originalAvatar = userData.avatar;
      setIsAvatarUploading(true);
      setLocalImage(finalUri);

      // Show upload start toast
      toastManager.showInfo('جاري الرفع', 'جاري رفع الصورة الشخصية...');

      const token = await getToken();
      if (!token) {
        setLocalImage(originalAvatar || null);
        setIsAvatarUploading(false);
        toastManager.showAuthError();
        return;
      }

      const uploadResult = await uploadImage(finalUri, {
        endpoint: '/upload/avatar',
        fieldName: 'file',
        maxRetries: 2,
        timeoutMs: 55_000,
      });

      if (uploadResult.success && uploadResult.url) {
        const newAvatarUrl = uploadResult.url;
        setLocalImage(newAvatarUrl);

        if (globalState.userProfile) {
          globalState.userProfile.avatar = newAvatarUrl;
        }
        globalState.setLocalAvatar(newAvatarUrl);

        await updateCachedUserData({ avatar: newAvatarUrl });
        refreshCache(false).catch(err => logger.error('Background refresh error:', err));
        toastManager.showUploadSuccess('image');
        
        // Mark avatar step as completed
        await markStepCompleted('avatar');
      } else {
        setLocalImage(originalAvatar || null);
        
        // Handle specific error cases
        const errorMessage = uploadResult.error || 'حدث خطأ أثناء رفع الصورة';
        
        // Check if it's a cooldown error
        if (errorMessage.includes('يمكنك تغيير') || errorMessage.includes('يوم') || errorMessage.includes('ساعة')) {
          toastManager.showWarning('انتظر قليلاً', errorMessage);
        } else {
          toastManager.showUploadError('image');
        }
      }
    } catch (error: any) {
      setLocalImage(userData?.avatar || null);
      
      // Handle specific error cases
      const errorMessage = error.message || 'حدث خطأ غير متوقع';
      
      // Check if it's a cooldown error
      if (errorMessage.includes('يمكنك تغيير') || errorMessage.includes('يوم') || errorMessage.includes('ساعة')) {
        // Don't log cooldown errors as errors since they're expected behavior
        logger.info('Avatar upload cooldown:', errorMessage);
        toastManager.showCooldownError(errorMessage);
      } else {
        // Log actual errors
        logger.error('Avatar upload error:', error);
        toastManager.showUploadError('image');
      }
    } finally {
      setIsAvatarUploading(false);
    }
  };

  // Handle upload video function
  const handleUploadVideo = async (newVideo: any) => {
    if (!cooldowns) {
      await refreshCache(false);
      toastManager.showInfo('جاري التحميل', 'جاري تحميل معلومات الرفع...');
      return;
    }

    if (!cooldowns.reelUpload.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.reelUpload.daysRemaining;
      const hours = cooldowns.reelUpload.hoursRemaining;
      const timeText = days > 0 ? `${days} ${t.common.days} ${t.common.and} ${hours} ${t.common.hours}` : `${hours} ${t.common.hours}`;

      toastManager.showWarning('انتظر قليلاً', `يمكنك رفع فيديو جديد بعد ${timeText}`);
      return;
    }

    // Validate video duration
    if (newVideo.duration) {
      const durationInSeconds = parseFloat(newVideo.duration);
      if (durationInSeconds < 5) {
        toastManager.showWarning('مدة الفيديو قصيرة', 'يجب أن تكون مدة الفيديو 5 ثوانٍ على الأقل');
        return;
      }
      if (durationInSeconds > 60) {
        toastManager.showWarning('مدة الفيديو طويلة', 'يجب أن تكون مدة الفيديو أقل من 60 ثانية');
        return;
      }
    }

    if (reelUploadInFlightRef.current) {
      toastManager.showWarning('انتظر قليلاً', 'يتم رفع فيديو حالياً. انتظر حتى يكتمل.');
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
    setVideoUploadMessage('جاري التحضير...');

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
        let label = 'جاري التحضير...';
        if (progress >= 20 && progress < 90) label = 'جاري الرفع...';
        else if (progress >= 90 && progress < 100) label = 'جاري المعالجة...';
        else if (progress >= 100) label = 'تم الرفع بنجاح!';
        setVideoUploadProgress(progress);
        setVideoUploadMessage(label);
        setReelUploadUi({ active: true, progress, phaseLabel: label });
        void reelUploadNotification.updateProgress(progress, label);
      };

      setReelUploadUi({ active: true, progress: 0, phaseLabel: 'جاري التحضير...' });
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
        setVideoUploadMessage('تم الرفع بنجاح!');
        setVideoUploadProgress(100);
        setReelUploadUi({ active: true, progress: 100, phaseLabel: 'تم الرفع بنجاح!' });
        await reelUploadNotification.success();

        await new Promise(resolve => setTimeout(resolve, 1000));

        removeVideo(newVideo.id);
        setIsVideoUploading(false);
        toastManager.showUploadSuccess('video');

        await refreshCache(true);
        if (userData?.username) {
          await loadVideos(userData.username, true);
        }
      } else {
        removeVideo(newVideo.id);
        setIsVideoUploading(false);
        const errMsg = uploadResult.error || '';
        await reelUploadNotification.failure(
          errMsg || 'تعذّر رفع الفيديو. تحقق من الاتصال وحجم الملف.'
        );
        if (errMsg.includes('يتم رفع فيديو') || errMsg.includes('بالفعل')) {
          toastManager.showWarning('انتظر قليلاً', errMsg);
        } else if (errMsg.includes('يمكنك رفع فيديو جديد بعد')) {
          toastManager.showWarning('انتظر قليلاً', errMsg);
        } else {
          toastManager.showError('فشل الرفع', errMsg || 'تعذّر رفع الفيديو. تحقق من الاتصال وإعدادات التخزين.');
        }
      }
    } catch (error: any) {
      logger.error('Video upload error:', error);
      removeVideo(newVideo.id);
      setIsVideoUploading(false);
      const msg = error.message || 'حدث خطأ غير متوقع أثناء رفع الفيديو';
      await reelUploadNotification.failure(msg);
      toastManager.showError('خطأ في الرفع', msg);
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
      toastManager.showInfo('جاري التحديث', 'جاري تحديث بيانات الملف الشخصي...');
      
      await refreshCache(true);
      const token = await getToken();
      if (token) {
        fetchPredictionStats(token);
      }
      
      toastManager.showSuccess('تم التحديث', 'تم تحديث بيانات الملف الشخصي بنجاح');
    } catch (error) {
      logger.error('Refresh error:', error);
      toastManager.showError('فشل التحديث', 'حدث خطأ أثناء تحديث البيانات');
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
            {`إعادة المحاولة خلال ${retryCountdown}s...`}
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
              console.log('[ProfileScreen] 🔄 Manual retry triggered');
              autoRetryCountRef.current = 0; // Reset counter on manual retry
              try {
                await refreshCache(true);
                toastManager.showInfo('جاري التحديث', 'جاري إعادة تحميل البيانات...');
              } catch (err) {
                console.error('[ProfileScreen] ❌ Manual retry failed:', err);
                toastManager.showError('فشل التحديث', 'فشل في إعادة تحميل البيانات');
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
              console.log('[ProfileScreen] 🚪 Navigating to auth');
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

      {/* Coins Badge */}
      <View style={styles.coinsBadgeContainer}>
        <CoinsBadge />
      </View>

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
            countryFlag={countryFlag}
            onCountryPress={() => setIsCountryModalVisible(true)}
            position={position}
            onPositionPress={() => setIsPositionModalVisible(true)}
            age={stats.age}
            height={stats.height}
            weight={stats.weight}
            foot={stats.foot}
            onStatsPress={() => setIsStatsModalVisible(true)}
            clubLogo={club}
            onClubPress={() => setIsClubModalVisible(true)}
            brandLogo={brand}
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
          location={location}
          team={userData?.favoriteTeam || ''}
          isVerified={userData?.isVerified || false}
          isDeveloper={userData?.isDeveloper || false}
          onBioLongPress={() => setIsEditProfileModalVisible(true)}
          onNameLongPress={() => setIsEditProfileModalVisible(true)}
          clubLogo={club}
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
                  'إكمال الملف الشخصي',
                  `لقد أكملت ${completionStatus.percentage}% من ملفك الشخصي.\n\nالخطوات المتبقية:\n${completionStatus.missingRequiredSteps.map(step => `• ${step}`).join('\n')}`,
                  [{ text: 'حسناً', style: 'default' }]
                );
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ProfileTheme.colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
                    أكمل ملفك الشخصي
                  </Text>
                  <Text style={{ color: ProfileTheme.colors.textSecondary, fontSize: 14 }}>
                    {completionStatus.completedSteps} من {completionStatus.totalSteps} خطوات مكتملة
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

        {/* Badges Display */}
        {userData?.id && (
          <View style={styles.badgesContainer}>
            <BadgesDisplay
              userId={userData.id}
              token={authToken}
              compact={true}
            />
          </View>
        )}

        <ActionButtons
          onEditPress={() => {
            if (reelUploadUi.active) {
              toastManager.showWarning('جاري الرفع', reelUploadUi.phaseLabel || 'يتم رفع الفيديو حالياً.');
              return;
            }
            setIsUploadModalVisible(true);
          }}
          onSharePress={async () => {
            try {
              await Share.share({
                message: `${t.profile.checkMyProfile} @${userData?.username}\nhttps://90plus.app/@${userData?.username}`,
              });
              toastManager.showSuccess('تم المشاركة', 'تم مشاركة ملفك الشخصي بنجاح');
            } catch (error) {
              logger.warn('Share error:', error);
              toastManager.showError('فشل المشاركة', 'حدث خطأ أثناء مشاركة الملف الشخصي');
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
          savedCount={savedVideos.length}
          isOwnProfile={true}
        />

        {activeTab === 'videos' && (
          <VideoGrid
            videos={myVideos}
            onVideoPress={(video, index) => {
              setSelectedVideoUrl(video.thumbnail);
              setIsVideoPlayerVisible(true);
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
          <VideoGrid
            videos={savedVideos.map(video => ({
              id: video.id,
              thumbnail: video.thumbnail || video.videoUrl,
              views: video.views?.toString() || '0',
              duration: '',
            }))}
            onVideoPress={(video, index) => {
              router.push({
                pathname: '/(tabs)/reels',
                params: { reelId: video.id }
              });
            }}
            onVideoLongPress={() => {}}
            onDeleteVideo={() => {}}
            isDeleteMode={false}
          />
        )}

        {activeTab === 'analytics' && (
          <View style={styles.analyticsContainer}>
            <Text style={styles.analyticsTitle}>{t.profile.videoAnalytics}</Text>

            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsCard}>
                <Ionicons name="eye-outline" size={28} color={ProfileTheme.colors.neonBlue} />
                <Text style={styles.analyticsValue}>{analytics?.totalViews || 0}</Text>
                <Text style={styles.analyticsLabel}>{t.profile.views}</Text>
              </View>

              <View style={styles.analyticsCard}>
                <Ionicons name="heart-outline" size={28} color="#FF6B6B" />
                <Text style={styles.analyticsValue}>{analytics?.totalLikes || 0}</Text>
                <Text style={styles.analyticsLabel}>{t.profile.likes}</Text>
              </View>

              <View style={styles.analyticsCard}>
                <Ionicons name="chatbubble-outline" size={28} color={ProfileTheme.colors.neonGreen} />
                <Text style={styles.analyticsValue}>{analytics?.totalComments || 0}</Text>
                <Text style={styles.analyticsLabel}>{t.profile.comments}</Text>
              </View>

              <View style={styles.analyticsCard}>
                <Ionicons name="person-add-outline" size={28} color="#9B59B6" />
                <Text style={styles.analyticsValue}>{analytics?.recentFollowers || 0}</Text>
                <Text style={styles.analyticsLabel}>{t.profile.newFollowers}</Text>
              </View>
            </View>

            {/* Prediction Statistics Section */}
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>📊 {t.profile.predictionStats}</Text>
              <View style={styles.analyticsGrid}>
                <View style={[styles.analyticsCard, { borderColor: '#22c55e', borderWidth: 1 }]}>
                  <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
                  <Text style={[styles.analyticsValue, { color: '#22c55e' }]}>{predictionStats?.correct || 0}</Text>
                  <Text style={styles.analyticsLabel}>{t.profile.correctPredictions}</Text>
                </View>

                <View style={[styles.analyticsCard, { borderColor: '#ef4444', borderWidth: 1 }]}>
                  <Ionicons name="close-circle" size={28} color="#ef4444" />
                  <Text style={[styles.analyticsValue, { color: '#ef4444' }]}>{predictionStats?.incorrect || 0}</Text>
                  <Text style={styles.analyticsLabel}>{t.profile.wrongPredictions}</Text>
                </View>

                <View style={[styles.analyticsCard, { borderColor: '#f59e0b', borderWidth: 1 }]}>
                  <Ionicons name="time" size={28} color="#f59e0b" />
                  <Text style={[styles.analyticsValue, { color: '#f59e0b' }]}>{predictionStats?.pending || 0}</Text>
                  <Text style={styles.analyticsLabel}>{t.profile.pendingPredictions}</Text>
                </View>

                <View style={[styles.analyticsCard, { borderColor: '#3b82f6', borderWidth: 1 }]}>
                  <Ionicons name="analytics" size={28} color="#3b82f6" />
                  <Text style={[styles.analyticsValue, { color: '#3b82f6' }]}>{predictionStats?.accuracy || 0}%</Text>
                  <Text style={styles.analyticsLabel}>{t.profile.successRate}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <CountryPickerModal
        visible={isCountryModalVisible}
        onClose={() => setIsCountryModalVisible(false)}
        onSelect={async (country) => {
          // Optimistic update - UI changes immediately
          setCountryFlag(country.flag);
          setLocation(country.nameAr);
          
          // Save locally immediately
          await localProfileStorage.saveProfileData({
            countryFlag: country.flag,
            country: country.nameAr
          });
          
          // Update cached data immediately
          await updateCachedUserData({ 
            countryFlag: country.flag,
            country: country.nameAr 
          });
          
          setIsCountryModalVisible(false);
          
          toastManager.showInfo('جاري التحديث', `جاري تحديث البلد إلى ${country.nameAr}...`);
          
          // Send to backend with optimistic updates
          const result = await updateFIFACard({ 
            countryFlag: country.flag
          });
          
          if (result.success) {
            toastManager.showSuccess('تم التحديث', `تم تحديث البلد إلى ${country.nameAr} بنجاح`);
            // Mark country step as completed
            await markStepCompleted('country');
          }
        }}
        selectedCountryId={countryFlag}
      />

      <PositionPickerModal
        visible={isPositionModalVisible}
        onClose={() => setIsPositionModalVisible(false)}
        onSelect={async (pos) => {
          // Optimistic update - UI changes immediately
          setPosition(pos);
          setIsPositionModalVisible(false);
          
          toastManager.showInfo('جاري التحديث', `جاري تحديث المركز إلى ${pos}...`);
          
          // Send to backend with optimistic updates
          const result = await updateFIFACard({ position: pos });
          
          if (result.success) {
            toastManager.showSuccess('تم التحديث', `تم تحديث المركز إلى ${pos} بنجاح`);
            // Mark position step as completed
            await markStepCompleted('position');
          }
        }}
        selectedPosition={position}
      />

      <ClubPickerModal
        visible={isClubModalVisible}
        onClose={() => setIsClubModalVisible(false)}
        onSelect={async (selectedClub) => {
          console.log('🏆 [ClubPicker] Selected club:', selectedClub.nameAr);
          
          // Optimistic update - UI changes immediately
          setClub(selectedClub.logo);
          
          // Save locally immediately
          await localProfileStorage.saveProfileData({
            clubLogo: selectedClub.logo,
            favoriteTeam: selectedClub.nameAr
          });
          
          // Update cached data immediately (synchronous now)
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
          
          toastManager.showInfo('جاري التحديث', `جاري تحديث النادي إلى ${selectedClub.nameAr}...`);
          
          console.log('✅ [ClubPicker] UI updated, sending to backend...');
          
          // Send to backend with optimistic updates
          const result = await updateFavorites({ 
            favoriteClub: selectedClub.nameAr,
            favoriteTeam: selectedClub.nameAr,
            clubLogo: selectedClub.logo
          });
          
          if (result.success) {
            toastManager.showSuccess('تم التحديث', `تم تحديث النادي إلى ${selectedClub.nameAr} بنجاح`);
            // Mark club step as completed
            await markStepCompleted('club');
          }
          
          console.log('✅ [ClubPicker] Backend update completed');
        }}
      />

      <BrandPickerModal
        visible={isBrandModalVisible}
        onClose={() => setIsBrandModalVisible(false)}
        onSelect={async (selectedBrand) => {
          // Optimistic update - UI changes immediately
          setBrand(selectedBrand.logo);
          
          // Save locally immediately
          await localProfileStorage.saveProfileData({
            brandLogo: selectedBrand.logo,
            favoriteBrand: selectedBrand.nameAr
          });
          
          // Update cached data immediately
          await updateCachedUserData({ 
            brandLogo: selectedBrand.logo,
            favoriteBrand: selectedBrand.nameAr
          });
          
          setIsBrandModalVisible(false);
          
          toastManager.showInfo('جاري التحديث', `جاري تحديث العلامة التجارية إلى ${selectedBrand.nameAr}...`);
          
          // Send to backend with optimistic updates
          const result = await updateFavorites({ 
            favoriteBrand: selectedBrand.nameAr,
            brandLogo: selectedBrand.logo
          });
          
          if (result.success) {
            toastManager.showSuccess('تم التحديث', `تم تحديث العلامة التجارية إلى ${selectedBrand.nameAr} بنجاح`);
            // Mark brand step as completed
            await markStepCompleted('brand');
          }
        }}
      />

      <StatsEditModal
        visible={isStatsModalVisible}
        onClose={() => setIsStatsModalVisible(false)}
        onSave={async (newStats) => {
          // Optimistic update - UI changes immediately
          setStats(newStats);
          setIsStatsModalVisible(false);
          
          toastManager.showInfo('جاري التحديث', 'جاري تحديث إحصائيات اللاعب...');

          // Persist locally + update cached profile immediately so values don't "disappear" on refetch/navigation
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

          await updateCachedUserData({
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
            toastManager.showSuccess('تم التحديث', 'تم تحديث إحصائيات اللاعب بنجاح');
            // Mark cardData step as completed (age, height, weight, foot)
            await markStepCompleted('cardData');
          }
        }}
        initialStats={stats}
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
            toastManager.showInfo('جاري التحديث', 'جاري حفظ تغييرات الملف الشخصي...');
            
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
                toastManager.showSuccess('تم التحديث', `تم تحديث اسم المستخدم إلى @${updates.username}`);
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
                toastManager.showSuccess('تم التحديث', `تم تحديث الاسم إلى ${updates.displayName}`);
              }
              delete updates.displayName;
            }
            
            if (Object.prototype.hasOwnProperty.call(updates, 'bio')) {
              // Update UI immediately before sending to backend
              updateCachedUserData({ bio: updates.bio });
              const result = await updateBio(updates.bio);
              if (result.success) {
                toastManager.showSuccess('تم التحديث', 'تم تحديث النبذة الشخصية بنجاح');
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
                toastManager.showSuccess('تم التحديث', 'تم تحديث الروابط الاجتماعية بنجاح');
                // Mark socialLinks step as completed
                await markStepCompleted('socialLinks');
              }
            }
          } else {
            toastManager.showInfo('لا توجد تغييرات', 'لم يتم إجراء أي تغييرات على الملف الشخصي');
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
          
          toastManager.showSuccess('تم اختيار الفيديو', 'تم إضافة الفيديو وجاري الرفع...');
          
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

      {/* Upload Progress Modal */}
      <UploadProgressModal
        visible={isVideoUploading}
        progress={videoUploadProgress}
        message={videoUploadMessage}
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