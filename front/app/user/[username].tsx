import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import ProfileAffiliationBar from '../../components/profile/ProfileAffiliationBar';
import { ProfileCollapsedBar, bindProfileScroll } from '../../components/profile/ProfileCollapsedBar';
import { ProfilePostsPane } from '../../components/profile/ProfilePostsPane';
import ProfileMetricStrip from '../../components/profile/ProfileMetricStrip';
import ProfileSocialLinksBar from '../../components/profile/ProfileSocialLinksBar';
import { PROFILE_ICONS } from '../../components/profile/profileV2Assets';
import ImageViewerModal from '../../components/common/ImageViewerModal';
import VideoGrid from '../../components/profile/VideoGrid';
import { ProfileGridScrollProvider, useGridScrollReporter } from '../../components/profile/profileGridScroll';
import FollowersListModal from '../../components/profile/FollowersListModal';
import { ProfileSkeleton } from '../../components/profile/ProfileSkeleton';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useProfileTheme } from '../../hooks/useProfileTheme';
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
import { isCurrentUserUsername } from '../../utils/navigateUserProfile';
import VideoPlayerModal from '../../components/common/VideoPlayerModal';
import { useVideos, Comment } from '../../contexts/VideosContext';
import { BlockService } from '../../services/blockService';
import { cacheService } from '../../services/cacheService';
import { useTranslation } from '../../src/i18n';
import { resolveCountryDisplayName, isMeaningfulCountryFlag } from '../../utils/countryDisplay';
import { ReportSystem } from '../../components/common/ReportSystem';
import { useUserReport } from '../../hooks/useReportSystem';
import ContentTabs from '../../components/profile/ContentTabs';
import { ProfileAchievementsTab } from '../../components/profile/ProfileAchievementsTab';
import { ProfilePublicMoreModal } from '../../components/profile/ProfilePublicMoreModal';
import { CoinsInfoModal } from '../../components/common/CoinsInfoModal';
import { LevelInfoModal } from '../../components/common/LevelInfoModal';
import { StreakInfoModal } from '../../components/common/StreakInfoModal';
import { usePublicUserPredictions } from '../../hooks/usePublicUserPredictions';
import { ProfileErrorBoundary } from '../../components/common/ProfileErrorBoundary';
import { logger } from '../../utils/logger';
import {
  fetchPublicProfileCached,
  fetchPublicVideosCached,
  peekPublicProfile,
  peekPublicVideos,
  setPublicProfileMemory,
  setPublicVideosMemory,
} from '../../services/publicProfileCache';
import { Image as ExpoImage } from 'expo-image';

// Cache keys for the public-profile screen (durable AsyncStorage layer)
const USER_PROFILE_CACHE = 'user_profile';
const USER_VIDEOS_CACHE = 'user_videos';
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
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors: profileColors, isDark: profileIsDark } = useProfileTheme();
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

  const initialMemProfile = username ? peekPublicProfile(username) : null;
  const initialMemVideos = username ? peekPublicVideos(username) : null;

  const [user, setUser] = useState<SearchUserResult | null>(initialMemProfile);
  const [isLoading, setIsLoading] = useState(!initialMemProfile);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userVideos, setUserVideos] = useState<UserReel[]>(initialMemVideos ?? []);
  const [isLoadingVideos, setIsLoadingVideos] = useState(!initialMemVideos?.length);
  const [hasMoreVideos, setHasMoreVideos] = useState(
    () => (initialMemVideos?.length ?? 0) >= REELS_PAGE_SIZE || !initialMemVideos?.length,
  );
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
  const [isBlocked, setIsBlocked] = useState(!!initialMemProfile?.blockStatus?.blockedByMe);
  const [blockedMe, setBlockedMe] = useState(!!initialMemProfile?.blockStatus?.blockedMe);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const [isBlockModalVisible, setIsBlockModalVisible] = useState(false);
  const [isFollowersModalVisible, setIsFollowersModalVisible] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const profileScrollY = useRef(new Animated.Value(0)).current;
  const [showCoinsInfo, setShowCoinsInfo] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const [showStreakInfo, setShowStreakInfo] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const gridScroll = useGridScrollReporter();
  const tabsOffsetY = useRef(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasRecordedViewRef = useRef(false);
  const followActionInFlightRef = useRef(false);

  const { follow, unfollow } = useFollowStore();

  const canViewPredictions = !!user && !blockedMe && !isBlocked;
  const { refresh: refreshPublicPredictions } = usePublicUserPredictions(
    username,
    getToken,
    canViewPredictions,
  );

  // ── Data loading (memory → disk → network, profile + videos in parallel) ──
  const applyProfile = useCallback((userData: SearchUserResult) => {
    setUser(userData);
    setError(null);
    const bs = userData.blockStatus;
    setIsBlocked(!!bs?.blockedByMe);
    setBlockedMe(!!bs?.blockedMe);
    setIsLoading(false);
    if (userData.avatar) {
      ExpoImage.prefetch(userData.avatar).catch(() => undefined);
    }
    if (userData.coverImage) {
      ExpoImage.prefetch(userData.coverImage).catch(() => undefined);
    }
  }, []);

  const loadUserVideos = useCallback(async (skipCache = false, appendOffset?: number) => {
    if (!username) return;

    const diskKey = `${USER_VIDEOS_CACHE}_${username.toLowerCase()}`;
    const isAppend = appendOffset != null && appendOffset > 0;
    const offset = appendOffset ?? 0;

    if (!isAppend) {
      if (!skipCache) {
        const mem = peekPublicVideos(username);
        if (mem && mem.length > 0) {
          setUserVideos(mem);
          setHasMoreVideos(mem.length >= REELS_PAGE_SIZE);
          setIsLoadingVideos(false);
        } else {
          try {
            const cached = await cacheService.get<UserReel[]>(diskKey);
            if (cached && cached.length > 0) {
              setUserVideos(cached);
              setPublicVideosMemory(username, cached);
              setHasMoreVideos(cached.length >= REELS_PAGE_SIZE);
              setIsLoadingVideos(false);
            } else {
              setIsLoadingVideos(true);
            }
          } catch {
            setIsLoadingVideos(true);
          }
        }
      } else {
        setIsLoadingVideos(true);
      }
    }

    try {
      const token = await getTokenRef.current();
      const reels = isAppend
        ? await AuthService.getUserReels(token, username, REELS_PAGE_SIZE, offset, skipCache)
        : await fetchPublicVideosCached(
            username,
            () => AuthService.getUserReels(token, username, REELS_PAGE_SIZE, offset, skipCache),
            { revalidate: true },
          );
      setUserVideos((prev) => (isAppend ? [...prev, ...reels] : reels));
      setHasMoreVideos(reels.length >= REELS_PAGE_SIZE);
      if (!isAppend) {
        setPublicVideosMemory(username, reels);
        cacheService.set(diskKey, reels, 2 * 60 * 1000).catch(() => {});
      }
    } catch { /* silent */ }
    finally {
      setIsLoadingVideos(false);
      setLoadingMoreVideos(false);
    }
  }, [username]);

  const loadUserProfile = useCallback(async (skipCache = false) => {
    if (!username) {
      setError(t.publicProfile.notFound);
      setIsLoading(false);
      return null as SearchUserResult | null;
    }

    if (isCurrentUserUsername(username)) {
      router.replace('/(tabs)/profile');
      return null;
    }

    const diskKey = `${USER_PROFILE_CACHE}_${username.toLowerCase()}`;

    if (!skipCache) {
      const mem = peekPublicProfile(username);
      if (mem) {
        applyProfile(mem);
      } else {
        try {
          const cached = await cacheService.get<SearchUserResult>(diskKey);
          if (cached) {
            setPublicProfileMemory(username, cached);
            applyProfile(cached);
          }
        } catch { /* silent */ }
      }
    }

    try {
      const token = await getTokenRef.current();
      const userData = await fetchPublicProfileCached(
        username,
        () => AuthService.getUserByUsername(token, username),
        { revalidate: true },
      );
      if (userData) {
        setPublicProfileMemory(username, userData);
        applyProfile(userData);
        cacheService.set(diskKey, userData, 5 * 60 * 1000).catch(() => {});
        return userData;
      }
      setError(t.publicProfile.notFound);
      return null;
    } catch {
      setUser((prev) => {
        if (!prev) setError(t.errorCodes.unknown);
        return prev;
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [username, t, applyProfile]);

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
    setError(null);
    setHasMoreVideos(true);

    const memProfile = peekPublicProfile(username);
    const memVideos = peekPublicVideos(username);

    if (memProfile) {
      applyProfile(memProfile);
    } else {
      setUser(null);
      setIsBlocked(false);
      setBlockedMe(false);
      setIsLoading(true);
    }

    if (memVideos?.length) {
      setUserVideos(memVideos);
      setHasMoreVideos(memVideos.length >= REELS_PAGE_SIZE);
      setIsLoadingVideos(false);
    } else {
      if (!memProfile) setUserVideos([]);
      setIsLoadingVideos(true);
    }

    let cancelled = false;

    const bootstrap = async () => {
      // Profile + videos in parallel (videos cleared later if blocked).
      const profilePromise = loadUserProfile(false);
      const videosPromise = loadUserVideos(false, 0);
      const [fresh] = await Promise.all([profilePromise, videosPromise]);
      if (cancelled) return;

      const blocked =
        !!fresh?.blockStatus?.blockedByMe || !!fresh?.blockStatus?.blockedMe;
      if (blocked) {
        setUserVideos([]);
        setHasMoreVideos(false);
      }
      recordProfileView();
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [username]);

  // If block status flips after a refresh, drop videos.
  useEffect(() => {
    if (!user) return;
    if (blockedMe || isBlocked) {
      setUserVideos([]);
      setHasMoreVideos(false);
    }
  }, [user?.id, blockedMe, isBlocked]);

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMoreVideos(true);
    const fresh = await loadUserProfile(true);
    const blocked =
      !!fresh?.blockStatus?.blockedByMe || !!fresh?.blockStatus?.blockedMe;
    if (!blocked) {
      await Promise.all([
        loadUserVideos(true, 0),
        refreshPublicPredictions(true),
      ]);
    } else {
      setUserVideos([]);
      setHasMoreVideos(false);
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

  // Hooks must stay above early returns — never call useMemo after a conditional return.
  const socialLinks = useMemo(
    () =>
      Array.isArray(user?.socialLinks)
        ? user!.socialLinks
            .filter((l): l is NonNullable<typeof l> => !!l && typeof l === 'object')
            .map((l) => ({
              platform: typeof l.platform === 'string' ? l.platform : 'website',
              url: typeof l.url === 'string' ? l.url : '',
              username: typeof l.username === 'string' ? l.username : undefined,
            }))
            .filter((l) => l.url.trim() !== '')
        : [],
    [user?.socialLinks],
  );

  const formattedVideos = useMemo(
    () =>
      userVideos
        .filter((v) => v && v.id && v.uri)
        .map((v) => ({
          id: v.id,
          thumbnail: v.thumbnail,
          views: String(v.views ?? '0'),
          duration: String((v as { duration?: number | string }).duration ?? '0'),
        })),
    [userVideos],
  );

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

  // ── States ──────────────────────────────────────────────────────────────────
  if (isLoading && !user) {
    return (
      <View style={[s.container, { backgroundColor: profileColors.profileBg }]}>
        <StatusBar barStyle={profileColors.statusBar === "light" ? "light-content" : "dark-content"} backgroundColor={profileColors.profileBg} />
        <ProfileSkeleton />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={[s.container, s.center]}>
        <StatusBar barStyle={profileColors.statusBar === "light" ? "light-content" : "dark-content"} backgroundColor={profileColors.profileBg} />
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
  const showFullProfile = !blockedMe && !isBlocked;

  return (
    <View style={[s.container, { backgroundColor: profileColors.profileBg }]}>
      <StatusBar barStyle={profileColors.statusBar === "light" ? "light-content" : "dark-content"} backgroundColor={profileColors.profileBg} />

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

      <ProfileCollapsedBar
        scrollY={profileScrollY}
        name={user.displayName || user.username}
        avatarUri={user.avatar}
        userId={user.id}
        isVerified={user.isVerified}
        isDeveloper={user.isDeveloper}
        onBack={() => router.back()}
      />
      <ProfileGridScrollProvider tick={gridScroll.tick}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        scrollEventThrottle={16}
        decelerationRate="normal"
        onScroll={bindProfileScroll(profileScrollY, gridScroll.onScroll)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
            progressBackgroundColor={profileColors.profileBg}
          />
        }
      >
        <ProfileHero
          topInset={insets.top}
          avatarUri={user.avatar}
          name={user.displayName || user.username}
          username={user.username}
          bio={showFullProfile ? user.bio : null}
          isVerified={user.isVerified}
          isDeveloper={user.isDeveloper}
          userId={user.id}
          isOwnProfile={false}
          onAvatarPress={user.avatar ? () => openPhotoViewer(user.avatar) : undefined}
          onBackPress={() => router.back()}
          onMorePress={() => setShowMoreMenu(true)}
          onSharePress={handleShareProfilePress}
          viewAllBioLabel={t.profile.viewAllBio}
          showLessBioLabel={t.profile.showLess}
          actionBelowName={
            !blockedMe ? (
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                  onPress={handleFollow}
                  activeOpacity={0.88}
                  style={s.followTouchable}
                >
                  {user.isFollowing ? (
                    <View
                      style={[
                        s.unfollowBtn,
                        {
                          backgroundColor: profileIsDark
                            ? 'rgba(139,92,246,0.16)'
                            : profileColors.profilePrimarySoft,
                          borderColor: profileColors.profilePrimary,
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-remove-outline"
                        size={20}
                        color={profileColors.profilePrimary}
                      />
                      <Text style={[s.unfollowTxt, { color: profileColors.profilePrimary }]}>
                        {t.publicProfile.unfollow}
                      </Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={[profileColors.profilePrimary, '#4B1FA3']}
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

        <ProfileAffiliationBar
          level={userLevel}
          xp={userXp}
          nextLevelXp={(userLevel + 1) * 100}
          progressPct={Math.min(1, Math.max(0, (userXp - userLevel * 100) / 100))}
          countryFlag={isMeaningfulCountryFlag(user.countryFlag) ? user.countryFlag : null}
          countryLabel={resolveCountryDisplayName(user.country || user.location, user.countryFlag, language === 'ar')}
          clubLogo={showFullProfile ? user.clubLogo : null}
          clubName={showFullProfile ? user.favoriteTeam : null}
          isOwnProfile={false}
          onLevelPress={() => setShowLevelInfo(true)}
          chooseCountryLabel={t.profile.chooseCountry}
          addClubLabel={t.profile.addYourClub}
        />

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
              key: 'likes',
              icon: PROFILE_ICONS.heart,
              value: user.totalLikes ?? userVideos.reduce((sum, v) => sum + (v.likes || 0), 0),
              label: t.profile.likesShort || t.profile.likes,
            },
          ]}
        />

        {showFullProfile ? <ProfileSocialLinksBar links={socialLinks} /> : null}

        {showFullProfile && (
          <>

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

        {activeTab === 'posts' && user.username ? (
          <ProfilePostsPane username={user.username} />
        ) : (
        <View style={[s.contentPanel, { backgroundColor: profileColors.profileCard }]}>
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

        {activeTab === 'achievements' && user.id && !String(user.id).startsWith('user_') && (
          <ProfileAchievementsTab userId={String(user.id)} />
        )}
        </View>
        )}
          </>
        )}
          </>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
      </ProfileGridScrollProvider>

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

  loadingTxt: { color: ProfileTheme.colors.textSecondary, fontSize: 15, marginTop: 14 },
  errorTxt: { color: ProfileTheme.colors.profileMuted, fontSize: 17, marginTop: 16, marginBottom: 24 },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ProfileTheme.colors.profilePrimarySoft,
    borderWidth: 1.5,
    borderColor: ProfileTheme.colors.profilePrimary,
  },
  unfollowTxt: {
    color: ProfileTheme.colors.profilePrimary,
    fontSize: 17,
    fontWeight: '700',
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
    borderColor: 'rgba(124,58,237,0.45)',
    backgroundColor: '#F7F2FF',
  },
  followingTxt: { color: ACCENT, fontSize: 16, fontWeight: '800' },

  blockBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedBtn: {
    backgroundColor: '#F7F2FF',
    borderColor: 'rgba(124,58,237,0.35)',
  },

  contentPanel: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 19,
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
    color: ProfileTheme.colors.textPrimary,
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  countTxt: { color: ACCENT, fontSize: 11, fontWeight: '700' },

  loadingVideos: { paddingVertical: 24, alignItems: 'center' },
  emptyVideos: { alignItems: 'center', paddingVertical: 60 },
  emptyTxt: { color: ProfileTheme.colors.profileMuted, fontSize: 15, marginTop: 12 },

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
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  restrictedBannerText: { flex: 1 },
  restrictedBannerTitle: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  restrictedBannerSub: {
    color: ProfileTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  restrictedTitle: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  restrictedSub: {
    color: ProfileTheme.colors.textSecondary,
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
    backgroundColor: ProfileTheme.colors.profileCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
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
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  modalIconUnblock: {
    backgroundColor: '#F7F2FF',
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  modalTitle: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    color: ProfileTheme.colors.textSecondary,
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
    backgroundColor: ProfileTheme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelTxt: {
    color: ProfileTheme.colors.textSecondary,
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
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  modalConfirmUnblock: {
    backgroundColor: '#F7F2FF',
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.5)',
  },
  modalConfirmTxt: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
