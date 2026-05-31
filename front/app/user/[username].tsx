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
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Zap, Flag, MessageCircle } from 'lucide-react-native';

import ProfileHeader from '../../components/profile/ProfileHeader';
import ProfileCard from '../../components/profile/ProfileCard';
import StatsRow from '../../components/profile/StatsRow';
import VideoGrid from '../../components/profile/VideoGrid';
import UserInfo from '../../components/profile/UserInfo';
import BadgesDisplay from '../../components/profile/BadgesDisplay';
import SocialLinksSection from '../../components/profile/SocialLinksSection';
import FollowersListModal from '../../components/profile/FollowersListModal';
import { ProfileSkeleton } from '../../components/profile/ProfileSkeleton';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
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
import { getProfileCardOverlapMargin } from '../../constants/profileLayout';
import { ReportSystem } from '../../components/common/ReportSystem';
import { useUserReport } from '../../hooks/useReportSystem';

// Cache keys for the public-profile screen
const USER_PROFILE_CACHE = 'user_profile';
const USER_VIDEOS_CACHE  = 'user_videos';
const REELS_PAGE_SIZE = 30;

// ─── XP helpers (mirrors backend formula) ────────────────────────────────────
const xpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  if (level === 2) return 290;
  return 40 + 125 * level * (level - 1);
};

const ACCENT = '#A855F7';
const ACCENT_DARK = '#7C3AED';

// ─── Top bar ──────────────────────────────────────────────────────────────────
function UserTopBar({
  topInset,
  level,
  xp,
  onBack,
}: {
  topInset: number;
  level?: number;
  xp?: number;
  onBack: () => void;
}) {
  const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const xpDisplay = xp != null ? (xp >= 1000 ? `${(xp / 1000).toFixed(1)}K` : String(xp)) : '—';

  return (
    <GlassContainer
      intensity={20}
      tint="dark"
      effect="regular"
      style={[tb.container, { paddingTop: topInset + 10 }]}
    >
      {/* Back button */}
      <TouchableOpacity onPress={onBack} style={tb.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      {/* LVL badge */}
      {level != null && (
        <View style={tb.lvlBadge}>
          <Text style={tb.lvlLabel}>LVL</Text>
          <Text style={tb.lvlNumber}>{level}</Text>
        </View>
      )}

      {/* XP chip */}
      <View style={tb.xpChip}>
        <Zap size={13} color={ACCENT} fill={ACCENT} />
        <Text style={tb.xpTxt}>{xpDisplay} XP</Text>
      </View>
    </GlassContainer>
  );
}

const tb = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(5,1,13,0.0)',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  lvlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  lvlLabel: {
    color: 'rgba(168,85,247,0.9)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  lvlNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    gap: 5,
  },
  xpTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { getToken, isSignedIn } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const cardOverlap = getProfileCardOverlapMargin(screenHeight);
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
  const [authToken, setAuthToken] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasRecordedViewRef = useRef(false);

  const { follow, unfollow } = useFollowStore();

  // ── Data loading (cache-first for instant render) ──────────────────────────
  const loadUserProfile = useCallback(async (skipCache = false) => {
    if (!username) { setError(t.publicProfile.notFound); setIsLoading(false); return; }

    const isOwn =
      globalState.userProfile?.username?.toLowerCase() === username?.toLowerCase();
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
      const token = await getToken();
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
  }, [username, getToken, t]);

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
      const token = await getToken();
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
  }, [username, getToken]);

  const recordProfileView = useCallback(async () => {
    if (!username || hasRecordedViewRef.current) return;
    hasRecordedViewRef.current = true;
    try {
      const token = await getToken();
      if (token) ProfileService.recordProfileView(token, username);
    } catch { /* silent */ }
  }, [username, getToken]);

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
      const token = await getToken();
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
      await loadUserVideos(true, 0);
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
    if (!user) return;
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
    }
  };

  const performUnfollow = async () => {
    if (!user) return;
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
    }
  };

  const handleFollow = () => {
    if (!user) return;
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

  const handleMessagePress = async () => {
    if (!user) return;
    const profileUrl = `https://90plus.app/@${user.username}`;
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

  // Derive XP relative to current level
  const userLevel = user.level ?? 1;
  const userXp = user.xp ?? 0;
  const relativeXp = Math.max(0, userXp - xpForLevel(userLevel));

  // Social links
  const socialLinks = Array.isArray(user.socialLinks)
    ? user.socialLinks
        .map((l) => ({ platform: l.platform || 'website', url: l.url || '', username: l.username }))
        .filter((l) => l.url.trim() !== '')
    : [];

  const showFullProfile = !blockedMe && !isBlocked;

  const formattedVideos = userVideos.map(v => ({
    id: v.id,
    uri: v.uri,
    thumbnail: v.thumbnail,
    views: v.views,
    likes: v.likes,
    duration: (v as any).duration ?? 0,
  }));

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

      {/* Fixed top bar */}
      <UserTopBar
        topInset={insets.top}
        level={userLevel}
        xp={relativeXp}
        onBack={() => router.back()}
      />

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
        {/* Cover */}
        <ProfileHeader
          coverImage={user.coverImage ? { uri: user.coverImage } : undefined}
        />

        {blockedMe ? (
          <View style={s.restrictedWrap}>
            <Ionicons name="lock-closed-outline" size={48} color="#666" />
            <Text style={s.restrictedTitle}>{t.publicProfile.youWereBlocked}</Text>
            <Text style={s.restrictedSub}>{t.publicProfile.youWereBlockedSub}</Text>
          </View>
        ) : (
          <>
        {/* FIFA Card — read-only */}
        <View style={[s.cardContainer, { marginTop: cardOverlap }]}>
          <ProfileCard
            playerImage={user.avatar ? { uri: user.avatar } : undefined}
            cardType="gold"
            scale={0.60}
            uploadedImage={user.avatar || null}
            countryFlag={user.countryFlag || '🌍'}
            position={user.position || 'ST'}
            age={user.age?.toString()}
            height={user.height?.toString()}
            weight={user.weight?.toString()}
            foot={user.preferredFoot || 'R'}
            clubLogo={user.clubLogo || undefined}
          />
        </View>

        <UserInfo
          name={user.displayName || user.username}
          username={user.username}
          bio={showFullProfile ? user.bio || undefined : undefined}
          location={user.country || user.location || ''}
          team={showFullProfile ? user.favoriteTeam || '' : ''}
          isVerified={user.isVerified}
          isDeveloper={user.isDeveloper}
          clubLogo={user.clubLogo || undefined}
          consecutiveLoginDays={user.consecutiveLoginDays || 0}
        />

        {showFullProfile && user.id && !String(user.id).startsWith('user_') && (
          <View style={s.badgesWrap}>
            <BadgesDisplay userId={user.id} token={authToken} compact />
          </View>
        )}

        {showFullProfile && socialLinks.length > 0 && (
          <SocialLinksSection links={socialLinks} isOwnProfile={false} />
        )}

        <StatsRow
          followers={(user.followersCount || 0).toString()}
          following={(user.followingCount || 0).toString()}
          videos={(user.reelsCount || 0).toString()}
          onFollowersPress={showFullProfile ? () => {
            setFollowersModalTab('followers');
            setIsFollowersModalVisible(true);
          } : undefined}
          onFollowingPress={showFullProfile ? () => {
            setFollowersModalTab('following');
            setIsFollowersModalVisible(true);
          } : undefined}
        />

        {/* Follow + Message + Report + Block */}
        <View style={s.actionRow}>
          {/* Follow button */}
          <Animated.View style={[s.followWrap, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity onPress={handleFollow} activeOpacity={0.85} style={s.followTouchable}>
              {user.isFollowing ? (
                /* Following state — glass */
                (() => {
                  const G = isLiquidGlassSupported ? LiquidGlassView : BlurView;
                  const gp = isLiquidGlassSupported
                    ? { effect: 'clear' as const, interactive: true }
                    : { intensity: 30, tint: 'dark' as const };
                  return (
                    <G {...(gp as any)} style={s.followingBtn}>
                      <LinearGradient
                        colors={['rgba(168,85,247,0.15)', 'rgba(124,58,237,0.08)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                      <Ionicons name="checkmark" size={18} color={ACCENT} />
                      <Text style={s.followingTxt}>{t.publicProfile.following}</Text>
                    </G>
                  );
                })()
              ) : (
                /* Follow state — purple gradient */
                <LinearGradient
                  colors={[ACCENT, ACCENT_DARK]}
                  style={s.followBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={user.isFollowingMe ? 'people' : 'person-add'}
                    size={18}
                    color="#fff"
                  />
                  <Text style={s.followTxt}>
                    {user.isFollowingMe ? t.publicProfile.followBack : t.publicProfile.follow}
                  </Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={handleMessagePress}
            activeOpacity={0.75}
          >
            <MessageCircle size={18} color="#fff" />
            <Text style={s.secondaryBtnTxt}>{t.publicProfile.message}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={handleReportPress}
            activeOpacity={0.75}
          >
            <Flag size={18} color="#fbbf24" />
            <Text style={s.secondaryBtnTxt}>{t.publicProfile.report}</Text>
          </TouchableOpacity>

          {/* Block button */}
          <TouchableOpacity
            style={[s.blockBtn, isBlocked && s.blockedBtn]}
            onPress={handleBlockUser}
            disabled={isBlockLoading}
            activeOpacity={0.75}
          >
            {isBlockLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={isBlocked ? 'checkmark-circle' : 'ban'}
                size={20}
                color={isBlocked ? ACCENT : '#ef4444'}
              />
            )}
          </TouchableOpacity>
        </View>

        {isBlocked && (
          <View style={s.restrictedBanner}>
            <Ionicons name="ban" size={20} color="#ef4444" />
            <View style={s.restrictedBannerText}>
              <Text style={s.restrictedBannerTitle}>{t.publicProfile.blockedTitle}</Text>
              <Text style={s.restrictedBannerSub}>{t.publicProfile.blockedSub}</Text>
            </View>
          </View>
        )}

        {showFullProfile && (
          <>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t.publicProfile.videosTitle}</Text>
          {userVideos.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countTxt}>{userVideos.length}</Text>
            </View>
          )}
        </View>

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
            onVideoPress={v => handleVideoPress(v as UserReel)}
            onVideoLongPress={() => {}}
            onDeleteVideo={() => {}}
            isDeleteMode={false}
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
              <Text style={s.loadMoreTxt}>{t.publicProfile.loadMoreVideos}</Text>
            )}
          </TouchableOpacity>
        )}
          </>
        )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FollowersListModal
        visible={isFollowersModalVisible}
        onClose={() => setIsFollowersModalVisible(false)}
        userId={user.id}
        initialTab={followersModalTab}
        username={user.username}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ProfileTheme.colors.deepBlack,
  },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 20 },

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

  /* Action row */
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 10,
    alignItems: 'center',
  },
  followWrap: { flex: 1, minWidth: 0 },
  followTouchable: { borderRadius: 16, overflow: 'hidden' },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  secondaryBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  followTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  followingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  followingTxt: { color: ACCENT, fontSize: 15, fontWeight: '800' },

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
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  loadMoreTxt: {
    color: ACCENT,
    fontSize: 14,
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
