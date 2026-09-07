import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildProfileShareUrl } from '../../constants/shareLinks';

import ProfileHero from '../../components/profile/ProfileHero';
import ProfileMetricStrip from '../../components/profile/ProfileMetricStrip';
import ProfileBioCard from '../../components/profile/ProfileBioCard';
import ProfileConnectCard from '../../components/profile/ProfileConnectCard';
import { PROFILE_ICONS } from '../../components/profile/profileV2Assets';
import ImageViewerModal from '../../components/common/ImageViewerModal';
import VideoGrid from '../../components/profile/VideoGrid';
import FollowersListModal from '../../components/profile/FollowersListModal';
import { ProfileSkeleton } from '../../components/profile/ProfileSkeleton';
import { ProfileTheme } from '../../constants/ProfileTheme';
import {
  AuthService,
  SearchUserResult,
  FollowService,
  UserReel,
  ProfileService,
} from '../../src/services/authService';
import { useFollowStore } from '../../src/store/useFollowStore';
import { useToast } from '../../contexts/ToastContext';
import { globalState } from '../../globalState';
import VideoPlayerModal from '../../components/common/VideoPlayerModal';
import { useVideos, Comment } from '../../contexts/VideosContext';
import { BlockService } from '../../services/blockService';
import { cacheService, CACHE_TTL } from '../../services/cacheService';
import { useTranslation } from '../../src/i18n';
import { resolveCountryDisplayName, isMeaningfulCountryFlag } from '../../utils/countryDisplay';
import { getUserBadges } from '../../services/rankingsService';
import { ReportSystem } from '../../components/common/ReportSystem';
import { useUserReport } from '../../hooks/useReportSystem';
import ContentTabs from '../../components/profile/ContentTabs';
import { ProfileAnalyticsTab } from '../../components/profile/ProfileAnalyticsTab';
import { ProfileAchievementsTab } from '../../components/profile/ProfileAchievementsTab';
import { ProfilePublicMoreModal } from '../../components/profile/ProfilePublicMoreModal';
import { CoinsInfoModal } from '../../components/common/CoinsInfoModal';
import { LevelInfoModal } from '../../components/common/LevelInfoModal';
import { StreakInfoModal } from '../../components/common/StreakInfoModal';
import { usePublicUserPredictions } from '../../hooks/usePublicUserPredictions';
import { ProfileErrorBoundary } from '../../components/common/ProfileErrorBoundary';
import { logger } from '../../utils/logger';

// Cache keys for the public-profile screen
const USER_PROFILE_CACHE = 'user_profile';
const USER_VIDEOS_CACHE  = 'user_videos';
const REELS_PAGE_SIZE = 30;

const ACCENT = '#A855F7';

function normalizeRouteUsername(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return '';
}

// ─── Main screen ──────────────────────────────────────────────────────────────
function UserProfileScreen() {
  const params = useLocalSearchParams<{ username: string | string[] }>();
  const username = normalizeRouteUsername(params.username);
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const toast = useToast();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { reelComments, addComment, toggleCommentLike } = useVideos();
  const {
    reportUser,
    isVisible: reportVisible,
    reportConfig,
    closeReport,
    handleSuccess: onReportSuccess,
    getToken: getReportToken,
  } = useUserReport({
    onSuccess: () => toast.showSuccess('', t.publicProfile.reportSubmitted),
  });

  const [user, setUser] = useState<SearchUserResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userVideos, setUserVideos] = useState<UserReel[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<UserReel | null>(null);
  const [selectedReelSocial, setSelectedReelSocial] = useState({
    liked: false,
    likes: 0,
    saved: false,
    shares: 0,
    views: 0,
  });
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const [isBlockModalVisible, setIsBlockModalVisible] = useState(false);
  const [isFollowersModalVisible, setIsFollowersModalVisible] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [showCoinsInfo, setShowCoinsInfo] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const [showStreakInfo, setShowStreakInfo] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const tabsOffsetY = useRef(0);
  const openTabAndScroll = useCallback((tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, tabsOffsetY.current - 10),
        animated: true,
      });
    }, 80);
  }, []);
  const [badgeCount, setBadgeCount] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasRecordedViewRef = useRef(false);
  const followActionInFlightRef = useRef(false);

  const { follow, unfollow } = useFollowStore();

  useEffect(() => {
    if (!user?.id || String(user.id).startsWith('user_')) return;
    let cancelled = false;
    getUserBadges(authToken, user.id)
      .then((res) => {
        if (!cancelled) setBadgeCount(res?.summary?.total ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authToken, user?.id]);

  const canViewPredictions = !!user && !blockedMe && !isBlocked;
  const {
    stats: publicPredictionStats,
    predictions: publicPredictions,
    refresh: refreshPublicPredictions,
  } = usePublicUserPredictions(username, getToken, canViewPredictions);

  // ── Data loading (cache-first for instant render) ──────────────────────────
  const loadUserProfile = useCallback(async (skipCache = false) => {
    if (!username) {
      setError(t.publicProfile.notFound);
      setIsLoading(false);
      return;
    }

    const isOwn =
      globalState.userProfile?.username?.toLowerCase() === username.toLowerCase();
    if (isOwn) { router.replace('/(tabs)/profile'); return; }

    // Cache-first: paint cached profile instantly while we revalidate.
    const cacheKey = `${USER_PROFILE_CACHE}_${username.toLowerCase()}`;
    if (!skipCache) {
      try {
        const cached = await cacheService.get<SearchUserResult>(cacheKey);
        if (cached) {
          setUser(cached);
          setError(null);
          const bs = cached.blockStatus;
          setIsBlocked(!!bs?.blockedByMe);
          setBlockedMe(!!bs?.blockedMe);
          setIsLoading(false); // show cached profile NOW
        }
      } catch { /* silent */ }
    }

    try {
      const token = await getTokenRef.current();
      setAuthToken(token);
      const userData = await AuthService.getUserByUsername(token, username);
      if (userData) {
        setUser(userData);
        setError(null);
        const bs = userData.blockStatus;
        setIsBlocked(!!bs?.blockedByMe);
        setBlockedMe(!!bs?.blockedMe);
        cacheService.set(cacheKey, userData, 5 * 60 * 1000).catch(() => {});
      } else {
        setError(t.publicProfile.notFound);
      }
    } catch {
      // Only surface error if we have nothing on screen at all.
      setUser(prev => {
        if (!prev) setError(t.errorCodes.unknown);
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [username, t]);

  const loadUserVideos = useCallback(async (skipCache = false, appendOffset?: number) => {
    if (!username) return;

    const cacheKey = `${USER_VIDEOS_CACHE}_${username.toLowerCase()}`;
    const isAppend = appendOffset != null && appendOffset > 0;
    const offset = appendOffset ?? 0;

    if (!isAppend) {
      if (!skipCache) {
        try {
          const cached = await cacheService.get<UserReel[]>(cacheKey);
          if (cached && cached.length > 0) {
            setUserVideos(cached);
            setHasMoreVideos(cached.length >= REELS_PAGE_SIZE);
            setIsLoadingVideos(false);
          } else {
            setIsLoadingVideos(true);
          }
        } catch {
          setIsLoadingVideos(true);
        }
      } else {
        setIsLoadingVideos(true);
      }
    }

    try {
      const token = await getTokenRef.current();
      const reels = await AuthService.getUserReels(
        token,
        username,
        REELS_PAGE_SIZE,
        offset,
        skipCache,
      );
      setUserVideos((prev) => (isAppend ? [...prev, ...reels] : reels));
      setHasMoreVideos(reels.length >= REELS_PAGE_SIZE);
      if (!isAppend) {
        cacheService.set(cacheKey, reels, 2 * 60 * 1000).catch(() => {});
      }
    } catch { /* silent */ }
    finally {
      setIsLoadingVideos(false);
      setLoadingMoreVideos(false);
    }
  }, [username]);

  const recordProfileView = useCallback(async () => {
    if (!username || hasRecordedViewRef.current) return;
    hasRecordedViewRef.current = true;
    try {
      const token = await getTokenRef.current();
      if (token) ProfileService.recordProfileView(token, username);
    } catch { /* silent */ }
  }, [username]);

  useEffect(() => {
    if (!username) return;

    hasRecordedViewRef.current = false;
    setUser(null);
    setUserVideos([]);
    setError(null);
    setIsLoading(true);
    setIsBlocked(false);
    setBlockedMe(false);
    setHasMoreVideos(true);

    const bootstrap = async () => {
      const token = await getTokenRef.current();
      setAuthToken(token);
      await loadUserProfile();
      recordProfileView();
    };

    bootstrap();
  }, [username]);

  // Load reels only after profile is known and block status allows viewing.
  useEffect(() => {
    if (!username || !user) return;
    if (blockedMe || isBlocked) {
      setUserVideos([]);
      setHasMoreVideos(false);
      return;
    }
    loadUserVideos();
  }, [username, user?.id, blockedMe, isBlocked]);

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMoreVideos(true);
    await loadUserProfile(true);
    if (!blockedMe && !isBlocked) {
      await Promise.all([
        loadUserVideos(true, 0),
        refreshPublicPredictions(true),
      ]);
    }
    setRefreshing(false);
  };

  const loadMoreVideos = async () => {
    if (loadingMoreVideos || !hasMoreVideos || isBlocked || blockedMe) return;
    setLoadingMoreVideos(true);
    await loadUserVideos(false, userVideos.length);
  };

  // ── Follow / Unfollow ───────────────────────────────────────────────────────
  const animateBtn = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 90, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  const performFollow = async () => {
    if (!user || followActionInFlightRef.current) return;
    followActionInFlightRef.current = true;
    const prev = { isFollowing: user.isFollowing, followersCount: user.followersCount };
    follow(user.id);
    setUser(p => p ? { ...p, isFollowing: true, followersCount: (p.followersCount || 0) + 1 } : null);
    try {
      const token = await getToken();
      if (!token) { unfollow(user.id); setUser(p => p ? { ...p, ...prev } : null); return; }
      const res = await FollowService.followUser(token, user.username);
      if (!res.success) {
        unfollow(user.id);
        setUser(p => p ? { ...p, ...prev } : null);
        toast.showError('', t.publicProfile.followFailed);
      }
    } catch {
      unfollow(user.id);
      setUser(p => p ? { ...p, ...prev } : null);
      toast.showError('', t.publicProfile.followFailed);
    } finally {
      followActionInFlightRef.current = false;
    }
  };

  const performUnfollow = async () => {
    if (!user || followActionInFlightRef.current) return;
    followActionInFlightRef.current = true;
    const prev = { isFollowing: user.isFollowing, followersCount: user.followersCount };
    unfollow(user.id);
    setUser(p => p ? { ...p, isFollowing: false, followersCount: Math.max((p.followersCount || 0) - 1, 0) } : null);
    try {
      const token = await getToken();
      if (!token) { follow(user.id); setUser(p => p ? { ...p, ...prev } : null); return; }
      const res = await FollowService.unfollowUser(token, user.username);
      if (!res.success) {
        follow(user.id);
        setUser(p => p ? { ...p, ...prev } : null);
        toast.showError('', t.publicProfile.followFailed);
      }
    } catch {
      follow(user.id);
      setUser(p => p ? { ...p, ...prev } : null);
      toast.showError('', t.publicProfile.followFailed);
    } finally {
      followActionInFlightRef.current = false;
    }
  };

  const handleFollow = () => {
    if (!user || followActionInFlightRef.current) return;
    if (!isSignedIn) {
      router.push('/auth');
      return;
    }
    animateBtn();
    user.isFollowing ? performUnfollow() : performFollow();
  };

  const handleReportPress = async () => {
    if (!user) return;
    if (!(await getToken())) {
      router.push('/auth');
      return;
    }
    reportUser(user.id);
  };

  const handleShareProfilePress = async () => {
    if (!user) return;
    const profileUrl = buildProfileShareUrl(user.username);
    try {
      await Share.share({
        message: `${t.profile.checkMyProfile} @${user.username}\n${profileUrl}`,
        url: profileUrl,
      });
    } catch { /* cancelled */ }
  };

  const handleVideoPress = (video: UserReel) => {
    const viewsRaw = video.views;
    setSelectedReelSocial({
      liked: false,
      likes: Number(video.likes) || 0,
      saved: false,
      shares: 0,
      views:
        typeof viewsRaw === 'number'
          ? viewsRaw
          : parseInt(String(viewsRaw ?? '0').replace(/,/g, ''), 10) || 0,
    });
    setSelectedVideo(video);
    setIsVideoPlayerVisible(true);
  };

  // ── Block ───────────────────────────────────────────────────────────────────
  const handleBlockUser = () => {
    if (!user) return;
    setIsBlockModalVisible(true);
  };

  const confirmBlock = async () => {
    if (!user) return;
    setIsBlockModalVisible(false);
    setIsBlockLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      if (isBlocked) {
        await BlockService.unblockUser(user.id, token);
        setIsBlocked(false);
        toast.showSuccess('', t.publicProfile.unblockSuccess);
        await loadUserProfile(true);
        await loadUserVideos(true, 0);
      } else {
        await BlockService.blockUser(user.id, token);
        setIsBlocked(true);
        setUserVideos([]);
        toast.showSuccess('', t.publicProfile.blockSuccess);
        if (user.isFollowing) await performUnfollow();
      }
    } catch {
      toast.showError('', t.publicProfile.blockFailed);
    }
    finally { setIsBlockLoading(false); }
  };

  // ── States ──────────────────────────────────────────────────────────────────
  if (isLoading && !user) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" />
        <ProfileSkeleton />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={[s.container, s.center]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="person-outline" size={64} color="#555" />
        <Text style={s.errorTxt}>{error || t.publicProfile.notFound}</Text>
        <TouchableOpacity style={s.backBtnLarge} onPress={() => router.back()}>
          <Text style={s.backBtnTxt}>{t.publicProfile.goBack}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show total lifetime XP (all points earned since joining), matching the
  // leaderboard's "All-time" board and the global XP rank.
  const userLevel = user.level ?? 1;
  const userXp = user.xp ?? 0;

  // Social links — guard malformed API rows
  const socialLinks = Array.isArray(user.socialLinks)
    ? user.socialLinks
        .filter((l): l is NonNullable<typeof l> => !!l && typeof l === 'object')
        .map((l) => ({
          platform: typeof l.platform === 'string' ? l.platform : 'website',
          url: typeof l.url === 'string' ? l.url : '',
          username: typeof l.username === 'string' ? l.username : undefined,
        }))
        .filter((l) => l.url.trim() !== '')
    : [];

  const showFullProfile = !blockedMe && !isBlocked;

  const formattedVideos = userVideos
    .filter((v) => v && v.id && v.uri)
    .map((v) => ({
      id: v.id,
      thumbnail: v.thumbnail,
      views: String(v.views ?? '0'),
      duration: String((v as { duration?: number | string }).duration ?? '0'),
    }));

  const openFollowersModal = (tab: 'followers' | 'following') => {
    if (!user?.id) return;
    setFollowersModalTab(tab);
    setIsFollowersModalVisible(true);
  };

  const openPhotoViewer = (url?: string | null) => {
    if (!url) return;
    setViewerImageUrl(url);
    setPhotoViewerOpen(true);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Block confirmation modal ──────────────────────────────── */}
      <Modal
        visible={isBlockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBlockModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Icon */}
            <View style={[s.modalIconWrap, isBlocked ? s.modalIconUnblock : s.modalIconBlock]}>
              <Ionicons
                name={isBlocked ? 'checkmark-circle' : 'ban'}
                size={28}
                color={isBlocked ? ACCENT : '#ef4444'}
              />
            </View>

            {/* Title */}
            <Text style={s.modalTitle}>
              {isBlocked ? t.publicProfile.unblock : t.publicProfile.block}
            </Text>

            {/* Body */}
            <Text style={s.modalBody}>
              {isBlocked
                ? t.publicProfile.unblockConfirm.replace('{username}', user.username)
                : t.publicProfile.blockConfirm.replace('{username}', user.username)}
            </Text>

            {/* Buttons */}
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setIsBlockModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={s.modalCancelTxt}>{t.publicProfile.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalConfirmBtn, isBlocked ? s.modalConfirmUnblock : s.modalConfirmBlock]}
                onPress={confirmBlock}
                activeOpacity={0.8}
              >
                <Text style={s.modalConfirmTxt}>
                  {isBlocked ? t.publicProfile.confirmUnblock : t.publicProfile.confirmBlock}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Video player */}
      <VideoPlayerModal
        visible={isVideoPlayerVisible}
        videoUrl={selectedVideo?.uri || null}
        onClose={() => setIsVideoPlayerVisible(false)}
        userImage={user.avatar}
        username={user.username}
        reelId={selectedVideo?.id}
        initialLiked={selectedReelSocial.liked}
        initialLikes={selectedReelSocial.likes}
        initialSaved={selectedReelSocial.saved}
        initialShares={selectedReelSocial.shares}
        initialViews={selectedReelSocial.views}
        comments={reelComments[selectedVideo?.id || ''] || []}
        onAddComment={(c: Comment) => { if (selectedVideo) addComment(selectedVideo.id, c); }}
        onToggleLike={(id: string) => { if (selectedVideo) toggleCommentLike(selectedVideo.id, id); }}
      />

      {reportConfig && (
        <ReportSystem
          visible={reportVisible}
          onClose={closeReport}
          contentType={reportConfig.contentType}
          contentId={reportConfig.contentId}
          getToken={getReportToken}
          onSuccess={onReportSuccess}
        />
      )}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
            progressBackgroundColor={ProfileTheme.colors.deepBlack}
          />
        }
      >
        <ProfileHero
          topInset={insets.top}
          avatarUri={user.avatar}
          name={user.displayName || user.username}
          username={user.username}
          isVerified={user.isVerified}
          isDeveloper={user.isDeveloper}
          isOwnProfile={false}
          level={userLevel}
          xp={userXp}
          nextLevelXp={(userLevel + 1) * 100}
          progressPct={Math.min(1, Math.max(0, (userXp - userLevel * 100) / 100))}
          energyValue={user.coins ?? 0}
          countryFlag={isMeaningfulCountryFlag(user.countryFlag) ? user.countryFlag : null}
          countryLabel={resolveCountryDisplayName(user.country || user.location, user.countryFlag)}
          clubLogo={showFullProfile ? user.clubLogo : null}
          clubName={showFullProfile ? user.favoriteTeam : null}
          onAvatarPress={user.avatar ? () => openPhotoViewer(user.avatar) : undefined}
          onSharePress={handleShareProfilePress}
          onBackPress={() => router.back()}
          onMorePress={() => setShowMoreMenu(true)}
          onLevelPress={() => setShowLevelInfo(true)}
          onEnergyPress={() => setShowCoinsInfo(true)}
          chooseCountryLabel={t.profile.chooseCountry}
          addClubLabel={t.profile.addYourClub}
          energyLabel={t.profile.energy}
          actionBelowName={
            !blockedMe ? (
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                  onPress={handleFollow}
                  activeOpacity={0.88}
                  style={s.followTouchable}
                >
                  {user.isFollowing ? (
                    <View style={s.unfollowBtn}>
                      <Text style={s.unfollowTxt}>{t.publicProfile.unfollow}</Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={['#4E0DE4', '#2B077E']}
                      style={s.followBtn}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                    >
                      <Text style={s.followTxt}>
                        {user.isFollowingMe
                          ? t.publicProfile.followBack
                          : t.publicProfile.follow}
                      </Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ) : null
          }
        />

        {blockedMe ? (
          <View style={s.restrictedWrap}>
            <Ionicons name="lock-closed-outline" size={48} color="#666" />
            <Text style={s.restrictedTitle}>{t.publicProfile.youWereBlocked}</Text>
            <Text style={s.restrictedSub}>{t.publicProfile.youWereBlockedSub}</Text>
          </View>
        ) : (
          <>
        {isBlocked && (
          <View style={s.restrictedBanner}>
            <Ionicons name="ban" size={20} color="#ef4444" />
            <View style={s.restrictedBannerText}>
              <Text style={s.restrictedBannerTitle}>{t.publicProfile.blockedTitle}</Text>
              <Text style={s.restrictedBannerSub}>{t.publicProfile.blockedSub}</Text>
            </View>
          </View>
        )}

        <ProfileMetricStrip
          items={[
            {
              key: 'followers',
              icon: PROFILE_ICONS.followers,
              value: user.followersCount || 0,
              label: t.profile.followerShort,
              onPress: showFullProfile && user.id ? () => openFollowersModal('followers') : undefined,
            },
            {
              key: 'following',
              icon: PROFILE_ICONS.following,
              value: user.followingCount || 0,
              label: t.profile.followingShort,
              onPress: showFullProfile && user.id ? () => openFollowersModal('following') : undefined,
            },
            {
              key: 'videos',
              icon: PROFILE_ICONS.video,
              value: user.reelsCount || 0,
              label: t.profile.videos,
              onPress: () => setActiveTab('videos'),
            },
            {
              key: 'likes',
              icon: PROFILE_ICONS.heart,
              value: userVideos.reduce((sum, v) => sum + (v.likes || 0), 0),
              label: t.profile.likes,
            },
          ]}
        />

        {showFullProfile && (
          <>
        <ProfileBioCard
          bio={user.bio}
          isOwnProfile={false}
          addLabel={t.profile.addBio}
          aboutLabel={t.profile.aboutMe}
        />
        <ProfileMetricStrip
          variant="performance"
          items={[
            {
              key: 'xp',
              icon: PROFILE_ICONS.shield,
              value: userXp,
              label: t.profile.totalXp,
              onPress: () => setShowLevelInfo(true),
            },
            {
              key: 'streak',
              icon: PROFILE_ICONS.fire,
              value: user.consecutiveLoginDays || 0,
              label: t.profile.longestStreak,
              onPress: () => setShowStreakInfo(true),
            },
            {
              key: 'rate',
              icon: PROFILE_ICONS.bullseye,
              value: `${Math.round(publicPredictionStats.accuracy <= 1 && publicPredictionStats.accuracy > 0 ? publicPredictionStats.accuracy * 100 : publicPredictionStats.accuracy || 0)}%`,
              label: t.profile.predictionRate,
              onPress: () => openTabAndScroll('predictions'),
            },
            {
              key: 'achievements',
              icon: PROFILE_ICONS.trophy,
              value: badgeCount,
              label: t.profile.achievements,
              onPress: () => openTabAndScroll('achievements'),
            },
          ]}
        />
        <ProfileConnectCard
          links={socialLinks}
          isOwnProfile={false}
          title={t.profile.connectWithMe}
        />

        <View
          onLayout={(e) => {
            tabsOffsetY.current = e.nativeEvent.layout.y;
          }}
        >
          <ContentTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            videoCount={userVideos.length}
            isOwnProfile={false}
            showPublicAnalytics
          />
        </View>

        <View style={s.contentPanel}>
        {activeTab === 'videos' && (
          <>
        {isLoadingVideos ? (
          <View style={s.loadingVideos}>
            <ActivityIndicator size="small" color={ACCENT} />
          </View>
        ) : userVideos.length === 0 ? (
          <View style={s.emptyVideos}>
            <Ionicons name="videocam-outline" size={48} color="#444" />
            <Text style={s.emptyTxt}>{t.publicProfile.noVideosYet}</Text>
          </View>
        ) : (
          <VideoGrid
            videos={formattedVideos}
            onVideoPress={(v) => {
              const reel = userVideos.find((uv) => uv.id === v.id);
              if (reel) handleVideoPress(reel);
            }}
            onVideoLongPress={() => {}}
            onDeleteVideo={() => {}}
            isDeleteMode={false}
            horizontalInset={20}
          />
        )}

        {hasMoreVideos && userVideos.length > 0 && (
          <TouchableOpacity
            style={s.loadMoreBtn}
            onPress={loadMoreVideos}
            disabled={loadingMoreVideos}
            activeOpacity={0.8}
          >
            {loadingMoreVideos ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <>
                <Ionicons name="chevron-down" size={16} color={ProfileTheme.colors.profilePrimary} />
                <Text style={s.loadMoreTxt}>{t.publicProfile.loadMoreVideos}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
          </>
        )}

        {activeTab === 'predictions' && (
          <ProfileAnalyticsTab
            predictionStats={publicPredictionStats}
            predictions={publicPredictions}
          />
        )}

        {activeTab === 'achievements' && user.id && !String(user.id).startsWith('user_') && (
          <ProfileAchievementsTab
            analytics={null}
            userId={user.id}
            authToken={authToken}
          />
        )}
        </View>
          </>
        )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {user.id ? (
        <FollowersListModal
          visible={isFollowersModalVisible}
          onClose={() => setIsFollowersModalVisible(false)}
          userId={user.id}
          initialTab={followersModalTab}
          username={user.username}
        />
      ) : null}
      <ImageViewerModal
        visible={photoViewerOpen}
        imageUrl={viewerImageUrl}
        onClose={() => setPhotoViewerOpen(false)}
      />
      <ProfilePublicMoreModal
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        displayName={user.displayName || user.username}
        username={user.username}
        avatarUri={user.avatar}
        isBlocked={isBlocked}
        onReport={handleReportPress}
        onBlock={handleBlockUser}
      />
      <LevelInfoModal
        visible={showLevelInfo}
        onClose={() => setShowLevelInfo(false)}
        level={userLevel}
      />
      <StreakInfoModal
        visible={showStreakInfo}
        onClose={() => setShowStreakInfo(false)}
      />
      <CoinsInfoModal
        visible={showCoinsInfo}
        onClose={() => setShowCoinsInfo(false)}
      />
    </View>
  );
}

export default function UserProfileScreenWithBoundary() {
  return (
    <ProfileErrorBoundary
      screenLabel="PublicUserProfile"
      errorMessage="عذراً، حدث خطأ غير متوقع في صفحة المستخدم."
      infiniteLoopMessage="تم اكتشاف مشكلة في عرض صفحة المستخدم. تم إيقاف الشاشة للحماية."
      secondaryAction="back"
      onError={(error, errorInfo) => {
        logger.error('[PublicUserProfile] render error:', {
          message: error.message,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      <UserProfileScreen />
    </ProfileErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ProfileTheme.colors.profileBg,
  },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 20 },
  hiddenTab: { display: 'none' },

  loadingTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 14 },
  errorTxt: { color: '#888', fontSize: 17, marginTop: 16, marginBottom: 24 },
  backBtnLarge: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: ACCENT,
    borderRadius: 14,
  },
  backBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  /* Card */
  cardContainer: {
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
  },

  /* Badges */
  badgesWrap: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },

  followBlock: {
    marginHorizontal: 22,
    marginTop: 12,
    marginBottom: 16,
  },
  followTouchable: { borderRadius: 16, overflow: 'hidden', width: '100%' },

  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#460BCB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.46,
    shadowRadius: 5.45,
    elevation: 6,
  },
  followTxt: { color: '#fff', fontSize: 20, fontWeight: '600' },

  unfollowBtn: {
    height: 54,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#26095C',
    borderWidth: 0.5,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  unfollowTxt: {
    color: '#BABABA',
    fontSize: 20,
    fontWeight: '600',
  },

  followingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  followingTxt: { color: ACCENT, fontSize: 16, fontWeight: '800' },

  blockBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedBtn: {
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderColor: 'rgba(168,85,247,0.3)',
  },

  contentPanel: {
    marginHorizontal: 20,
    marginTop: -1,
    backgroundColor: '#0E0919',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: ProfileTheme.colors.profileTabBorder,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    minHeight: 120,
    marginBottom: 8,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  countTxt: { color: ACCENT, fontSize: 11, fontWeight: '700' },

  loadingVideos: { paddingVertical: 24, alignItems: 'center' },
  emptyVideos: { alignItems: 'center', paddingVertical: 60 },
  emptyTxt: { color: '#555', fontSize: 15, marginTop: 12 },

  restrictedWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  restrictedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  restrictedBannerText: { flex: 1 },
  restrictedBannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  restrictedBannerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  restrictedTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  restrictedSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadMoreBtn: {
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  loadMoreTxt: {
    color: ProfileTheme.colors.profilePrimary,
    fontSize: 10,
    fontWeight: '700',
  },

  /* Block modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0E0025',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconBlock: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  modalIconUnblock: {
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBlock: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  modalConfirmUnblock: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.5)',
  },
  modalConfirmTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
