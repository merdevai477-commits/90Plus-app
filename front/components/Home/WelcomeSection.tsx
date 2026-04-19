import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { COLORS } from '../reels/constants';
import { globalState } from '../../globalState';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';
import { DailyQuizStatus } from '../../services/quizApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HEIGHT = 240;
const AUTO_SCROLL_INTERVAL = 5000;

interface WelcomeSectionProps {
  onRegisterPress: () => void;
  onLoginPress: () => void;
  onProfilePress: () => void;
  onSpinWheelPress?: () => void;
  onPredictionsPress?: () => void;
  onQuizPress?: () => void;
  onRankPress?: () => void;
  username?: string;
  userAvatar?: string | null;
  predictionsCount?: number;
  streakDays?: number;
  userRank?: number;
  spinWheelAvailable?: boolean;
  nextSpinTime?: Date;
  loginStreak?: number; // أيام الدخول المتتالي
  dailyQuizStatus?: DailyQuizStatus | null;
}

type SlideType = 'welcome' | 'spinWheel' | 'predictions' | 'quiz' | 'rank';

interface SlideData {
  type: SlideType;
  gradient: readonly [string, string, ...string[]];
  accentColor: string;
  glowColor: string;
  icon: string;
  title: string;
  subtitle: string;
  buttonText: string;
  onPress: () => void;
  badge?: string;
  iconEmoji?: string;
}

// ✨ Ambient Glow Orbs - Premium background effect inspired by Stitch design
const AmbientGlowOrbs: React.FC<{ color1: string; color2: string }> = ({ color1, color2 }) => {
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);

  useEffect(() => {
    pulse1.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    pulse2.value = withDelay(
      1500,
      withRepeat(
        withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, []);

  const orb1Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(pulse1.value, [0, 1], [0.08, 0.2]),
    transform: [
      { scale: interpolate(pulse1.value, [0, 1], [0.8, 1.2]) },
    ] as ViewStyle['transform'],
  }));

  const orb2Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(pulse2.value, [0, 1], [0.06, 0.15]),
    transform: [
      { scale: interpolate(pulse2.value, [0, 1], [1, 1.3]) },
    ] as ViewStyle['transform'],
  }));

  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: color1,
          },
          orb1Style,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: color2,
          },
          orb2Style,
        ]}
      />
    </>
  );
};

export const WelcomeSection = React.memo(({
  onRegisterPress,
  onLoginPress,
  onProfilePress,
  onSpinWheelPress,
  onPredictionsPress,
  onQuizPress,
  onRankPress,
  username: propUsername,
  userAvatar: propUserAvatar,
  predictionsCount = 0,
  streakDays = 0,
  userRank = 0,
  spinWheelAvailable = true,
  nextSpinTime,
  loginStreak = 0,
  dailyQuizStatus = null,
}: WelcomeSectionProps) => {
  const { isSignedIn, isLoaded: clerkAuthLoaded } = useAuth();
  const { t } = useTranslation();
  const { user: clerkUser } = useUser();

  /** Signed-in UI must follow Clerk — userMode can stay "guest" until Zustand catches up */
  const showSignedInWelcome = clerkAuthLoaded && isSignedIn;
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [quizCountdown, setQuizCountdown] = useState('');
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation values
  const cardScale = useSharedValue(1);
  const shimmerAnim = useSharedValue(0);
  const avatarRing = useSharedValue(0);

  // Primary source: active session (Clerk user), then prop, then globalState only if it matches session
  const username = useMemo(() => {
    // First priority: prop username (passed from parent)
    if (propUsername) return propUsername;
    
    // Second priority: Clerk user (active session)
    if (clerkUser?.primaryEmailAddress?.emailAddress) {
      const emailUsername = clerkUser.primaryEmailAddress.emailAddress.split('@')[0];
      // Verify globalState matches current session before using it
      if (globalState.userProfile?.id === clerkUser.id) {
        return globalState.userProfile?.username || globalState.userProfile?.displayName || emailUsername;
      }
      return emailUsername;
    }
    
    // Third priority: globalState only if we have no session (guest mode)
    if (globalState.userProfile?.username) {
      return globalState.userProfile.username;
    }
    if (globalState.userProfile?.displayName) {
      return globalState.userProfile.displayName;
    }
    
    return 'User';
  }, [propUsername, clerkUser?.id, clerkUser?.primaryEmailAddress?.emailAddress, globalState.userProfile?.id, globalState.userProfile?.username, globalState.userProfile?.displayName]);

  // Countdown for spin wheel
  useEffect(() => {
    if (!spinWheelAvailable && nextSpinTime) {
      const updateCountdown = () => {
        const now = new Date();
        const diff = nextSpinTime.getTime() - now.getTime();
        
        if (diff <= 0) {
          setCountdown('');
          return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      };
      
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [spinWheelAvailable, nextSpinTime]);

  // Countdown for daily quiz
  useEffect(() => {
    if (dailyQuizStatus && !dailyQuizStatus.canTake && dailyQuizStatus.timeRemaining) {
      const updateQuizCountdown = () => {
        const { hours, minutes, seconds } = dailyQuizStatus.timeRemaining!;
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        
        if (totalSeconds <= 0) {
          setQuizCountdown('');
          return;
        }
        
        // Calculate remaining time
        const now = new Date();
        if (dailyQuizStatus.canRetryAt) {
          const retryDate = new Date(dailyQuizStatus.canRetryAt);
          const diff = retryDate.getTime() - now.getTime();
          
          if (diff <= 0) {
            setQuizCountdown('');
            return;
          }
          
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          
          setQuizCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      };
      
      updateQuizCountdown();
      const interval = setInterval(updateQuizCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setQuizCountdown('');
    }
  }, [dailyQuizStatus]);

  // Shimmer animation
  useEffect(() => {
    shimmerAnim.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // Avatar ring rotation
  useEffect(() => {
    avatarRing.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmerAnim.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]) }],
  }));

  const avatarRingStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(avatarRing.value, [0, 1], [0, 360])}deg` },
    ] as ViewStyle['transform'],
  }));

  // Use actual login streak or fallback to streakDays
  const actualLoginStreak = loginStreak > 0 ? loginStreak : streakDays;

  const slides: SlideData[] = [
    {
      type: 'welcome',
      gradient: ['#0a0a12', '#151525', '#0f0f1a'] as const,
      accentColor: COLORS.neonGreen,
      glowColor: '#8eff71',
      icon: 'person',
      title: `${t.home.hello} ${username}!`,
      subtitle: actualLoginStreak > 0 
        ? `${actualLoginStreak} ${t.home.consecutiveDays}` 
        : t.home.newChallenges,
      buttonText: t.home.profile,
      onPress: onProfilePress,
      badge: undefined,
    },
    {
      type: 'spinWheel',
      gradient: spinWheelAvailable 
        ? (['#1a0a00', '#2a1000', '#1a0800'] as const)
        : (['#0f0f12', '#1a1a1e', '#0f0f12'] as const),
      accentColor: spinWheelAvailable ? '#ff9472' : '#555',
      glowColor: spinWheelAvailable ? '#fc4d00' : '#333',
      icon: 'gift',
      iconEmoji: '🎰',
      title: spinWheelAvailable ? t.home.luckyWheel : t.home.wheelLocked,
      subtitle: spinWheelAvailable ? t.home.spinAndWin : `${t.home.availableAfter} ${countdown}`,
      buttonText: spinWheelAvailable ? t.home.tryYourLuck : countdown,
      onPress: onSpinWheelPress || (() => {}),
    },
    {
      type: 'predictions',
      gradient: ['#001a15', '#002a20', '#001510'] as const,
      accentColor: '#38ef7d',
      glowColor: '#11998e',
      icon: 'football',
      iconEmoji: '⚽',
      title: t.home.predictions,
      subtitle: predictionsCount > 0 
        ? `${predictionsCount} ${t.home.matchesAvailable}` 
        : t.home.predictResults,
      buttonText: t.home.predictNow,
      onPress: onPredictionsPress || (() => {}),
      badge: predictionsCount > 0 ? `${predictionsCount}` : undefined,
    },
    {
      type: 'quiz',
      gradient: dailyQuizStatus?.canTake 
        ? (['#0a0020', '#150040', '#0a0018'] as const)
        : (['#0f0f12', '#1a1a1e', '#0f0f12'] as const),
      accentColor: dailyQuizStatus?.canTake ? '#ac8aff' : '#555',
      glowColor: dailyQuizStatus?.canTake ? '#8E54E9' : '#333',
      icon: 'bulb',
      iconEmoji: '🧠',
      title: dailyQuizStatus?.categoryName || 'الأسئلة اليومية',
      subtitle: dailyQuizStatus?.canTake 
        ? 'اختبر معرفتك اليوم'
        : dailyQuizStatus?.timeRemaining 
          ? `متاح بعد ${quizCountdown || `${dailyQuizStatus.timeRemaining.hours}:${dailyQuizStatus.timeRemaining.minutes.toString().padStart(2, '0')}`}`
          : 'غير متاح حالياً',
      buttonText: dailyQuizStatus?.canTake 
        ? 'ابدأ الكويز'
        : quizCountdown || 'انتظر',
      onPress: dailyQuizStatus?.canTake ? (onQuizPress || (() => {})) : (() => {}),
    },
    {
      type: 'rank',
      gradient: userRank > 0 
        ? (['#1a0010', '#2a0020', '#150010'] as const)
        : (['#0f0f12', '#1a1a1e', '#0f0f12'] as const),
      accentColor: userRank > 0 ? '#f5576c' : '#555',
      glowColor: userRank > 0 ? '#f093fb' : '#333',
      icon: 'trophy',
      iconEmoji: '🏆',
      title: userRank > 0 ? `${t.home.rankPosition} #${userRank}` : t.home.ranking,
      subtitle: userRank > 0 
        ? t.home.competeWithBest 
        : 'ارفع فيديو أو شارك لتظهر في الرانك',
      buttonText: userRank > 0 ? t.home.seeYourRank : 'ابدأ الآن',
      onPress: userRank > 0 ? (onRankPress || (() => {})) : (onRankPress || (() => {})),
      badge: userRank > 0 ? `#${userRank}` : undefined,
    },
  ];

  // Auto scroll (only for signed-in carousel)
  useEffect(() => {
    if (!showSignedInWelcome) return;

    autoScrollRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, AUTO_SCROLL_INTERVAL);

    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [showSignedInWelcome, slides.length]);

  const handleCardPress = useCallback(() => {
    Haptics.selectionAsync();
    cardScale.value = withSequence(
      withSpring(0.96, { damping: 15 }),
      withSpring(1, { damping: 15 })
    );
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, AUTO_SCROLL_INTERVAL);
    }
  }, [slides.length]);

  const handleButtonPress = useCallback((slide: SlideData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    slide.onPress();
  }, []);

  const handleDotPress = useCallback((index: number) => {
    Haptics.selectionAsync();
    setCurrentSlide(index);
    
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, AUTO_SCROLL_INTERVAL);
    }
  }, [slides.length]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // Clerk still hydrating — avoid flashing "guest" card while session is restoring
  if (!clerkAuthLoaded) {
    return (
      <View style={styles.container} accessibilityLabel="Loading welcome">
        <View style={[styles.card, styles.welcomeSkeletonCard]}>
          <ActivityIndicator size="small" color={COLORS.neonGreen} />
        </View>
      </View>
    );
  }

  // GUEST MODE (Clerk finished loading and there is no session)
  if (!isSignedIn) {
    return (
      <Animated.View
        entering={FadeInDown.delay(200).springify().damping(14)}
        style={styles.container}
      >
        <TouchableOpacity activeOpacity={0.95} onPress={onRegisterPress}>
          <View style={styles.card}>
            <LinearGradient
              colors={['#0a0a12', '#151525', '#0f0f1a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <AmbientGlowOrbs color1="#8eff71" color2="#ac8aff" />
            
            {/* Shimmer */}
            <Animated.View style={[styles.shimmer, shimmerStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.04)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shimmerGradient}
              />
            </Animated.View>

            <View style={styles.cardContent}>
              <View style={styles.guestIconContainer}>
                <Text style={styles.guestEmoji}>🚀</Text>
              </View>
              
              <Text style={styles.guestTitle}>{t.home.joinCompetition}</Text>
              <Text style={styles.guestSubtitle}>{t.home.registerAndStart}</Text>
              
              <View style={styles.guestButtons}>
                <TouchableOpacity 
                  style={styles.primaryBtn} 
                  onPress={onRegisterPress}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[COLORS.neonGreen, '#16a34a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnText}>{t.home.startNow}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#000" />
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.secondaryBtn} onPress={onLoginPress}>
                  <Text style={styles.secondaryBtnText}>{t.home.signIn}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // USER MODE - Premium Glass Card Carousel
  const currentSlideData = slides[currentSlide];
  const hasAvatar = currentSlideData.type === 'welcome' && (propUserAvatar || clerkUser?.imageUrl);

  return (
    <Animated.View
      entering={FadeInDown.delay(200).springify().damping(14)}
      style={styles.container}
    >
      <TouchableOpacity activeOpacity={0.98} onPress={handleCardPress}>
        <Animated.View style={cardAnimStyle}>
          <Animated.View
            key={currentSlide}
            entering={FadeIn.duration(500)}
            exiting={FadeOut.duration(250)}
          >
            {/* Main Glass Card */}
            <View style={styles.card}>
              {/* Deep gradient background */}
              <LinearGradient
                colors={currentSlideData.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Ambient glow orbs */}
              <AmbientGlowOrbs
                color1={currentSlideData.glowColor}
                color2={currentSlideData.accentColor}
              />

              {/* Glass overlay for depth */}
              <View style={styles.glassOverlay} />

              {/* Shimmer sweep */}
              <Animated.View style={[styles.shimmer, shimmerStyle]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.03)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.shimmerGradient}
                />
              </Animated.View>

              {/* Card Content */}
              <View style={styles.cardContent}>
                {/* Top Row: Title + Badge/Streak */}
                <View style={styles.topRow}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.kickerLabel}>
                      {currentSlideData.type === 'welcome' ? 'WELCOME BACK' : 
                       currentSlideData.type === 'spinWheel' ? (spinWheelAvailable ? 'AVAILABLE NOW' : 'LOCKED') :
                       currentSlideData.type === 'predictions' ? 'PREDICTIONS' :
                       currentSlideData.type === 'quiz' ? 'DAILY QUIZ' : 'LEADERBOARD'}
                    </Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {currentSlideData.title}
                    </Text>
                  </View>

                  {/* Fire Streak Badge (only on welcome) */}
                  {currentSlideData.type === 'welcome' && actualLoginStreak > 0 ? (
                    <LinearGradient
                      colors={['#fc4d00', '#ff7346']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.streakBadge}
                    >
                      <Text style={styles.streakFireIcon}>🔥</Text>
                      <Text style={styles.streakBadgeText}>
                        {actualLoginStreak} {t.home.day}
                      </Text>
                    </LinearGradient>
                  ) : currentSlideData.badge ? (
                    <View style={[styles.countBadge, { backgroundColor: currentSlideData.accentColor }]}>
                      <Text style={styles.countBadgeText}>{currentSlideData.badge}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Middle Row: Avatar (welcome) or Icon + Subtitle */}
                <View style={styles.middleRow}>
                  {hasAvatar ? (
                    <View style={styles.avatarSection}>
                      {/* Rotating gradient ring around avatar */}
                      <Animated.View style={[styles.avatarRing, avatarRingStyle]}>
                        <LinearGradient
                          colors={[COLORS.neonGreen, '#ac8aff', COLORS.neonGreen]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.avatarRingGradient}
                        />
                      </Animated.View>
                      <View style={styles.avatarContainer}>
                        <Image
                          source={{ uri: propUserAvatar || clerkUser?.imageUrl || '' }}
                          style={styles.avatarImage}
                          contentFit="cover"
                          transition={200}
                        />
                      </View>
                      {/* Verified check */}
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark" size={10} color="#0d6100" />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.iconCircle, { backgroundColor: `${currentSlideData.accentColor}15` }]}>
                      {currentSlideData.iconEmoji ? (
                        <Text style={styles.iconEmoji}>{currentSlideData.iconEmoji}</Text>
                      ) : (
                        <Ionicons name={currentSlideData.icon as any} size={28} color={currentSlideData.accentColor} />
                      )}
                    </View>
                  )}

                  <View style={styles.subtitleBlock}>
                    {currentSlideData.type === 'welcome' ? (
                      <>
                        <Text style={styles.levelLabel}>
                          Level {globalState.userProfile?.stats?.level || 1}
                        </Text>
                        <Text style={styles.subtitleText} numberOfLines={1}>
                          {currentSlideData.subtitle}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.subtitleText} numberOfLines={2}>
                        {currentSlideData.subtitle}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Bottom Row: Action Button */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleButtonPress(currentSlideData)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      currentSlideData.type === 'welcome'
                        ? [COLORS.neonGreen, '#2ff801'] as const
                        : [`${currentSlideData.accentColor}40`, `${currentSlideData.accentColor}20`] as const
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.actionButtonGradient,
                      currentSlideData.type === 'welcome' && styles.actionButtonGradientPrimary,
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        currentSlideData.type === 'welcome' && styles.actionButtonTextPrimary,
                      ]}
                    >
                      {currentSlideData.buttonText}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={currentSlideData.type === 'welcome' ? '#0d6100' : '#fff'}
                    />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Dots Indicator */}
                <View style={styles.dotsContainer}>
                  {slides.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleDotPress(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                    >
                      <View
                        style={[
                          styles.dot,
                          currentSlide === index && [
                            styles.dotActive,
                            {
                              backgroundColor: currentSlideData.accentColor,
                              shadowColor: currentSlideData.accentColor,
                            },
                          ],
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});


const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  welcomeSkeletonCard: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // ========================
  // GLASS CARD (Stitch-inspired)
  // ========================
  card: {
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    // Glass-card border: subtle top+left highlight
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderLeftColor: 'rgba(255,255,255,0.05)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.02)',
    borderBottomColor: 'rgba(255,255,255,0.02)',
    // Deep shadow for card lift
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 16,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 25, 30, 0.3)',
    // Expo BlurView can be used here too but this is lighter
  },
  cardContent: {
    flex: 1,
    padding: 22,
    justifyContent: 'space-between',
    zIndex: 10,
  },

  // ========================
  // SHIMMER
  // ========================
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  shimmerGradient: {
    width: 120,
    height: '100%',
  },

  // ========================
  // TOP ROW
  // ========================
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleBlock: {
    flex: 1,
    paddingLeft: 12,
  },
  kickerLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'right',
    letterSpacing: -0.5,
  },

  // Streak Badge (fire)
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    shadowColor: '#fc4d00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  streakFireIcon: {
    fontSize: 12,
  },
  streakBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
  },

  // Count Badge
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ========================
  // MIDDLE ROW (Avatar / Icon + Subtitle)
  // ========================
  middleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },

  // Avatar with animated gradient ring
  avatarSection: {
    position: 'relative',
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  avatarRingGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0e0e11',
    backgroundColor: '#1a1a1e',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.neonGreen,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0e0e11',
  },

  // Icon circle (for non-welcome slides)
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconEmoji: {
    fontSize: 28,
  },

  subtitleBlock: {
    flex: 1,
    paddingHorizontal: 4,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'right',
    marginBottom: 2,
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'right',
    lineHeight: 22,
  },

  // ========================
  // ACTION BUTTON (Stitch-inspired green CTA)
  // ========================
  actionButton: {
    borderRadius: 24,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionButtonGradientPrimary: {
    borderColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  actionButtonTextPrimary: {
    color: '#0d6100',
  },

  // ========================
  // DOTS
  // ========================
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 24,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // ========================
  // GUEST MODE
  // ========================
  guestIconContainer: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  guestEmoji: {
    fontSize: 48,
  },
  guestTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  guestButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
