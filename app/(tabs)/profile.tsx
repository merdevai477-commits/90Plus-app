import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Text, Share, Alert, ActionSheetIOS, Platform, RefreshControl, AppState, AppStateStatus } from 'react-native';
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
import { logger } from '../../utils/logger';

const API_URL = getApiUrl();

import CountryPickerModal from '../../components/common/CountryPickerModal';
import PositionPickerModal from '../../components/common/PositionPickerModal';
import ClubPickerModal from '../../components/common/ClubPickerModal';
import BrandPickerModal from '../../components/common/BrandPickerModal';
import StatsEditModal, { Stats } from '../../components/common/StatsEditModal';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';
import FollowersListModal from '../../components/profile/FollowersListModal';
import QRCodeModal from '../../components/profile/QRCodeModal';
import SocialLinksSection from '../../components/profile/SocialLinksSection';
import { Club } from '../../data/clubs'; // ✅ Import Club type with apiId

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

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState('videos');
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();

  // Prevent guest access - redirect to auth
  useEffect(() => {
    if (!isSignedIn) {
      router.replace('/auth');
    }
  }, [isSignedIn]);
  const { uploadedVideos, addVideo, setUserVideoData, removeVideo, reelComments, addComment, toggleCommentLike } = useVideos();
  const toast = useToast();
  const { t } = useTranslation();

  // Use the profile cache hook for cache-first loading (Requirements 2.1, 2.2, 2.3, 2.5, 2.6)
  const {
    userData: cachedUserData,
    followStats: cachedFollowStats,
    videos: cachedVideos,
    analytics: cachedAnalytics,
    cooldowns: cachedCooldowns,
    isLoading,
    isRefreshing,
    isCacheHit,
    refresh: refreshCache,
    loadVideos,
    updateUserData: updateCachedUserData,
    updateFollowStats: updateCachedFollowStats,
  } = useProfileCache({
    getToken,
    clerkUserImageUrl: clerkUser?.imageUrl,
  });

  // Local state for UI-specific data not in cache
  const [localImage, setLocalImageState] = useState<string | null>(globalState.localAvatar || null);
  const setLocalImage = (image: string | null) => {
    setLocalImageState(image);
    globalState.setLocalAvatar(image || undefined);
  };

  const [countryFlag, setCountryFlag] = useState<string>(DEFAULT_COUNTRY_FLAG);
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
  
  // New modals for profile features
  const [isFollowersModalVisible, setIsFollowersModalVisible] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);

  // Cover image state
  const [coverImage, setCoverImageState] = useState<string | null>(globalState.localCover || null);
  const setCoverImage = (image: string | null) => {
    setCoverImageState(image);
    globalState.setLocalCover(image || undefined);
  };

  // Video Management State
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // Token state for BadgesDisplay
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  // Fetch token for badges
  useEffect(() => {
    const fetchToken = async () => {
      const token = await getToken();
      setAuthToken(token);
    };
    fetchToken();
  }, [getToken]);

  // Derive state from cache
  const userData = cachedUserData;
  const followStats = cachedFollowStats || { followersCount: 0, followingCount: 0, reelsCount: 0 };

  // Helper function to validate and get token
  const getValidatedToken = async (): Promise<string | null> => {
    if (!userData) {
      toast.showError('خطأ', 'بيانات المستخدم غير متوفرة');
      return null;
    }
    const token = await getToken();
    if (!token) {
      toast.showError('خطأ', 'يرجى تسجيل الدخول مرة أخرى');
      return null;
    }
    return token;
  };

  // Merge cached videos with uploaded videos from context (for optimistic updates)
  // Saved videos state
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [savedVideosCursor, setSavedVideosCursor] = useState<string | null>(null);
  const [hasMoreSaved, setHasMoreSaved] = useState(true);

  // Load saved videos
  const loadSavedVideos = useCallback(async (cursor?: string) => {
    setIsLoadingSaved(true);
    try {
      const token = await getToken();
      if (!token) return;

      const result = await ReelsService.getSavedReels(token, cursor);
      if (result) {
        if (cursor) {
          // Append to existing
          setSavedVideos(prev => [...prev, ...result.savedReels]);
        } else {
          // Replace
          setSavedVideos(result.savedReels);
        }
        setSavedVideosCursor(result.nextCursor);
        setHasMoreSaved(result.hasMore);
      }
    } catch (error) {
      console.error('Error loading saved videos:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  }, [getToken]);

  // Load saved videos when saved tab is active
  useEffect(() => {
    if (activeTab === 'saved' && savedVideos.length === 0 && !isLoadingSaved) {
      loadSavedVideos();
    }
  }, [activeTab, savedVideos.length, isLoadingSaved, loadSavedVideos]);

  const myVideos = React.useMemo(() => {
    const cached = cachedVideos || [];
    const uploaded = uploadedVideos || [];
    
    // Combine both, prioritizing uploaded videos (they have isUploading flag)
    const allVideos = [...uploaded, ...cached];
    
    // Remove duplicates by id, keeping uploaded ones first
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

  // Fetch prediction stats when authenticated
  useEffect(() => {
    const loadPredictionStats = async () => {
      const token = await getToken();
      if (token) {
        fetchPredictionStats(token);
      }
    };
    loadPredictionStats();
  }, []);

  // Sync local state with cached data when it changes
  useEffect(() => {
    if (userData) {
      // Update local state from cached user data
      if (userData.position) setPosition(userData.position);
      if (userData.countryFlag) setCountryFlag(userData.countryFlag);
      if (userData.avatar) {
        setLocalImage(userData.avatar);
        globalState.setLocalAvatar(userData.avatar);
      }
      if (userData.coverImage) {
        setCoverImage(userData.coverImage);
      }
      // ✅ Load club logo from userData (saved from previous selection)
      if (userData.clubLogo) {
        setClub(userData.clubLogo);
      } else if (userData.favoriteTeam) {
        // If favoriteTeam exists but no logo, try to fetch it
        // Find club by name and fetch logo
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
                // Update cache with fetched logo
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

      // Update stats if available
      if (userData.age || userData.height || userData.weight || userData.preferredFoot) {
        setStats({
          age: userData.age?.toString() || DEFAULT_STATS.age,
          height: userData.height?.toString() || DEFAULT_STATS.height,
          weight: userData.weight?.toString() || DEFAULT_STATS.weight,
          foot: (userData.preferredFoot as 'R' | 'L' | 'B') || DEFAULT_STATS.foot,
        });
      }

      // Update globalState
      globalState.username = userData.username;
    }
  }, [userData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ref to store refreshCache to avoid dependency issues
  const refreshCacheRef = useRef(refreshCache);
  refreshCacheRef.current = refreshCache;

  // Refresh on focus - use cache hook's refresh
  useFocusEffect(
    useCallback(() => {
      // Background refresh when screen is focused (won't show loading if cache exists)
      refreshCacheRef.current(false);
    }, []) // Empty deps - uses ref
  );

  // Auto-refresh when app returns from background
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Refresh profile data silently
        refreshCacheRef.current(false);
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []); // Empty deps - uses ref

  const handleCoverPress = () => {
    const options = ['عرض الصورة', 'تغيير الصورة', 'إلغاء'];
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
        'صورة الغلاف',
        'ماذا تريد أن تفعل؟',
        [
          { text: 'عرض الصورة', onPress: () => handlePress(0) },
          { text: 'تغيير الصورة', onPress: () => handlePress(1) },
          { text: 'إلغاء', style: 'cancel' },
        ]
      );
    }
  };

  const handleCoverUpload = async () => {
    // Validate userData exists
    if (!userData) {
      toast.showError('خطأ', 'بيانات المستخدم غير متوفرة');
      return;
    }

    // Check cooldown first
    if (cooldowns && !cooldowns.cover.canChange) {
      // Haptic feedback for warning
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.cover.daysRemaining;
      const hours = cooldowns.cover.hoursRemaining;
      const timeText = days > 0 ? `${days} يوم و ${hours} ساعة` : `${hours} ساعة`;

      Alert.alert(
        '⏳ انتظر قليلاً',
        `يمكنك تغيير صورة الغلاف بعد ${timeText}`,
        [{ text: 'حسناً', style: 'default' }]
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
        toast.showError('خطأ', 'لم يتم اختيار صورة صحيحة');
        return;
      }

      // Store original cover for revert
      const originalCover = userData.coverImage;

      // Optimistic UI - show immediately
      setCoverImage(imageUri);

      // Get token
      const token = await getToken();
      if (!token) {
        // Revert on no token
        setCoverImage(originalCover || null);
        toast.showError('خطأ', 'يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      // Upload to backend
      const uploadResult = await StorageService.uploadCover(token, imageUri);

      if (uploadResult.success && uploadResult.url) {
        // Update with backend URL immediately
        const newCoverUrl = uploadResult.url;
        setCoverImage(newCoverUrl);
        
        // Update globalState
        globalState.setLocalCover(newCoverUrl);
        
        // Update userData via cache immediately
        await updateCachedUserData({ coverImage: newCoverUrl });
        
        // Force refresh cache to get latest data from backend
        await refreshCache(true);
        
        toast.showSuccess('تم', 'تم رفع صورة الغلاف بنجاح');
      } else {
        // Revert on error
        setCoverImage(originalCover || null);
        toast.showError('خطأ', uploadResult.error || 'فشل في رفع صورة الغلاف');
      }
    } catch (error: any) {
      logger.error('Cover upload error:', error);
      // Revert to original cover
      setCoverImage(userData?.coverImage || null);
      toast.showError('خطأ', error.message || 'حدث خطأ أثناء الرفع');
    }
  };

  const handleImageUpload = async () => {
    // Validate userData exists
    if (!userData) {
      toast.showError('خطأ', 'بيانات المستخدم غير متوفرة');
      return;
    }

    // Check cooldown first
    if (cooldowns && !cooldowns.avatar.canChange) {
      // Haptic feedback for warning
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.avatar.daysRemaining;
      const hours = cooldowns.avatar.hoursRemaining;
      const timeText = days > 0 ? `${days} يوم و ${hours} ساعة` : `${hours} ساعة`;

      Alert.alert(
        '⏳ انتظر قليلاً',
        `يمكنك تغيير صورة البروفايل بعد ${timeText}`,
        [{ text: 'حسناً', style: 'default' }]
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
        toast.showError('خطأ', 'لم يتم اختيار صورة صحيحة');
        return;
      }

      // Store original avatar for revert
      const originalAvatar = userData.avatar;

      // Optimistic UI - show immediately
      setLocalImage(imageUri);

      // Get token
      const token = await getToken();
      if (!token) {
        // Revert on no token
        setLocalImage(originalAvatar || null);
        toast.showError('خطأ', 'يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      // Upload to backend
      const uploadResult = await StorageService.uploadAvatar(token, imageUri);

      if (uploadResult.success && uploadResult.url) {
        // Update with backend URL immediately
        const newAvatarUrl = uploadResult.url;
        setLocalImage(newAvatarUrl);

        // Update globalState
        if (globalState.userProfile) {
          globalState.userProfile.avatar = newAvatarUrl;
        }
        globalState.setLocalAvatar(newAvatarUrl);

        // Update userData via cache immediately
        await updateCachedUserData({ avatar: newAvatarUrl });

        // Force refresh cache to get latest data from backend
        await refreshCache(true);

        toast.showSuccess('تم', 'تم رفع صورة البروفايل بنجاح');
      } else {
        // Revert local image on error
        setLocalImage(originalAvatar || null);
        toast.showError('خطأ', uploadResult.error || 'فشل في رفع الصورة');
      }
    } catch (error: any) {
      logger.error('Avatar upload error:', error);
      // Revert to original avatar
      setLocalImage(userData?.avatar || null);
      toast.showError('خطأ', error.message || 'حدث خطأ أثناء الرفع');
    }
  };

  const handleCountrySelect = async (country: Country) => {
    if (!country?.flag || !country?.name) {
      toast.showError('خطأ', 'بيانات البلد غير صحيحة');
      return;
    }

    const token = await getValidatedToken();
    if (!token) return;

    try {
      // Optimistic update
      setCountryFlag(country.flag);
      await updateCachedUserData({ location: country.name });

      // Save to backend
      await CardProfileService.updateCardProfile(token, { countryFlag: country.flag });
    } catch (error: any) {
      logger.error('Error saving country:', error);
      toast.showError('خطأ', error.message || 'فشل في حفظ البلد');
    }
  };

  const handlePositionSelect = async (pos: string) => {
    if (!pos || pos.trim() === '') {
      toast.showError('خطأ', 'المركز غير صحيح');
      return;
    }

    const token = await getValidatedToken();
    if (!token) return;

    try {
      // Optimistic update
      setPosition(pos);

      // Save to backend
      await CardProfileService.updateCardProfile(token, { position: pos });
    } catch (error: any) {
      logger.error('Error saving position:', error);
      toast.showError('خطأ', error.message || 'فشل في حفظ المركز');
    }
  };

  const handleClubSelect = async (selectedClub: Club) => {
    if (!selectedClub?.name) {
      toast.showError('خطأ', 'بيانات النادي غير صحيحة');
      return;
    }

    const token = await getValidatedToken();
    if (!token) return;

    try {
      // ✅ Always fetch fresh logo from API to ensure it's real and up-to-date
      let clubLogo = selectedClub.logo;
      if (selectedClub.apiId) {
        const { getClubLogo } = await import('../../services/clubLogoService');
        const logo = await getClubLogo(selectedClub.apiId);
        if (logo) {
          clubLogo = logo;
          // Update club object for future use
          selectedClub.logo = logo;
        } else if (!clubLogo) {
          // If API fetch failed and no cached logo, show error
          toast.showError('خطأ', 'لم يتم العثور على شعار النادي من API');
          return;
        }
      }

      if (!clubLogo) {
        toast.showError('خطأ', 'لم يتم العثور على شعار النادي');
        return;
      }

      // ✅ Optimistic update - update UI immediately
      setClub(clubLogo);
      
      // ✅ Update cached user data immediately (for instant UI update)
      await updateCachedUserData({ 
        favoriteTeam: selectedClub.name,
        clubLogo: clubLogo // ✅ Save logo URL with user data
      });

      // ✅ Save to backend (persistent storage)
      const result = await CardProfileService.updateCardProfile(token, {
        clubLogo: clubLogo,
        favoriteTeam: selectedClub.name
      });

      // ✅ If backend save successful, ensure cache is updated
      if (result.success && result.data) {
        await updateCachedUserData({
          favoriteTeam: result.data.favoriteTeam || selectedClub.name,
          clubLogo: result.data.clubLogo || clubLogo
        });
      }
      
      toast.showSuccess('تم', `تم حفظ ${selectedClub.name} بنجاح`);
    } catch (error: any) {
      logger.error('Error saving club:', error);
      toast.showError('خطأ', error.message || 'فشل في حفظ النادي');
    }
  };

  const handleBrandSelect = async (selectedBrand: Brand) => {
    if (!selectedBrand?.logo) {
      toast.showError('خطأ', 'بيانات البراند غير صحيحة');
      return;
    }

    const token = await getValidatedToken();
    if (!token) return;

    try {
      // ✅ Validate logo is a valid URL
      if (!selectedBrand.logo.startsWith('http')) {
        toast.showError('خطأ', 'شعار البراند غير صحيح');
        return;
      }

      // ✅ Optimistic update - update UI immediately
      setBrand(selectedBrand.logo);
      
      // ✅ Update cached user data immediately (for instant UI update)
      await updateCachedUserData({ 
        brandLogo: selectedBrand.logo // ✅ Save logo URL with user data
      });

      // ✅ Save to backend (persistent storage)
      const result = await CardProfileService.updateCardProfile(token, { 
        brandLogo: selectedBrand.logo 
      });

      // ✅ If backend save successful, ensure cache is updated
      if (result.success && result.data) {
        await updateCachedUserData({
          brandLogo: result.data.brandLogo || selectedBrand.logo
        });
      }
      
      toast.showSuccess('تم', `تم حفظ ${selectedBrand.name} بنجاح`);
    } catch (error: any) {
      logger.error('Error saving brand:', error);
      toast.showError('خطأ', error.message || 'فشل في حفظ البراند');
    }
  };

  const handleStatsSave = async (newStats: Stats) => {
    // Validate stats
    const age = parseInt(newStats.age);
    const height = parseInt(newStats.height);
    const weight = parseInt(newStats.weight);

    if (isNaN(age) || age < 15 || age > 60) {
      toast.showError('خطأ', 'العمر يجب أن يكون بين 15 و 60 سنة');
      return;
    }

    if (isNaN(height) || height < 120 || height > 250) {
      toast.showError('خطأ', 'الطول يجب أن يكون بين 120 و 250 سم');
      return;
    }

    if (isNaN(weight) || weight < 40 || weight > 150) {
      toast.showError('خطأ', 'الوزن يجب أن يكون بين 40 و 150 كجم');
      return;
    }

    if (!['R', 'L', 'B'].includes(newStats.foot)) {
      toast.showError('خطأ', 'القدم المفضلة غير صحيحة');
      return;
    }

    const token = await getValidatedToken();
    if (!token) return;

    try {
      // Optimistic update
      setStats(newStats);

      // Save to backend
      await CardProfileService.updateCardProfile(token, {
        age,
        height,
        weight,
        preferredFoot: newStats.foot,
      });

      toast.showSuccess('تم', 'تم حفظ البيانات بنجاح');
    } catch (error: any) {
      logger.error('Error saving stats:', error);
      toast.showError('خطأ', error.message || 'فشل في حفظ البيانات');
    }
  };

  const handleUploadVideo = async (newVideo: any) => {
    // Check cooldown first - if cooldowns not loaded, refresh and block
    if (!cooldowns) {
      // Try to refresh cooldowns first
      await refreshCache(false);
      toast.showError('خطأ', 'جاري تحميل معلومات الرفع، يرجى المحاولة مرة أخرى');
      return;
    }

    // Check if cooldown is active
    if (!cooldowns.reelUpload.canChange) {
      // Haptic feedback for warning
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const days = cooldowns.reelUpload.daysRemaining;
      const hours = cooldowns.reelUpload.hoursRemaining;
      const timeText = days > 0 ? `${days} يوم و ${hours} ساعة` : `${hours} ساعة`;

      Alert.alert(
        '⏳ انتظر قليلاً',
        `يمكنك رفع فيديو جديد بعد ${timeText}`,
        [{ text: 'حسناً', style: 'default' }]
      );
      return;
    }

    // Update user data in context for reels page
    setUserVideoData({
      username: userData?.username || 'user',
      avatar: localImage || userData?.avatar || null,
      displayName: userData?.displayName || userData?.username || 'User',
    });

    setActiveTab('videos');

    // OPTIMISTIC: Add video to context immediately (shows in UI instantly)
    const tempVideo = {
      id: newVideo.id,
      uri: newVideo.uri,
      thumbnail: newVideo.thumbnail,
      createdAt: new Date(),
      isUploading: true,
      uploadProgress: 0,
    };
    addVideo(tempVideo);

    // Show uploading toast
    toast.showInfo('جاري الرفع', 'يتم رفع الفيديو في الخلفية...');

    // Upload to backend in background (non-blocking)
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          // Update progress: Preparing (10%)
          const updateProgress = (progress: number) => {
            const updatedVideo = {
              ...tempVideo,
              uploadProgress: progress,
            };
            // Update in context
            removeVideo(tempVideo.id);
            addVideo(updatedVideo);
          };

          updateProgress(10);

          // Extract hashtags and mentions from caption if any
          const caption = newVideo.caption || '';
          const hashtags = caption.match(/#[\w\u0600-\u06FF]+/g) || [];
          const mentions = caption.match(/@[\w]+/g) || [];

          updateProgress(30);

          const uploadResult = await StorageService.uploadReel(
            token,
            newVideo.uri,
            newVideo.thumbnail,
            caption,
            hashtags.map((h: string) => h.replace('#', '')),
            mentions.map((m: string) => m.replace('@', '')),
            updateProgress // Pass progress callback
          );

          // Check for cooldown error from backend
          if (!uploadResult.success) {
            // Remove optimistic video on failure
            removeVideo(newVideo.id);
            
            // Check if it's a cooldown error
            if (uploadResult.error?.includes('ساعة') || uploadResult.error?.includes('cooldown')) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(
                '⏳ انتظر قليلاً',
                uploadResult.error || 'لا يمكنك رفع فيديو جديد الآن',
                [{ text: 'حسناً', style: 'default' }]
              );
            } else {
              toast.showError('خطأ', uploadResult.error || 'فشل في رفع الفيديو');
            }
            
            // Refresh cooldowns to get latest status
            await refreshCache(true);
            return;
          }

          if (uploadResult.success) {
            // Only update to 100% if not already at 100% (avoid duplicate calls)
            updateProgress(100);
            
            // Small delay to show 100% completion
            await new Promise(resolve => setTimeout(resolve, 500));
            
            toast.showSuccess('تم', 'تم رفع الفيديو بنجاح! 🚀');
            
            // Remove optimistic video and refresh to get real video from server
            removeVideo(newVideo.id);
            
            // Force refresh to get the real video data from server including cooldowns
            await refreshCache(true);
            
            // Also reload videos specifically
            if (userData?.username) {
              await loadVideos(userData.username);
            }
          } else {
            // Remove optimistic video on failure
            removeVideo(newVideo.id);
            toast.showError('خطأ', uploadResult.error || 'فشل في رفع الفيديو');
          }
        }
      } catch (error: any) {
        logger.error('Video upload error:', error);
        // Remove optimistic video on failure
        removeVideo(newVideo.id);
        toast.showError('خطأ', error.message || 'حدث خطأ أثناء رفع الفيديو');
      }
    })();
  };

  const handleVideoPress = (video: any, _index: number) => {
    if (isDeleteMode) {
      handleDeleteVideo(video.id);
    } else {
      // Open video player modal
      setSelectedVideoUrl(video.uri);
      setIsVideoPlayerVisible(true);
    }
  };

  const handleVideoLongPress = (_video: any) => {
    setIsDeleteMode(prev => !prev);
  };

  const handleDeleteVideo = (videoId: string) => {
    // Requirements 13.4, 13.5, 13.6, 13.7: Show remaining deletes and handle limits
    const maxDeletes = 2;
    const deletesUsed = cooldowns?.reelDelete?.deletesUsed ?? 0;
    const remainingDeletes = Math.max(0, maxDeletes - deletesUsed);

    // Check if already at limit before showing dialog
    if (remainingDeletes === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        '⛔ الحد الأقصى',
        'لقد وصلت للحد الأقصى من مسح الفيديوهات (2 مرات)',
        [{ text: 'حسناً', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'حذف الفيديو',
      `هل أنت متأكد من حذف هذا الفيديو؟\n\n⚠️ تنبيه: متبقي لك ${remainingDeletes} عمليات حذف من أصل ${maxDeletes}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (token) {
                const response = await fetch(`${API_URL}/videos/${videoId}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                });
                
                if (!response.ok) {
                  const errorData = await response.json();
                  if (errorData.code === 'MAX_DELETES_REACHED') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert(
                      '⛔ الحد الأقصى',
                      'لقد وصلت للحد الأقصى من مسح الفيديوهات (2 مرات)',
                      [{ text: 'حسناً', style: 'default' }]
                    );
                  } else {
                    toast.showError('خطأ', errorData.message || 'فشل في حذف الفيديو');
                  }
                  // Refresh cooldowns
                  await refreshCache(false);
                  return;
                }
                
                const data = await response.json();
                if (data.status === 'SUCCESS') {
                  const newRemainingDeletes = data.data?.remainingDeletes;
                  const uploadCooldownReset = data.data?.uploadCooldownReset;

                  // Build success message (Requirement 13.7)
                  let message = 'تم حذف الفيديو بنجاح';
                  if (newRemainingDeletes !== undefined) {
                    message += `\nمتبقي لك ${newRemainingDeletes} عمليات حذف`;
                  }
                  // Requirement 13.4: Notify user that upload is now available
                  if (uploadCooldownReset) {
                    message += '\n✅ يمكنك الآن رفع فيديو جديد!';
                  }

                  toast.showSuccess('تم', message);
                  // Refresh videos, stats, and cooldowns from backend (updates upload button state)
                  await refreshCache(false);
                  // Also remove from context
                  removeVideo(videoId);
                } else if (data.code === 'MAX_DELETES_REACHED') {
                  // Haptic feedback for error
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert(
                    '⛔ الحد الأقصى',
                    'لقد وصلت للحد الأقصى من مسح الفيديوهات (2 مرات)',
                    [{ text: 'حسناً', style: 'default' }]
                  );
                } else {
                  toast.showError('خطأ', data.message || 'فشل في حذف الفيديو');
                }
              }
            } catch (error: any) {
              logger.error('Delete video error:', error);
              toast.showError('خطأ', error.message || 'حدث خطأ أثناء الحذف');
            }
          }
        }
      ]
    );
  };



  // Pull to refresh handler - uses cache hook's refresh with force flag
  const onRefresh = async () => {
    await refreshCache(true);
    // Also refresh prediction stats
    const token = await getToken();
    if (token) {
      fetchPredictionStats(token);
    }
  };

  const handleEditProfile = () => {
    setIsEditProfileModalVisible(true);
  };

  const handleSaveProfile = async (newData: any) => {
    try {
      const token = await getToken();
      if (!token) {
        toast.showError('خطأ', 'يرجى تسجيل الدخول مرة أخرى');
        return;
      }

      // ✅ OPTIMISTIC UPDATE: Update UI immediately before backend calls
      const previousUserData = { ...userData };
      
      // Update cached user data immediately (optimistic update)
      await updateCachedUserData({
        displayName: newData.name,
        username: newData.username,
        bio: newData.bio,
        lastUsernameChange: newData.username !== userData?.username ? new Date() : userData?.lastUsernameChange,
        socialLinks: newData.socials || [],
      });

      // Update globalState immediately
      if (globalState.userProfile) {
        globalState.userProfile.username = newData.username;
        globalState.userProfile.displayName = newData.name;
        globalState.userProfile.bio = newData.bio;
      }
      globalState.username = newData.username;

      // Check if username is being changed (Requirements 12.1, 12.2, 12.3)
      const usernameChanged = newData.username !== previousUserData?.username;

      // Send updates to backend in background (non-blocking)
      Promise.all([
        // Update username if changed
        usernameChanged ? AuthService.updateUsername(token, newData.username).catch((error) => {
          logger.error('Error updating username:', error);
          // Revert on error
          updateCachedUserData(previousUserData);
          if (error.daysRemaining !== undefined) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
              '⏳ انتظر قليلاً',
              `يمكنك تغيير اسم المستخدم بعد ${error.daysRemaining} يوم`,
              [{ text: 'حسناً', style: 'default' }]
            );
          } else {
            toast.showError('خطأ', error.error || 'فشل في تغيير اسم المستخدم');
          }
          throw error;
        }) : Promise.resolve({ success: true }),
        
        // Update profile
        AuthService.updateProfile(token, {
          displayName: newData.name,
          bio: newData.bio,
        }).catch((error) => {
          logger.error('Error updating profile:', error);
          // Revert on error
          updateCachedUserData(previousUserData);
          toast.showError('خطأ', error.message || 'فشل في حفظ التغييرات');
          throw error;
        }),
        
        // Update social links in background
        newData.socials && Array.isArray(newData.socials) 
          ? ProfileService.updateSocialLinks(token, newData.socials).catch((error) => {
              logger.error('Error updating social links:', error);
              // Don't revert social links on error - they're already shown
              // Just log the error silently
              return { success: false };
            })
          : Promise.resolve({ success: true })
      ]).then(async ([usernameResult, profileResult, socialLinksResult]) => {
        // All backend calls completed successfully
        // Refresh cache to get latest data from backend (including cooldowns)
        await refreshCache(true);
        
        // Show success message
        toast.showSuccess('تم', 'تم حفظ التغييرات بنجاح');
      }).catch((error) => {
        // Error already handled in individual catch blocks
        // Just ensure we don't show duplicate errors
      });
    } catch (error: any) {
      logger.error('Error saving profile:', error);
      toast.showError('خطأ', error.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  // ✅ CRITICAL: Compute social links BEFORE early returns to avoid hooks count mismatch
  const socialLinks = useMemo(() => {
    // Read from socialLinks (new format) or fallback to socials (old format)
    if (userData?.socialLinks && Array.isArray(userData.socialLinks) && userData.socialLinks.length > 0) {
      return userData.socialLinks.map((link: any) => ({
        platform: link.platform || 'website',
        url: link.url || '',
        username: link.username,
      })).filter((link: any) => link.url && link.url.trim() !== '');
    }
    
    // Fallback to old format (socials object) for backward compatibility
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

      <CountryPickerModal
        visible={isCountryModalVisible}
        onClose={() => setIsCountryModalVisible(false)}
        onSelect={handleCountrySelect}
        selectedCountryCode={countryFlag}
      />

      <PositionPickerModal
        visible={isPositionModalVisible}
        onClose={() => setIsPositionModalVisible(false)}
        onSelect={handlePositionSelect}
        selectedPosition={position}
      />

      <ClubPickerModal
        visible={isClubModalVisible}
        onClose={() => setIsClubModalVisible(false)}
        onSelect={handleClubSelect}
      />

      <BrandPickerModal
        visible={isBrandModalVisible}
        onClose={() => setIsBrandModalVisible(false)}
        onSelect={handleBrandSelect}
      />

      <StatsEditModal
        visible={isStatsModalVisible}
        onClose={() => setIsStatsModalVisible(false)}
        onSave={handleStatsSave}
        initialStats={stats}
      />

      <ProfileEditModal
        visible={isEditProfileModalVisible}
        onClose={() => setIsEditProfileModalVisible(false)}
        initialData={{
          name: userData?.displayName || userData?.username || 'User',
          username: userData?.username || 'user',
          bio: userData?.bio || '',
          socials: (userData?.socialLinks && Array.isArray(userData.socialLinks)) 
            ? userData.socialLinks.map((link: any) => ({
                platform: link.platform || 'website',
                url: link.url || '',
              }))
            : [],
          lastUsernameChange: userData?.lastUsernameChange || undefined
        }}
        onSave={handleSaveProfile}
        usernameCooldown={cooldowns?.username}
      />

      <ReelUploadModal
        visible={isUploadModalVisible}
        onClose={() => setIsUploadModalVisible(false)}
        onUpload={handleUploadVideo}
      />

      <VideoPlayerModal
        visible={isVideoPlayerVisible}
        videoUrl={selectedVideoUrl}
        onClose={() => setIsVideoPlayerVisible(false)}
        userImage={localImage}
        username={userData?.username || 'user'}
        reelId={selectedVideoUrl}
        comments={reelComments[selectedVideoUrl || ''] || []}
        onAddComment={(comment: Comment) => { if (selectedVideoUrl) addComment(selectedVideoUrl, comment); }}
        onToggleLike={(commentId: string) => { if (selectedVideoUrl) toggleCommentLike(selectedVideoUrl, commentId); }}
      />

      <ImageViewerModal
        visible={isImageViewerVisible}
        imageUrl={coverImage || 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=2070&auto=format&fit=crop'}
        onClose={() => setIsImageViewerVisible(false)}
      />

      {/* Followers/Following List Modal */}
      <FollowersListModal
        visible={isFollowersModalVisible}
        onClose={() => setIsFollowersModalVisible(false)}
        userId={userData?.id || ''}
        initialTab={followersModalTab}
        username={userData?.username}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        visible={isQRModalVisible}
        onClose={() => setIsQRModalVisible(false)}
        username={userData?.username || 'user'}
        displayName={userData?.displayName || undefined}
        avatar={localImage || userData?.avatar}
      />

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
            playerImage={localImage ? { uri: localImage } : (userData?.avatar ? { uri: userData.avatar } : { uri: 'https://picsum.photos/200' })}
            cardType="gold"
            scale={0.60}
            onImageUpload={handleImageUpload}
            uploadedImage={localImage}
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
          />
        </View>

        <UserInfo
          name={userData?.displayName || userData?.username || 'User'}
          username={userData?.username || 'user'}
          bio={userData?.bio}
          location={userData?.location || 'مصر'}
          team={userData?.favoriteTeam || t.profile.chooseClub}
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

        {/* Badges Display - الميداليات */}
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
            onVideoPress={handleVideoPress}
            onVideoLongPress={handleVideoLongPress}
            onDeleteVideo={handleDeleteVideo}
            isDeleteMode={isDeleteMode}
          />
        )}

        {activeTab === 'saved' && (
          <VideoGrid
            videos={savedVideos.map(video => ({
              id: video.id,
              thumbnail: video.thumbnail || video.videoUrl,
              views: video.views?.toString() || '0',
              duration: '', // Saved videos may not have duration
            }))}
            onVideoPress={(video, index) => {
              // Navigate to reels page and open this video
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

            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>{t.profile.performanceSummary}</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t.profile.totalVideos}</Text>
                  <Text style={styles.summaryValue}>{myVideos.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t.profile.profileVisits}</Text>
                  <Text style={styles.summaryValue}>{analytics?.profileViews || 0}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t.profile.avgEngagement}</Text>
                  <Text style={styles.summaryValue}>
                    {myVideos.length > 0
                      ? Math.round(((analytics?.totalLikes || 0) + (analytics?.totalComments || 0)) / myVideos.length)
                      : 0}
                  </Text>
                </View>
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

                <View style={[styles.analyticsCard, { borderColor: '#FFD700', borderWidth: 1, width: '100%' }]}>
                  <Text style={{ fontSize: 28 }}>🪙</Text>
                  <Text style={[styles.analyticsValue, { color: '#FFD700' }]}>+{predictionStats?.totalCoinsWon || 0}</Text>
                  <Text style={styles.analyticsLabel}>{t.profile.coinsEarned}</Text>
                </View>
              </View>
            </View>

            {/* Achievements Section */}
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>🏆 {t.profile.achievementsTitle}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {/* First Prediction */}
                <View style={[styles.achievementBadge, (predictionStats?.total || 0) >= 1 && styles.achievementUnlocked]}>
                  <Text style={{ fontSize: 24 }}>🎯</Text>
                  <Text style={styles.achievementLabel}>{t.profile.firstPrediction}</Text>
                </View>
                {/* 10 Predictions */}
                <View style={[styles.achievementBadge, (predictionStats?.total || 0) >= 10 && styles.achievementUnlocked]}>
                  <Text style={{ fontSize: 24 }}>🔮</Text>
                  <Text style={styles.achievementLabel}>{t.profile.tenPredictions}</Text>
                </View>
                {/* First Correct */}
                <View style={[styles.achievementBadge, (predictionStats?.correct || 0) >= 1 && styles.achievementUnlocked]}>
                  <Text style={{ fontSize: 24 }}>✅</Text>
                  <Text style={styles.achievementLabel}>{t.profile.firstCorrect}</Text>
                </View>
                {/* 5 Correct */}
                <View style={[styles.achievementBadge, (predictionStats?.correct || 0) >= 5 && styles.achievementUnlocked]}>
                  <Text style={{ fontSize: 24 }}>🌟</Text>
                  <Text style={styles.achievementLabel}>{t.profile.fiveCorrect}</Text>
                </View>
                {/* 50% Accuracy */}
                <View style={[styles.achievementBadge, (predictionStats?.accuracy || 0) >= 50 && styles.achievementUnlocked]}>
                  <Text style={{ fontSize: 24 }}>📈</Text>
                  <Text style={styles.achievementLabel}>{t.profile.fiftyAccuracy}</Text>
                </View>
                {/* 10 Correct */}
                <View style={[styles.achievementBadge, (predictionStats?.correct || 0) >= 10 && styles.achievementUnlocked]}>
                  <Text style={{ fontSize: 24 }}>🏅</Text>
                  <Text style={styles.achievementLabel}>{t.profile.professional}</Text>
                </View>
              </View>
            </View>

            {/* Coins Summary */}
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>💰 {t.profile.coinsStats}</Text>
              <View style={styles.coinsSummaryCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 40 }}>🪙</Text>
                  <View>
                    <Text style={{ color: '#22c55e', fontSize: 32, fontWeight: 'bold' }}>
                      +{predictionStats?.totalCoinsWon || 0}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      {t.profile.coinsFromPredictions}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                      {t.profile.coinsSpent}
                    </Text>
                    <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>
                      -{(predictionStats?.total || 0) * 5}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                      {t.profile.netProfit}
                    </Text>
                    <Text style={{ 
                      color: ((predictionStats?.totalCoinsWon || 0) - ((predictionStats?.total || 0) * 5)) >= 0 ? '#22c55e' : '#ef4444', 
                      fontSize: 14, 
                      fontWeight: '600' 
                    }}>
                      {((predictionStats?.totalCoinsWon || 0) - ((predictionStats?.total || 0) * 5)) >= 0 ? '+' : ''}
                      {(predictionStats?.totalCoinsWon || 0) - ((predictionStats?.total || 0) * 5)}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'right' }}>
                    {t.profile.predictionCost}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView >
    </View >
  );
}

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
    marginTop: -300, // Card centered in extended cover
    marginBottom: 20,
    zIndex: 10, // Ensure card is above cover
  },
  coinsBadgeContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    borderRadius: 22,
    overflow: 'hidden',
  },
  settingsGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
