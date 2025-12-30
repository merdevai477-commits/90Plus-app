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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';

// Same components as profile.tsx
import ProfileHeader from '../../components/profile/ProfileHeader';
import ProfileCard from '../../components/profile/ProfileCard';
import StatsRow from '../../components/profile/StatsRow';
import VideoGrid from '../../components/profile/VideoGrid';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { AuthService, SearchUserResult, FollowService, UserReel, ProfileService } from '../../src/services/authService';
import { useFollowStore } from '../../src/store/useFollowStore';
import { useToast } from '../../contexts/ToastContext';
import { globalState } from '../../globalState';
import VideoPlayerModal from '../../components/common/VideoPlayerModal';
import { useVideos, Comment } from '../../contexts/VideosContext';
import BadgesDisplay from '../../components/profile/BadgesDisplay';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { getToken } = useAuth();
  const toast = useToast();
  const { reelComments, addComment, toggleCommentLike } = useVideos();

  // User data state
  const [user, setUser] = useState<SearchUserResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Videos state
  const [userVideos, setUserVideos] = useState<UserReel[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  // Video player modal
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<UserReel | null>(null);

  // Animation for follow button
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const loadUserProfile = useCallback(async () => {
    if (!username) {
      setError('اسم المستخدم غير موجود');
      setIsLoading(false);
      return;
    }

    // Check if viewing own profile - redirect to profile tab
    // Improved detection: case-insensitive username and ID comparison
    const isOwnProfile = 
      (globalState.userProfile?.username?.toLowerCase() === username?.toLowerCase()) ||
      (globalState.userProfile?.id && user?.id && String(globalState.userProfile.id) === String(user.id));
    
    if (isOwnProfile) {
      router.replace('/(tabs)/profile');
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        setError('يرجى تسجيل الدخول');
        setIsLoading(false);
        return;
      }

      const userData = await AuthService.getUserByUsername(token, username);
      if (userData) {
        setUser(userData);
        setError(null);
      } else {
        setError('المستخدم غير موجود');
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      setError('حدث خطأ أثناء تحميل البروفايل');
    } finally {
      setIsLoading(false);
    }
  }, [username, getToken]);

  const loadUserVideos = useCallback(async () => {
    if (!username) return;

    setIsLoadingVideos(true);
    try {
      const token = await getToken();
      if (token) {
        const reels = await AuthService.getUserReels(token, username);
        setUserVideos(reels);
      }
    } catch (err) {
      console.error('Error loading user videos:', err);
    } finally {
      setIsLoadingVideos(false);
    }
  }, [username, getToken]);

  // Track if initial load is done
  const hasLoadedRef = useRef(false);
  const hasRecordedViewRef = useRef(false);

  // Record profile view (once per session)
  const recordProfileView = useCallback(async () => {
    if (!username || hasRecordedViewRef.current) return;
    hasRecordedViewRef.current = true;
    
    try {
      const token = await getToken();
      if (token) {
        ProfileService.recordProfileView(token, username);
      }
    } catch (err) {
      // Silent fail - not critical
    }
  }, [username, getToken]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadUserProfile();
      loadUserVideos();
      recordProfileView();
    }
  }, [username]); // Only reload when username changes

  // Don't use useFocusEffect to avoid infinite loops
  // Pull to refresh handles manual refresh

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserProfile(), loadUserVideos()]);
    setRefreshing(false);
  };

  // Animate button press
  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Use global follow store
  const { follow, unfollow } = useFollowStore();

  // Perform follow action with Optimistic UI
  const performFollow = async () => {
    if (!user) return;
    
    // Save previous state for rollback
    const previousState = { isFollowing: user.isFollowing, followersCount: user.followersCount };
    
    // Optimistic update - instant UI change
    follow(user.id); // Update global store
    setUser(prev => prev ? {
      ...prev,
      isFollowing: true,
      followersCount: (prev.followersCount || 0) + 1,
    } : null);
    
    // API call in background
    try {
      const token = await getToken();
      if (!token) {
        // Rollback on error
        unfollow(user.id);
        setUser(prev => prev ? { ...prev, ...previousState } : null);
        toast.showError('خطأ', 'يرجى تسجيل الدخول');
        return;
      }

      const result = await FollowService.followUser(token, user.username);
      if (!result.success) {
        // Rollback on failure
        unfollow(user.id);
        setUser(prev => prev ? { ...prev, ...previousState } : null);
        toast.showError('خطأ', result.error || 'فشل المتابعة');
      }
      // Success - UI already updated, no need to do anything
    } catch (err) {
      console.error('Follow error:', err);
      // Rollback on error
      unfollow(user.id);
      setUser(prev => prev ? { ...prev, ...previousState } : null);
      toast.showError('خطأ', 'حدث خطأ');
    }
  };

  // Perform unfollow action with Optimistic UI
  const performUnfollow = async () => {
    if (!user) return;
    
    // Save previous state for rollback
    const previousState = { isFollowing: user.isFollowing, followersCount: user.followersCount };
    
    // Optimistic update - instant UI change
    unfollow(user.id); // Update global store
    setUser(prev => prev ? {
      ...prev,
      isFollowing: false,
      followersCount: Math.max((prev.followersCount || 0) - 1, 0),
    } : null);

    // API call in background
    try {
      const token = await getToken();
      if (!token) {
        // Rollback on error
        follow(user.id);
        setUser(prev => prev ? { ...prev, ...previousState } : null);
        toast.showError('خطأ', 'يرجى تسجيل الدخول');
        return;
      }

      const result = await FollowService.unfollowUser(token, user.username);
      if (!result.success) {
        // Rollback on failure
        follow(user.id);
        setUser(prev => prev ? { ...prev, ...previousState } : null);
        toast.showError('خطأ', result.error || 'فشل إلغاء المتابعة');
      }
      // Success - UI already updated, no need to do anything
    } catch (err) {
      console.error('Unfollow error:', err);
      // Rollback on error
      follow(user.id);
      setUser(prev => prev ? { ...prev, ...previousState } : null);
      toast.showError('خطأ', 'حدث خطأ');
    }
  };

  const handleFollow = () => {
    if (!user) return;

    // Animate button
    animateButtonPress();

    if (user.isFollowing) {
      // Unfollow instantly without confirmation
      performUnfollow();
    } else {
      // Follow instantly
      performFollow();
    }
  };

  const handleVideoPress = (video: any) => {
    setSelectedVideo(video);
    setIsVideoPlayerVisible(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />
        <ActivityIndicator size="large" color={ProfileTheme.colors.neonGreen} />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  // Error state
  if (error || !user) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />
        <Ionicons name="person-outline" size={64} color="#666" />
        <Text style={styles.errorText}>{error || 'المستخدم غير موجود'}</Text>
        <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format videos for VideoGrid component
  const formattedVideos = userVideos.map(v => ({
    id: v.id,
    uri: v.uri,
    thumbnail: v.thumbnail,
    views: v.views,
    likes: v.likes,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />

      {/* Video Player Modal */}
      <VideoPlayerModal
        visible={isVideoPlayerVisible}
        videoUrl={selectedVideo?.uri || null}
        onClose={() => setIsVideoPlayerVisible(false)}
        userImage={user.avatar}
        username={user.username}
        reelId={selectedVideo?.id}
        comments={reelComments[selectedVideo?.id || ''] || []}
        onAddComment={(comment: Comment) => { if (selectedVideo) addComment(selectedVideo.id, comment); }}
        onToggleLike={(commentId: string) => { if (selectedVideo) toggleCommentLike(selectedVideo.id, commentId); }}
      />

      {/* Back Button - Fixed Position */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ProfileTheme.colors.neonGreen}
            colors={[ProfileTheme.colors.neonGreen]}
            progressBackgroundColor={ProfileTheme.colors.deepBlack}
          />
        }
      >
        {/* Cover Image - Same as profile */}
        <ProfileHeader />

        {/* FIFA Card - Read-only for other users (no onPress handlers) */}
        <View style={styles.profileCardContainer}>
          <ProfileCard
            playerImage={user.avatar ? { uri: user.avatar } : { uri: 'https://picsum.photos/200' }}
            cardType="gold"
            scale={0.60}
            uploadedImage={user.avatar}
            countryFlag={user.countryFlag || '🇪🇬'}
            position={user.position || 'RW'}
            age={user.age?.toString() || '22'}
            height={user.height?.toString() || '180'}
            weight={user.weight?.toString() || '70'}
            foot={user.preferredFoot || 'R'}
            clubLogo={user.clubLogo || undefined}
            brandLogo={user.brandLogo || undefined}
            // No onPress handlers - read only for other users
          />
        </View>

        {/* User Info - Custom for other users (no edit button) */}
        <View style={styles.userInfoContainer}>
          {/* Name & Badges */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.displayName || user.username}</Text>
            {user.isDeveloper && (
              <View style={styles.developerBadge}>
                <Ionicons name="code-slash" size={14} color="#3b82f6" />
              </View>
            )}
            {user.isVerified && !user.isDeveloper && (
              <Ionicons name="checkmark-circle" size={24} color={ProfileTheme.colors.neonGreen} />
            )}
          </View>

          {/* Username */}
          <Text style={styles.username}>@{user.username}</Text>

          {/* Location & Team */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={16} color={ProfileTheme.colors.textSecondary} />
              <Text style={styles.detailText}>مصر</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="football" size={16} color={ProfileTheme.colors.neonGreen} />
              <Text style={styles.detailText}>{user.favoriteTeam || 'لم يحدد'}</Text>
            </View>
          </View>

          {/* Bio */}
          {user.bio && (
            <Text style={styles.bio}>{user.bio}</Text>
          )}

          {/* Badges Display - الميداليات */}
          {user.id && (
            <View style={styles.badgesContainer}>
              <BadgesDisplay 
                userId={user.id} 
                token={null} 
                compact={true} 
              />
            </View>
          )}
        </View>

        {/* Follow Button - Instead of ActionButtons */}
        <View style={styles.followButtonContainer}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.followButton, user.isFollowing && styles.followingButton]}
              onPress={handleFollow}
              activeOpacity={0.9}
            >
              {user.isFollowing ? (
                <View style={styles.followingContent}>
                  <Ionicons 
                    name="checkmark" 
                    size={20} 
                    color={ProfileTheme.colors.neonGreen} 
                  />
                  <Text style={styles.followingText}>متابَع</Text>
                </View>
              ) : (
                <View style={styles.followGradient}>
                  <Ionicons 
                    name={user.isFollowingMe ? "people" : "person-add"} 
                    size={20} 
                    color="#000" 
                  />
                  <Text style={styles.followText}>
                    {user.isFollowingMe ? 'رد المتابعة' : 'متابعة'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Stats Row - Same as profile */}
        <StatsRow
          followers={(user.followersCount || 0).toString()}
          following={(user.followingCount || 0).toString()}
          videos={(user.reelsCount || 0).toString()}
        />

        {/* Videos Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الفيديوهات</Text>
        </View>

        {/* Loading videos indicator */}
        {isLoadingVideos && (
          <View style={styles.loadingVideos}>
            <ActivityIndicator size="small" color={ProfileTheme.colors.neonGreen} />
          </View>
        )}

        {/* Video Grid - Same as profile */}
        <VideoGrid
          videos={formattedVideos}
          onVideoPress={handleVideoPress}
          onVideoLongPress={() => {}}
          onDeleteVideo={() => {}}
          isDeleteMode={false}
        />

        {/* Empty state if no videos */}
        {!isLoadingVideos && userVideos.length === 0 && (
          <View style={styles.emptyVideos}>
            <Ionicons name="videocam-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>لا يوجد فيديوهات بعد</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: ProfileTheme.colors.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#888',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonLarge: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: ProfileTheme.colors.neonGreen,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileCardContainer: {
    alignItems: 'center',
    marginTop: -300,
    marginBottom: 20,
    zIndex: 10,
  },
  // User Info Styles (simplified version without edit)
  userInfoContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    textShadowColor: ProfileTheme.colors.neonBlue,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  developerBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    padding: 6,
    borderRadius: 12,
  },
  username: {
    fontSize: 16,
    color: ProfileTheme.colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  detailText: {
    color: ProfileTheme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  bio: {
    fontSize: 16,
    color: '#DDD',
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: '90%',
  },
  // Follow Button Styles
  followButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
    height: 50,
  },
  followButton: {
    borderRadius: 25,
    height: 50,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: ProfileTheme.colors.neonGreen,
  },
  followingButton: {
    borderColor: ProfileTheme.colors.neonGreen,
    backgroundColor: ProfileTheme.colors.deepBlack,
  },
  followGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
  },
  followingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
  },
  followText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  followingText: {
    color: ProfileTheme.colors.neonGreen,
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Section Header
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    textAlign: 'right',
  },
  // Loading Videos
  loadingVideos: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  // Empty Videos
  emptyVideos: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  badgesContainer: {
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
});
