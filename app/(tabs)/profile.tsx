import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Text, Share, Alert, ActionSheetIOS, Platform, RefreshControl, AppState, AppStateStatus, TouchableOpacity } from 'react-native';
import ImageViewerModal from '../../components/common/ImageViewerModal';
import ReelUploadModal from '../../components/common/ReelUploadModal';
import VideoPlayerModal from '../../components/common/VideoPlayerModal';
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
import { useToast } from '../../contexts/ToastContext';
import * as Haptics from 'expo-haptics';
import { useProfileCache } from '../../hooks/useProfileCache';
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
import { Club } from '../../data/clubs';

const API_URL = getApiUrl();

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
    fontSize: 16,
    marginTop: 16,
  },
  analyticsContainer: {
    paddingHorizontal: 20,
  },
  analyticsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  analyticsCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  analyticsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    marginTop: 8,
  },
  analyticsLabel: {
    fontSize: 14,
    color: ProfileTheme.colors.textSecondary,
    marginTop: 4,
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
  const { uploadedVideos, addVideo, setUserVideoData, removeVideo, reelComments, addComment, toggleCommentLike } = useVideos();
  const toast = useToast();
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

  // TEMPORARILY DISABLED: Profile completion hook causing infinite loop
  const completionStatus = null;
  const isCompletionLoading = false;
  const completionError = null;
  const markStepCompleted = () => Promise.resolve(false);

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

  // CRITICAL FIX: Auto-retry when backend is down (502 error)
  useEffect(() => {
    if (cacheError && cacheError.includes('المحفوظة') && !isLoading) {
      const retryTimeout = setTimeout(() => {
        console.log('[ProfileScreen] 🔄 Auto-retry after backend cold start (8s delay)');
        refreshCache(true).catch(err => {
          console.error('[ProfileScreen] ❌ Auto-retry failed:', err);
        });
      }, 8000);

      return () => clearTimeout(retryTimeout);
    }
  }, [cacheError, isLoading, refreshCache]);

  // CRITICAL FIX: Timeout fallback if loading takes too long
  useEffect(() => {
    if (isLoading && !cachedUserData) {
      const timeout = setTimeout(() => {
        console.error('[ProfileScreen] ⏰ Loading timeout - forcing refresh');
        logger.error('Profile loading timeout - forcing refresh');
        refreshCache(true).catch(err => {
          console.error('[ProfileScreen] ❌ Refresh failed:', err);
          toast.showError(t.profile.error, t.profile.profileLoadFailed);
        });
      }, 15000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, cachedUserData, refreshCache, toast]);
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
      toast.showError(t.profile.error, t.profile.userDataNotAvailable);
      return null;
    }
    const token = await getToken();
    if (!token) {
      toast.showError(t.profile.error, t.profile.pleaseLoginAgain);
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

    const uniqueVideos = allVideos.reduce((acc, video) => {
      if (!acc.find(v => v.id === video.id)) {
        acc.push(video);
      }
      return acc;
    }, [] as any[]);

    return uniqueVideos.map(video => ({
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

    if (userData.position) setPosition(userData.position);
    if (userData.countryFlag) setCountryFlag(userData.countryFlag);
    if (userData.location) setLocation(userData.location);
    if (userData.avatar) {
      setLocalImage(userData.avatar);
      globalState.setLocalAvatar(userData.avatar);
    }
    if (userData.coverImage) {
      setCoverImage(userData.coverImage);
    }

    if (userData.clubLogo) {
      setClub(userData.clubLogo);
    } else if (userData.favoriteTeam && !prev?.favoriteTeam) {
      const loadClubLogo = async () => {
        try {
          const { CLUBS } = await import('../../data/clubs');
          const matchedClub = CLUBS.find(c =>
            c.name === userData.favoriteTeam ||
            c.name.includes(userData.favoriteTeam) ||
            userData.favoriteTeam.includes(c.name)
          );
          if (matchedClub?.apiId) {
            const { getClubLogo } = await import('../../services/clubLogoService');
            const logo = await getClubLogo(matchedClub.apiId);
            if (logo) {
              setClub(logo);
              await updateCachedUserData({ clubLogo: logo });
            }
          }
        } catch (error) {
          logger.error('Error loading club logo:', error);
        }
      };
      loadClubLogo();
    }

    if (userData.brandLogo) setBrand(userData.brandLogo);

    if (userData.age || userData.height || userData.weight || userData.preferredFoot) {
      setStats({
        age: userData.age?.toString() || DEFAULT_STATS.age,
        height: userData.height?.toString() || DEFAULT_STATS.height,
        weight: userData.weight?.toString() || DEFAULT_STATS.weight,
        foot: (userData.preferredFoot as 'R' | 'L' | 'B') || DEFAULT_STATS.foot,
      });
    }

    globalState.username = userData.username;
  }, [userData, updateCachedUserData]);

  // Ref to store refreshCache to avoid dependency issues
  const refreshCacheRef = useRef(refreshCache);
  refreshCacheRef.current = refreshCache;

  // Refresh on focus - use cache hook's refresh
  useFocusEffect(
    useCallback(() => {
      refreshCacheRef.current(false);
    }, [])
  );

  // Auto-refresh when app returns from background
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        refreshCacheRef.current(false);
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
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
      toast.showError(t.profile.error, t.profile.userDataNotAvailable);
      return;
    }

    if (cooldowns && !cooldowns.cover.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.cover.daysRemaining;
      const hours = cooldowns.cover.hoursRemaining;
      const timeText = days > 0 ? `${days} ${t.common.days} ${t.common.and} ${hours} ${t.common.hours}` : `${hours} ${t.common.hours}`;

      Alert.alert(
        t.profile.waitABit,
        t.profile.canChangeCoverAfter.replace('{time}', timeText),
        [{ text: t.profile.okay, style: 'default' }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0]?.uri;
      if (!imageUri) {
        toast.showError(t.profile.error, t.profile.noValidImageSelected);
        return;
      }

      let finalUri = imageUri;
      try {
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

      const token = await getToken();
      if (!token) {
        setCoverImage(originalCover || null);
        toast.showError(t.profile.error, t.profile.pleaseLoginAgain);
        return;
      }

      const uploadResult = await StorageService.uploadCover(token, finalUri);

      if (uploadResult.success && uploadResult.url) {
        const newCoverUrl = uploadResult.url;
        setCoverImage(newCoverUrl);
        globalState.setLocalCover(newCoverUrl);
        await updateCachedUserData({ coverImage: newCoverUrl });
        refreshCache(false).catch(err => logger.error('Background refresh error:', err));
        toast.showSuccess(t.profile.success, t.profile.coverUploadSuccess);
      } else {
        setCoverImage(originalCover || null);
        toast.showError(t.profile.error, uploadResult.error || t.profile.coverUploadFailed);
      }
    } catch (error: any) {
      logger.error('Cover upload error:', error);
      setCoverImage(userData?.coverImage || null);
      toast.showError(t.profile.error, error.message || t.profile.uploadError);
    }
  };
  const handleImageUpload = async () => {
    if (!userData) {
      toast.showError(t.profile.error, t.profile.userDataNotAvailable);
      return;
    }

    if (cooldowns && !cooldowns.avatar.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.avatar.daysRemaining;
      const hours = cooldowns.avatar.hoursRemaining;
      const timeText = days > 0 ? `${days} ${t.common.days} ${t.common.and} ${hours} ${t.common.hours}` : `${hours} ${t.common.hours}`;

      Alert.alert(
        t.profile.waitABit,
        `${t.profile.canChangeAvatarAfter.replace('{time}', timeText)}`,
        [{ text: t.profile.okay, style: 'default' }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0]?.uri;
      if (!imageUri) {
        toast.showError(t.profile.error, t.profile.noValidImageSelected);
        return;
      }

      let finalUri = imageUri;
      try {
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

      const token = await getToken();
      if (!token) {
        setLocalImage(originalAvatar || null);
        setIsAvatarUploading(false);
        toast.showError(t.profile.error, t.profile.pleaseLoginAgain);
        return;
      }

      const uploadResult = await StorageService.uploadAvatar(token, finalUri);

      if (uploadResult.success && uploadResult.url) {
        const newAvatarUrl = uploadResult.url;
        setLocalImage(newAvatarUrl);

        if (globalState.userProfile) {
          globalState.userProfile.avatar = newAvatarUrl;
        }
        globalState.setLocalAvatar(newAvatarUrl);

        await updateCachedUserData({ avatar: newAvatarUrl });
        refreshCache(false).catch(err => logger.error('Background refresh error:', err));
        toast.showSuccess(t.profile.success, t.profile.avatarUploadSuccess);
      } else {
        setLocalImage(originalAvatar || null);
        toast.showError(t.profile.error, uploadResult.error || t.profile.avatarUploadFailed);
      }
    } catch (error: any) {
      logger.error('Avatar upload error:', error);
      setLocalImage(userData?.avatar || null);
      toast.showError(t.profile.error, error.message || t.profile.uploadError);
    } finally {
      setIsAvatarUploading(false);
    }
  };

  // Handle upload video function
  const handleUploadVideo = async (newVideo: any) => {
    if (!cooldowns) {
      await refreshCache(false);
      toast.showError(t.profile.error, t.profile.loadingUploadInfo);
      return;
    }

    if (!cooldowns.reelUpload.canChange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.reelUpload.daysRemaining;
      const hours = cooldowns.reelUpload.hoursRemaining;
      const timeText = days > 0 ? `${days} ${t.common.days} ${t.common.and} ${hours} ${t.common.hours}` : `${hours} ${t.common.hours}`;

      Alert.alert(
        t.profile.waitABit,
        t.profile.canUploadVideoAfter.replace('{time}', timeText),
        [{ text: t.profile.okay, style: 'default' }]
      );
      return;
    }

    setUserVideoData({
      username: userData?.username || 'user',
      avatar: localImage || userData?.avatar || null,
      displayName: userData?.displayName || userData?.username || 'User',
    });

    setActiveTab('videos');

    const tempVideo = {
      id: newVideo.id,
      uri: newVideo.uri,
      thumbnail: newVideo.thumbnail,
      createdAt: new Date(),
      isUploading: true,
      uploadProgress: 0,
    };
    addVideo(tempVideo);

    toast.showInfo(t.profile.loading, t.profile.uploadingInBackground);

    try {
      const token = await getToken();
      if (token) {
        const caption = newVideo.caption || '';
        const hashtags = caption.match(/#[\w\u0600-\u06FF]+/g) || [];
        const mentions = caption.match(/@[\w]+/g) || [];

        const uploadResult = await StorageService.uploadReel(
          token,
          newVideo.uri,
          newVideo.thumbnail,
          caption,
          hashtags.map((h: string) => h.replace('#', '')),
          mentions.map((m: string) => m.replace('@', '')),
          (progress: number) => {
            const updatedVideo = { ...tempVideo, uploadProgress: progress };
            removeVideo(tempVideo.id);
            addVideo(updatedVideo);
          }
        );

        if (uploadResult.success) {
          toast.showSuccess(t.profile.success, t.profile.videoUploadSuccess);
          removeVideo(newVideo.id);
          await refreshCache(true);
          if (userData?.username) {
            await loadVideos(userData.username);
          }
        } else {
          removeVideo(newVideo.id);
          toast.showError(t.profile.error, uploadResult.error || t.profile.videoUploadFailed);
        }
      }
    } catch (error: any) {
      logger.error('Video upload error:', error);
      removeVideo(newVideo.id);
      toast.showError(t.profile.error, error.message || t.profile.videoUploadError);
    }
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    await refreshCache(true);
    const token = await getToken();
    if (token) {
      fetchPredictionStats(token);
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
  if (isLoading && !userData) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />
        <ProfileSkeleton />
      </View>
    );
  }

  // CRITICAL FIX: Show error state with retry button if data failed to load
  if (!userData && (cacheError || !isLoading)) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />
        <Ionicons name="alert-circle-outline" size={64} color={ProfileTheme.colors.textSecondary} />
        <Text style={[styles.loadingText, { marginTop: 16, textAlign: 'center', paddingHorizontal: 40 }]}>
          {cacheError || t.profile.profileLoadFailed}
        </Text>
        <Text style={[styles.loadingText, { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40, color: 'rgba(255,255,255,0.5)' }]}>
          {cacheError?.includes('المحفوظة') ? t.profile.serverDown : t.profile.checkConnection}
        </Text>
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
              try {
                await refreshCache(true);
                toast.showInfo(t.profile.loading, t.profile.reloadingData);
              } catch (err) {
                console.error('[ProfileScreen] ❌ Manual retry failed:', err);
                toast.showError(t.profile.error, t.profile.retryFailed);
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
          onEditPress={() => setIsUploadModalVisible(true)}
          onSharePress={async () => {
            try {
              await Share.share({
                message: `${t.profile.checkMyProfile} @${userData?.username}\nhttps://90plus.app/@${userData?.username}`,
              });
            } catch (error) {
              logger.warn('Share error:', error);
            }
          }}
          onQRPress={() => setIsQRModalVisible(true)}
          uploadCooldown={cooldowns?.reelUpload}
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
              Alert.alert(
                t.profile.deleteVideo,
                t.profile.confirmDeleteVideo,
                [
                  { text: t.profile.cancel, style: 'cancel' },
                  {
                    text: t.profile.delete,
                    style: 'destructive',
                    onPress: () => removeVideo(videoId)
                  }
                ]
              );
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
          setLocation(country.name);
          setIsCountryModalVisible(false);
          
          // Send to backend with optimistic updates
          await updateFIFACard({ countryFlag: country.flag });
        }}
        selectedCountryCode={countryFlag}
      />

      <PositionPickerModal
        visible={isPositionModalVisible}
        onClose={() => setIsPositionModalVisible(false)}
        onSelect={async (pos) => {
          // Optimistic update - UI changes immediately
          setPosition(pos);
          setIsPositionModalVisible(false);
          
          // Send to backend with optimistic updates
          await updateFIFACard({ position: pos });
        }}
        selectedPosition={position}
      />

      <ClubPickerModal
        visible={isClubModalVisible}
        onClose={() => setIsClubModalVisible(false)}
        onSelect={async (selectedClub) => {
          // Optimistic update - UI changes immediately
          setClub(selectedClub.logo);
          
          // Update cached data and global state immediately
          updateCachedUserData({ 
            clubLogo: selectedClub.logo,
            favoriteTeam: selectedClub.name 
          });
          
          // Update global state for immediate UI refresh
          if (globalState.userProfile) {
            globalState.setUserProfile({
              ...globalState.userProfile,
              clubLogo: selectedClub.logo,
              favoriteTeam: selectedClub.name
            });
          }
          
          setIsClubModalVisible(false);
          
          // Send to backend with optimistic updates
          await updateFavorites({ 
            favoriteClub: selectedClub.name,
            favoriteTeam: selectedClub.name 
          });
        }}
      />

      <BrandPickerModal
        visible={isBrandModalVisible}
        onClose={() => setIsBrandModalVisible(false)}
        onSelect={async (selectedBrand) => {
          // Optimistic update - UI changes immediately
          setBrand(selectedBrand.logo);
          updateCachedUserData({ brandLogo: selectedBrand.logo });
          setIsBrandModalVisible(false);
          
          // Send to backend with optimistic updates
          await updateFavorites({ favoriteBrand: selectedBrand.name });
        }}
      />

      <StatsEditModal
        visible={isStatsModalVisible}
        onClose={() => setIsStatsModalVisible(false)}
        onSave={async (newStats) => {
          // Optimistic update - UI changes immediately
          setStats(newStats);
          setIsStatsModalVisible(false);
          
          // Send to backend with optimistic updates
          await updateFIFACard({
            age: parseInt(newStats.age) || undefined,
            height: parseInt(newStats.height) || undefined,
            weight: parseInt(newStats.weight) || undefined,
            preferredFoot: newStats.foot === 'R' ? 'Right' : newStats.foot === 'L' ? 'Left' : newStats.foot === 'B' ? 'Both' : undefined
          });
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
          socials: [],
          lastUsernameChange: userData?.lastUsernameChange || undefined
        }}
        onSave={async (newData) => {
          // Close modal immediately
          setIsEditProfileModalVisible(false);
          
          // Prepare updates object
          const updates: any = {};
          
          if (newData.name !== userData?.displayName) {
            updates.displayName = newData.name;
          }
          
          if (newData.username !== userData?.username) {
            updates.username = newData.username;
          }
          
          if (newData.bio !== userData?.bio) {
            updates.bio = newData.bio;
          }
          
          // Handle social links if they exist
          if (newData.socials && newData.socials.length > 0) {
            const socialLinks: any = {};
            newData.socials.forEach((social: any) => {
              if (social.platform && social.url) {
                socialLinks[social.platform.toLowerCase()] = social.url;
              }
            });
            if (Object.keys(socialLinks).length > 0) {
              updates.socialLinks = socialLinks;
            }
          }
          
          // Send updates if there are any changes
          if (Object.keys(updates).length > 0) {
            if (updates.username) {
              // Update UI immediately before sending to backend
              updateCachedUserData({ username: updates.username });
              await updateUsername(updates.username);
              delete updates.username; // Remove from batch update
            }
            
            if (updates.displayName) {
              // Update UI immediately before sending to backend
              updateCachedUserData({ displayName: updates.displayName });
              await updateDisplayName(updates.displayName);
              delete updates.displayName;
            }
            
            if (updates.bio) {
              // Update UI immediately before sending to backend
              updateCachedUserData({ bio: updates.bio });
              await updateBio(updates.bio);
              delete updates.bio;
            }
            
            if (updates.socialLinks) {
              await updateSocialLinks(updates.socialLinks);
            }
          }
        }}
        usernameCooldown={cooldowns?.username}
      />

      <ReelUploadModal
        visible={isUploadModalVisible}
        onClose={() => setIsUploadModalVisible(false)}
        onUpload={(newVideo) => {
          addVideo(newVideo);
          setIsUploadModalVisible(false);
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