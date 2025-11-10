import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Image, // إضافة Image
} from 'react-native';
import {
  ChevronUp,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  MoreVertical,
  Play,
  Pause,
  Volume2,
  VolumeX,
  User,
  Crown,
  Award,
  Shield,
  CheckCircle, // إضافة CheckCircle
} from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av'; // إضافة ResizeMode
import { LinearGradient } from 'expo-linear-gradient';
import { useHapticFeedback } from '../../components/leagues/HapticFeedback';
import { useFadeIn, useSlideIn, usePulse } from '../../components/leagues/Animations';
import { globalState } from '../../globalState';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ألوان احترافية متطورة
const COLORS = {
  primary: '#FFD700',
  secondary: '#FF6B35',
  accent: '#4ECDC4',
  background: '#000000',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#cccccc',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

// أنواع الكروت
const CARD_TYPES = {
  diamond: { color: '#B9F2FF', icon: Crown, name: 'ماسي' },
  gold: { color: '#FFD700', icon: Award, name: 'ذهبي' },
  silver: { color: '#C0C0C0', icon: Shield, name: 'فضي' },
  bronze: { color: '#CD7F32', icon: Award, name: 'برونزي' }
};

interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  verified?: boolean;
  followers?: number;
  isFollowing?: boolean;
  cardType: 'diamond' | 'gold' | 'silver' | 'bronze';
  isOwner?: boolean;
}

interface ReelData {
  id: string;
  user: User;
  videoUrl: string;
  thumbnail: string;
  duration: number;
  likes: number;
  views: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  muted: boolean;
  description?: string;
  hashtags?: string[];
  location?: string;
  createdAt: Date;
}

// بيانات الفيديوهات المرتبطة بالبروفايلات
const reelsData: ReelData[] = [
  {
    id: '1',
    user: {
      id: 'diamond-user',
      name: 'محمد عصام',
      username: 'M.Essam',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      verified: true,
      followers: 125000,
      isFollowing: false,
      cardType: 'diamond',
      isOwner: true
    },
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=800&fit=crop',
    duration: 30,
    likes: 12500,
    views: 125000,
    comments: 1200,
    shares: 450,
    liked: false,
    saved: false,
    muted: true,
    description: 'هدف رائع في المباراة النهائية! 🔥⚽\n\n#كرة_القدم #أهداف #رياضة',
    hashtags: ['كرة_القدم', 'أهداف', 'رياضة'],
    location: 'ستاد القاهرة',
    createdAt: new Date()
  },
  {
    id: '2',
    user: {
      id: 'gold-user-1',
      name: 'أحمد محمد',
      username: 'Ahmed_Football',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      verified: true,
      followers: 45000,
      isFollowing: false,
      cardType: 'gold'
    },
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=800&fit=crop',
    duration: 25,
    likes: 8900,
    views: 89000,
    comments: 456,
    shares: 123,
    liked: true,
    saved: false,
    muted: false,
    description: 'تمرين اليوم كان قوي! 💪\n\n#لياقة #صحة #تمارين',
    hashtags: ['لياقة', 'صحة', 'تمارين'],
    location: 'نادي الجزيرة',
    createdAt: new Date()
  },
  {
    id: '3',
    user: {
      id: 'gold-user-2',
      name: 'سارة أحمد',
      username: 'Sara_Sports',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      verified: true,
      followers: 32000,
      isFollowing: true,
      cardType: 'gold'
    },
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=800&fit=crop',
    duration: 28,
    likes: 15600,
    views: 156000,
    comments: 1200,
    shares: 567,
    liked: false,
    saved: true,
    muted: true,
    description: 'لحظات لا تُنسى من البطولة 🏆\n\n#بطولة #فوز #احتفال',
    hashtags: ['بطولة', 'فوز', 'احتفال'],
    location: 'ملعب برشلونة',
    createdAt: new Date()
  }
];

// مكون كرة التحميل
const LoadingBall: React.FC<{ visible: boolean }> = ({ visible }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.loop(
          Animated.timing(spinValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          })
        ),
        Animated.spring(scaleValue, {
          toValue: 1,
          tension: 50,
          friction: 3,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.timing(scaleValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <View style={styles.loadingContainer}>
      <Animated.View
        style={[
          styles.loadingBall,
          {
            transform: [
              { rotate: spin },
              { scale: scaleValue }
            ]
          }
        ]}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.secondary, COLORS.accent]}
          style={styles.ballGradient}
        />
      </Animated.View>
      <Text style={styles.loadingText}>جاري التحميل...</Text>
    </View>
  );
};

// مكون عنصر الريل
const ReelItem: React.FC<{
  reel: ReelData;
  isActive: boolean;
  onLike: () => void;
  onToggleMute: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onUserPress: () => void;
  onVideoRef: (ref: Video | null, id: string) => void;
}> = ({
  reel,
  isActive,
  onLike,
  onToggleMute,
  onComment,
  onShare,
  onSave,
  onUserPress,
  onVideoRef
}) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(600);
  const slideAnim = useSlideIn('up', 400);
  const pulseAnim = usePulse(1, 1.02, 2000);

  const cardType = CARD_TYPES[reel.user.cardType];
  const CardIcon = cardType.icon;

  const handleUserPress = () => {
    haptic.cardTap();
    onUserPress();
  };

  const handleLike = () => {
    haptic.buttonPress();
    onLike();
  };

  const handleMute = () => {
    haptic.buttonPress();
    onToggleMute();
  };

  return (
    <Animated.View
      style={[
        styles.reelContainer,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: pulseAnim }
          ]
        }
      ]}
    >
      {/* Video Player */}
      <Video
        ref={(ref) => onVideoRef(ref, reel.id)}
        source={{ uri: reel.videoUrl }}
        style={styles.video}
        shouldPlay={isActive}
        isLooping
        isMuted={reel.muted}
        resizeMode={ResizeMode.COVER} // استخدام ResizeMode.COVER
        onLoad={() => console.log('Video loaded')}
      />

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        style={styles.gradientOverlay}
      />

      {/* User Info */}
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={handleUserPress}
        activeOpacity={0.8}
      >
        <View style={styles.userAvatarContainer}>
          <Image source={{ uri: reel.user.avatar }} style={styles.userAvatar} />
          {reel.user.verified && (
            <View style={styles.verifiedBadge}>
              <CheckCircle size={12} color={COLORS.info} />
            </View>
          )}
          {reel.user.isOwner && (
            <View style={styles.ownerBadge}>
              <Crown size={10} color={COLORS.primary} />
            </View>
          )}
        </View>
        
        <View style={styles.userDetails}>
          <View style={styles.userNameContainer}>
            <Text style={styles.userName}>{reel.user.name}</Text>
            <CardIcon size={16} color={cardType.color} />
            <Text style={[styles.cardTypeText, { color: cardType.color }]}>
              {cardType.name}
            </Text>
          </View>
          <Text style={styles.userUsername}>@{reel.user.username}</Text>
          <Text style={styles.userFollowers}>
            {reel.user.followers?.toLocaleString()} متابع
          </Text>
        </View>
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.description}>{reel.description}</Text>
        
        {reel.hashtags && (
          <View style={styles.hashtagsContainer}>
            {reel.hashtags.map((tag, index) => (
              <Text key={index} style={styles.hashtag}>#{tag}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Heart 
            size={28} 
            color={reel.liked ? COLORS.error : COLORS.text} 
            fill={reel.liked ? COLORS.error : 'transparent'}
          />
          <Text style={styles.actionText}>{reel.likes.toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onComment}>
          <MessageCircle size={28} color={COLORS.text} />
          <Text style={styles.actionText}>{reel.comments.toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onShare}>
          <Share size={28} color={COLORS.text} />
          <Text style={styles.actionText}>{reel.shares.toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onSave}>
          <Bookmark 
            size={28} 
            color={reel.saved ? COLORS.primary : COLORS.text}
            fill={reel.saved ? COLORS.primary : 'transparent'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleMute}>
          {reel.muted ? (
            <VolumeX size={28} color={COLORS.text} />
          ) : (
            <Volume2 size={28} color={COLORS.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
      </View>
    </Animated.View>
  );
};

// الصفحة الرئيسية للريلزات
const ReelsScreen: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const videoRefs = useRef<Map<string, Video>>(new Map());
  const flatListRef = useRef<FlatList>(null);
  const haptic = useHapticFeedback();

  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);

  // Handle Like
  const handleLike = useCallback((reelId: string) => {
    haptic.buttonPress();
    // Update like status
  }, [haptic]);

  // Handle Mute Toggle
  const handleToggleMute = useCallback((reelId: string) => {
    haptic.buttonPress();
    // Update mute status
  }, [haptic]);

  // Handle User Press
  const handleUserPress = useCallback((user: User) => {
    haptic.cardTap();
    // Navigate to user profile
    console.log('Navigate to user profile:', user.username);
  }, [haptic]);

  // Handle Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptic.refresh();

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIsRefreshing(false);
  }, [haptic]);

  // Update current index
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50
  }), []);

  const renderItem = useCallback(({ item, index }: { item: ReelData; index: number }) => (
    <ReelItem
      reel={item}
      isActive={index === currentIndex}
      onLike={() => handleLike(item.id)}
      onToggleMute={() => handleToggleMute(item.id)}
      onComment={() => console.log('Open comments')}
      onShare={() => console.log('Share reel')}
      onSave={() => console.log('Save reel')}
      onUserPress={() => handleUserPress(item.user)}
      onVideoRef={(ref, id) => {
        if (ref) {
          videoRefs.current.set(id, ref);
        } else {
          videoRefs.current.delete(id);
        }
      }}
    />
  ), [currentIndex, handleLike, handleToggleMute, handleUserPress]);

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
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.headerTitle}>Reels</Text>
        <View style={styles.headerStats}>
          <Text style={styles.headerStatsText}>
            {currentIndex + 1} / {reelsData.length}
          </Text>
        </View>
      </Animated.View>

      {/* Progress Indicators - تم إصلاح التكرار */}
      <View style={styles.progressIndicators}>
        {reelsData.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === currentIndex && styles.progressDotActive,
              index < currentIndex && styles.progressDotCompleted
            ]}
          />
        ))}
      </View>

      {/* Reels List */}
      <FlatList
        ref={flatListRef}
        data={reelsData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      {/* Swipe Hint */}
      {currentIndex === 0 && (
        <Animated.View 
          style={[
            styles.swipeHint,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <ChevronUp size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.swipeHintText}>اسحب للأعلى</Text>
        </Animated.View>
      )}

      {/* Loading Ball */}
      <LoadingBall visible={isLoading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerStats: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  headerStatsText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  progressIndicators: {
    position: 'absolute',
    top: 100,
    right: 20,
    zIndex: 100,
    gap: 4,
  },
  progressDot: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  progressDotCompleted: {
    backgroundColor: 'rgba(255,215,0,0.6)',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  userInfo: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 80,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.text,
    borderRadius: 8,
    padding: 2,
  },
  ownerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 2,
  },
  userDetails: {
    flex: 1,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardTypeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userUsername: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userFollowers: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contentContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 80,
    zIndex: 10,
  },
  description: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hashtag: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  actionButtons: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBall: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 20,
  },
  ballGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReelsScreen;