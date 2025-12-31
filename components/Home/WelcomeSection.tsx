import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
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
import { useHomeStore } from '../../src/store/home.store';
import { globalState } from '../../globalState';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';
import { DailyQuizStatus } from '../../services/quizApi';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = 200;
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
  gradient: string[];
  accentColor: string;
  icon: string;
  title: string;
  subtitle: string;
  buttonText: string;
  onPress: () => void;
  badge?: string;
}

// 🔥 Fire Streak Component
const FireStreak: React.FC<{ days: number; dayLabel: string }> = ({ days, dayLabel }) => {
  const flameAnim1 = useSharedValue(0);
  const flameAnim2 = useSharedValue(0);
  const flameAnim3 = useSharedValue(0);
  const glowAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    // Flame animations with different timings
    flameAnim1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    
    flameAnim2.value = withDelay(150,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    
    flameAnim3.value = withDelay(300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 350, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Glow pulse
    glowAnim.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Scale bounce
    scaleAnim.value = withRepeat(
      withSequence(
        withSpring(1.1, { damping: 8 }),
        withSpring(1, { damping: 8 })
      ),
      -1,
      true
    );
  }, []);

  const flame1Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(flameAnim1.value, [0, 1], [0, -8]) },
      { scale: interpolate(flameAnim1.value, [0, 1], [1, 1.15]) },
    ],
    opacity: interpolate(flameAnim1.value, [0, 0.5, 1], [0.8, 1, 0.8]),
  }));

  const flame2Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(flameAnim2.value, [0, 1], [0, -6]) },
      { scale: interpolate(flameAnim2.value, [0, 1], [0.9, 1.1]) },
    ],
    opacity: interpolate(flameAnim2.value, [0, 0.5, 1], [0.7, 1, 0.7]),
  }));

  const flame3Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(flameAnim3.value, [0, 1], [0, -10]) },
      { scale: interpolate(flameAnim3.value, [0, 1], [0.85, 1.2]) },
    ],
    opacity: interpolate(flameAnim3.value, [0, 0.5, 1], [0.6, 0.9, 0.6]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [1, 1.3]) }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  if (days <= 0) return null;

  return (
    <Animated.View style={[styles.fireContainer, containerStyle]}>
      {/* Glow effect */}
      <Animated.View style={[styles.fireGlow, glowStyle]} />
      
      {/* Fire layers */}
      <View style={styles.fireStack}>
        <Animated.Text style={[styles.fireEmoji, styles.fireLayer3, flame3Style]}>🔥</Animated.Text>
        <Animated.Text style={[styles.fireEmoji, styles.fireLayer2, flame2Style]}>🔥</Animated.Text>
        <Animated.Text style={[styles.fireEmoji, styles.fireLayer1, flame1Style]}>🔥</Animated.Text>
      </View>
      
      {/* Streak count */}
      <View style={styles.streakBadge}>
        <Text style={styles.streakNumber}>{days}</Text>
        <Text style={styles.streakLabel}>{dayLabel}</Text>
      </View>
    </Animated.View>
  );
};

// ✨ Animated Background Particles
const BackgroundParticles: React.FC<{ color: string }> = ({ color }) => {
  const particles = Array.from({ length: 6 }, (_, i) => {
    const anim = useSharedValue(0);
    
    useEffect(() => {
      anim.value = withDelay(
        i * 200,
        withRepeat(
          withTiming(1, { duration: 3000 + i * 500, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        )
      );
    }, []);

    const style = useAnimatedStyle(() => ({
      opacity: interpolate(anim.value, [0, 0.5, 1], [0.1, 0.4, 0.1]),
      transform: [
        { translateY: interpolate(anim.value, [0, 1], [0, -30 - i * 10]) },
        { translateX: interpolate(anim.value, [0, 0.5, 1], [0, (i % 2 === 0 ? 10 : -10), 0]) },
        { scale: interpolate(anim.value, [0, 0.5, 1], [0.5, 1, 0.5]) },
      ],
    }));

    return (
      <Animated.View
        key={i}
        style={[
          styles.particle,
          {
            left: `${15 + i * 15}%`,
            bottom: `${10 + (i % 3) * 20}%`,
            backgroundColor: color,
          },
          style,
        ]}
      />
    );
  });

  return <View style={styles.particlesContainer}>{particles}</View>;
};

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  onRegisterPress,
  onLoginPress,
  onProfilePress,
  onSpinWheelPress,
  onPredictionsPress,
  onQuizPress,
  onRankPress,
  username: propUsername,
  predictionsCount = 0,
  streakDays = 0,
  userRank = 0,
  spinWheelAvailable = true,
  nextSpinTime,
  loginStreak = 0,
  dailyQuizStatus = null,
}) => {
  const { userMode } = useHomeStore();
  const { t } = useTranslation();
  const { user: clerkUser } = useUser();
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [quizCountdown, setQuizCountdown] = useState('');
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation values
  const cardScale = useSharedValue(1);
  const shimmerAnim = useSharedValue(0);

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
      withTiming(1, { duration: 2500, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmerAnim.value, [0, 1], [-width, width]) }],
  }));

  // Use actual login streak or fallback to streakDays
  const actualLoginStreak = loginStreak > 0 ? loginStreak : streakDays;

  const slides: SlideData[] = [
    {
      type: 'welcome',
      gradient: ['#0f0c29', '#302b63', '#24243e'],
      accentColor: '#a855f7',
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
        ? ['#f12711', '#f5af19', '#f37335'] 
        : ['#2c3e50', '#34495e', '#2c3e50'],
      accentColor: spinWheelAvailable ? '#f5af19' : '#7f8c8d',
      icon: 'gift',
      title: spinWheelAvailable ? t.home.luckyWheel : t.home.wheelLocked,
      subtitle: spinWheelAvailable ? t.home.spinAndWin : `${t.home.availableAfter} ${countdown}`,
      buttonText: spinWheelAvailable ? t.home.tryYourLuck : countdown,
      onPress: onSpinWheelPress || (() => {}),
    },
    {
      type: 'predictions',
      gradient: ['#11998e', '#38ef7d', '#0f9b0f'],
      accentColor: '#38ef7d',
      icon: 'football',
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
        ? ['#4776E6', '#8E54E9', '#667eea']
        : ['#2c3e50', '#34495e', '#2c3e50'],
      accentColor: dailyQuizStatus?.canTake ? '#8E54E9' : '#7f8c8d',
      icon: 'bulb',
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
      gradient: ['#f093fb', '#f5576c', '#eb3349'],
      accentColor: '#f5576c',
      icon: 'trophy',
      title: userRank > 0 ? `${t.home.rankPosition} #${userRank}` : t.home.ranking,
      subtitle: t.home.competeWithBest,
      buttonText: t.home.seeYourRank,
      onPress: onRankPress || (() => {}),
      badge: userRank > 0 ? `#${userRank}` : undefined,
    },
  ];

  // Auto scroll
  useEffect(() => {
    if (userMode === 'guest') return;
    
    autoScrollRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, AUTO_SCROLL_INTERVAL);

    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [userMode, slides.length]);

  const handleCardPress = useCallback(() => {
    Haptics.selectionAsync();
    cardScale.value = withSequence(
      withSpring(0.97, { damping: 15 }),
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

  // GUEST MODE
  if (userMode === 'guest') {
    return (
      <Animated.View
        entering={FadeInDown.delay(200).springify().damping(14)}
        style={styles.container}
      >
        <TouchableOpacity activeOpacity={0.95} onPress={onRegisterPress}>
          <LinearGradient
            colors={['#0f0c29', '#302b63', '#24243e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <BackgroundParticles color="#a855f7" />
            
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
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // USER MODE
  const currentSlideData = slides[currentSlide];

  return (
    <Animated.View
      entering={FadeInDown.delay(200).springify().damping(14)}
      style={styles.container}
    >
      <TouchableOpacity activeOpacity={0.98} onPress={handleCardPress}>
        <Animated.View style={cardAnimStyle}>
          <Animated.View
            key={currentSlide}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
          >
            <LinearGradient
              colors={currentSlideData.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              {/* Background particles */}
              <BackgroundParticles color={currentSlideData.accentColor} />
              
              {/* Shimmer effect */}
              <Animated.View style={[styles.shimmer, shimmerStyle]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.shimmerGradient}
                />
              </Animated.View>

              {/* Card content */}
              <View style={styles.cardContent}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  {/* Left: Icon */}
                  <View style={[styles.iconBox, { backgroundColor: `${currentSlideData.accentColor}30` }]}>
                    <Ionicons name={currentSlideData.icon as any} size={28} color="#fff" />
                  </View>
                  
                  {/* Center: Title & Subtitle */}
                  <View style={styles.textContainer}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{currentSlideData.title}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>{currentSlideData.subtitle}</Text>
                  </View>
                  
                  {/* Right: Fire streak or Badge */}
                  {currentSlideData.type === 'welcome' && actualLoginStreak > 0 ? (
                    <FireStreak days={actualLoginStreak} dayLabel={t.home.day} />
                  ) : currentSlideData.badge ? (
                    <View style={[styles.badge, { backgroundColor: currentSlideData.accentColor }]}>
                      <Text style={styles.badgeText}>{currentSlideData.badge}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Action button */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleButtonPress(currentSlideData)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButtonGradient}
                  >
                    <Text style={styles.actionButtonText}>{currentSlideData.buttonText}</Text>
                    <Ionicons name="chevron-back" size={16} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Dots */}
                <View style={styles.dotsContainer}>
                  {slides.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleDotPress(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                    >
                      <Animated.View
                        style={[
                          styles.dot,
                          currentSlide === index && [
                            styles.dotActive,
                            { backgroundColor: currentSlideData.accentColor },
                          ],
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};


const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  
  // Particles
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  // Shimmer
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  shimmerGradient: {
    width: 100,
    height: '100%',
  },
  
  // Header
  cardHeader: {
    flexDirection: 'row-reverse', // RTL layout
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  
  // Fire Streak
  fireContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  fireGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff6b35',
  },
  fireStack: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fireEmoji: {
    position: 'absolute',
    fontSize: 32,
  },
  fireLayer1: {
    zIndex: 3,
  },
  fireLayer2: {
    zIndex: 2,
    opacity: 0.7,
    transform: [{ scale: 0.85 }, { translateX: -5 }],
  },
  fireLayer3: {
    zIndex: 1,
    opacity: 0.5,
    transform: [{ scale: 0.7 }, { translateX: 5 }],
  },
  streakBadge: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#ff6b35',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 2,
    borderColor: '#fff',
  },
  streakNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  streakLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  
  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 40,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Text
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'right',
    lineHeight: 18,
  },
  
  // Action Button
  actionButton: {
    alignSelf: 'flex-start', // RTL - button on right side
    borderRadius: 20,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row-reverse', // RTL
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  
  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 24,
  },
  
  // Guest Mode
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
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
