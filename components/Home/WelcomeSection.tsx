import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { COLORS } from '../reels/constants';
import { useHomeStore } from '../../src/store/home.store';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = 240; // Taller for cinematic feel

interface WelcomeSectionProps {
  onRegisterPress: () => void;
  onLoginPress: () => void;
  onProfilePress: () => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  onRegisterPress,
  onLoginPress,
  onProfilePress,
}) => {
  const { userMode } = useHomeStore();

  // Animation Values
  const glowAnim = useSharedValue(0);
  const floatAnim = useSharedValue(0);
  const spotlightAnim = useSharedValue(0);

  useEffect(() => {
    // Continuous breathing glow
    glowAnim.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Subtle floating movement
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Spotlight sweep
    spotlightAnim.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.4, 0.8]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [1, 1.05]) }],
  }));

  const spotlightStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      spotlightAnim.value,
      [0, 1],
      [-width, width],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ translateX }, { skewX: '-25deg' }],
      opacity: interpolate(spotlightAnim.value, [0, 0.2, 0.8, 1], [0, 0.5, 0.5, 0]),
    };
  });

  // GUEST MODE: Cinematic Call to Action
  if (userMode === 'guest') {
    return (
      <Animated.View
        entering={FadeInDown.delay(200).springify().damping(14)}
        style={styles.container}
      >
        <View style={styles.cinematicWrapper}>
          {/* Background Layer */}
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=800&q=80' }}
            style={styles.bgImage}
            imageStyle={styles.bgImageStyle}
          >
            {/* Subtle Gradient Overlay - Much Lighter */}
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.75)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Tech Mesh Overlay (Simulated with repeating gradient) */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 240, 255, 0.03)', 'transparent']}
              style={[StyleSheet.absoluteFill, { transform: [{ rotate: '45deg' }] }]}
            />

            {/* Floating Glass Interface */}
            <Animated.View style={[styles.glassInterface, floatStyle]}>
              <BlurView intensity={30} tint="dark" style={styles.glassContent}>
                {/* Glass Reflection/Sheen */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 0.5 }}
                  style={styles.glassSheen}
                />

                <View style={styles.contentPadding}>
                  <Animated.View entering={FadeInUp.delay(400)}>
                    <View style={styles.tagWrapper}>
                      <View style={styles.tagDot} />
                      <Text style={styles.tagText}>NEXT GEN FANTASY</Text>
                    </View>

                    <Text style={styles.heroTitle}>
                      <Text style={styles.heroTitleOutline}>UNLOCK</Text>{'\n'}
                      <Text style={styles.heroTitleFilled}>POTENTIAL</Text>
                    </Text>

                    <Text style={styles.heroSubtitle}>
                      Compete. Predict. Rise.
                    </Text>
                  </Animated.View>

                  <View style={styles.holoButtonRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={onRegisterPress}
                      style={styles.holoBtnWrapper}
                    >
                      <Animated.View style={styles.holoBtnPrimary}>
                        <LinearGradient
                          colors={[COLORS.neonGreen, 'rgba(57, 255, 20, 0.6)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.holoGradient}
                        >
                          <Text style={styles.holoBtnTextPrimary}>GET STARTED</Text>
                          <Ionicons name="arrow-forward" size={18} color={COLORS.deepBlack} />

                          {/* Button Shine Animation */}
                          <Animated.View style={[styles.btnShine, spotlightStyle]} />
                        </LinearGradient>
                      </Animated.View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={onLoginPress}
                      style={styles.holoBtnWrapper}
                    >
                      <View style={styles.holoBtnSecondary}>
                        <Text style={styles.holoBtnTextSecondary}>SIGN IN</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>
            </Animated.View>
          </ImageBackground>
        </View>
      </Animated.View>
    );
  }

  // USER MODE: Simple & Clean
  return (
    <Animated.View
      entering={FadeInDown.delay(200).springify().damping(14)}
      style={styles.container}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onProfilePress}
      >
        <View style={styles.cinematicWrapper}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=800&q=80' }}
            style={styles.bgImage}
            imageStyle={styles.bgImageStyle}
          >
            {/* Clean Gradient Overlay */}
            <LinearGradient
              colors={['rgba(0,180,216,0.6)', 'rgba(0,180,216,0.7)', 'rgba(0,100,150,0.85)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Simple Content */}
            <View style={styles.simpleContentWrapper}>
              <View style={styles.simpleTextContainer}>
                <Text style={styles.simpleWelcome}>Welcome Back,</Text>
                <Text style={styles.simpleName}>Ahmed Eltwaheed</Text>
              </View>

              {/* PRO Badge */}
              <View style={styles.simpleProBadge}>
                <Text style={styles.simpleProText}>PRO</Text>
              </View>
            </View>
          </ImageBackground>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 30,
    marginHorizontal: 16,
    shadowColor: COLORS.neonGreen,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
  },
  cinematicWrapper: {
    height: CARD_HEIGHT,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  bgImageStyle: {
    borderRadius: 30,
  },
  glassInterface: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  glassContent: {
    padding: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  contentPadding: {
    padding: 20,
  },
  tagWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.neonGreen,
    shadowColor: COLORS.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  tagText: {
    color: COLORS.neonGreen,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heroTitle: {
    marginBottom: 4,
  },
  heroTitleOutline: {
    fontSize: 32,
    fontWeight: '900',
    color: 'transparent', // Outline effect would need text-stroke, simulating with color/shadow for now or just white
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  heroTitleFilled: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
    fontStyle: 'italic',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  holoButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  holoBtnWrapper: {
    flex: 1,
  },
  holoBtnPrimary: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  holoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  holoBtnTextPrimary: {
    color: COLORS.deepBlack,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
  },
  holoBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  holoBtnTextSecondary: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  btnShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ skewX: '-20deg' }],
  },

  // User Mode
  ambientGlow: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.neonBlue,
    opacity: 0.3,
    blurRadius: 50, // Note: blurRadius on View is not supported on all platforms, opacity handles the glow feel
  },
  userContentPadding: {
    padding: 20,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.neonBlue,
    marginRight: 12,
    position: 'relative',
  },
  avatarImage: {
    flex: 1,
    borderRadius: 23,
    overflow: 'hidden',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.neonGreen,
    borderWidth: 2,
    borderColor: '#000',
  },
  userInfoText: {
    flex: 1,
  },
  welcomeLabel: {
    color: COLORS.neonBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  usernameLabel: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  proTag: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.neonBlue,
  },
  proTagText: {
    color: COLORS.neonBlue,
    fontSize: 10,
    fontWeight: '900',
  },
  hudStats: {
    flexDirection: 'row',
    gap: 16,
  },
  hudItem: {
    flex: 1,
  },
  hudLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  hudValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  hudBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  hudBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  hudDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Simple User Mode Styles
  simpleContentWrapper: {
    flex: 1,
    paddingHorizontal: 30,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  simpleTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  simpleWelcome: {
    fontSize: 28,
    fontWeight: '400',
    color: COLORS.white,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 4,
  },
  simpleName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.white,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  simpleProBadge: {
    position: 'absolute',
    top: 30,
    right: 30,
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  simpleProText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});