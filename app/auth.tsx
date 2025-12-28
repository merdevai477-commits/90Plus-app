import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Chrome,
  Apple,
  Gamepad2,
  Trophy,
} from 'lucide-react-native';
import { globalState } from '../globalState';
import { COLORS, GRADIENTS, EFFECTS } from '../components/reels/constants';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background breathing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(bgAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const switchMode = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: isLogin ? 50 : -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsLogin(!isLogin);
      slideAnim.setValue(isLogin ? -50 : 50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleAuth = async () => {
    setIsLoading(true);
    // Simulate network request
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (isLogin) {
      if (email === 'mahmoud_essam' && password === 'password') {
        globalState.setUserType('diamond');
        // ... (Set user profile logic same as before)
        globalState.setUserProfile({
          id: 'mahmoud-essam-1',
          username: 'mahmoud_essam',
          displayName: 'Mahmoud Essam',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
          coverImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=200&fit=crop',
          weight: 75,
          height: 180,
          age: 25,
          strongFoot: 'right',
          position: 'مهاجم',
          favoriteClub: {
            name: 'ريال مدريد',
            logo: 'https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-Logo.png',
            country: 'إسبانيا'
          },
          bio: 'مطور التطبيق ومحلل رياضي محترف. أحب مشاركة معرفتي وخبرتي في عالم كرة القدم مع المجتمع.',
          stats: {
            views: 125000,
            likes: 8500,
            questionsSolved: 250,
            rating: 4.8,
            posts: 45,
            predictions: 180,
            interactions: 12000,
            level: 15,
            followers: 85000,
            following: 450,
            monthlyViews: 25000,
            yearlyViews: 300000,
            engagementRate: 8.5,
            contentQuality: 9.2
          },
          videos: [], // Simplified for brevity, can add back if needed
          badges: [],
          achievements: [],
          socialStats: { followers: [], following: [] },
          notifications: [],
          isOwner: true,
          isVerified: true,
          isAppOwner: true
        });
        router.replace('/(tabs)/diamond-profile');
      } else if (email === 'admen12' && password === '187m') {
        globalState.setUserType('admin');
        globalState.setUserProfile({
          id: 'diamond-user',
          username: 'M.Essam',
          displayName: 'محمد عصام',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
          weight: 70,
          height: 171,
          age: 28,
          strongFoot: 'right',
          position: 'RB',
          favoriteClub: {
            name: 'الأهلي',
            logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Ahly_SC_logo.png',
            country: 'مصر'
          },
          isVerified: true,
          bio: 'مطور ومؤسس تطبيق كرة القدم الأول في المنطقة العربية 🚀⚽\n\nمؤسس شركة Football Tech\nخبير في تطوير التطبيقات الرياضية\nعاشق كرة القدم منذ الطفولة',
          stats: {
            views: 200000,
            likes: 12000,
            questionsSolved: 89,
            rating: 4.9,
            posts: 120,
            predictions: 1250,
            interactions: 15600,
            level: 25,
            followers: 125000,
            following: 800,
            monthlyViews: 45000,
            yearlyViews: 540000,
            engagementRate: 9.2,
            contentQuality: 9.5
          },
          videos: [],
          badges: [],
          achievements: [],
          socialStats: { followers: [], following: [] },
          notifications: [],
          isOwner: true
        });
        router.replace('/(tabs)/Home');
      } else {
        Alert.alert('Error', 'Invalid credentials');
        setIsLoading(false);
      }
    } else {
      // Sign Up Logic (Mock)
      Alert.alert('Success', 'Account created successfully!');
      setIsLogin(true);
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    globalState.setUserType('guest');
    router.replace('/(tabs)/Home');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Dynamic Background */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}>
        <LinearGradient
          colors={[COLORS.deepBlack, '#0a1f0a', COLORS.deepBlack]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Animated Orbs */}
        <Animated.View
          style={[
            styles.orb,
            {
              top: -100,
              left: -50,
              backgroundColor: COLORS.neonGreen,
              transform: [
                { scale: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) },
                { translateX: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }
              ]
            }
          ]}
        />
        <Animated.View
          style={[
            styles.orb,
            {
              bottom: -100,
              right: -50,
              backgroundColor: COLORS.electricGreen,
              width: 300,
              height: 300,
              transform: [
                { scale: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1] }) },
                { translateY: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }
              ]
            }
          ]}
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Trophy size={48} color={COLORS.neonGreen} />
              <View style={styles.logoGlow} />
            </View>
            <Text style={styles.appName}>Football Pro</Text>
            <Text style={styles.tagline}>
              {isLogin ? 'Welcome back, Champion!' : 'Join the Elite Community'}
            </Text>
          </View>

          {/* Toggle Switch */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, isLogin && styles.activeToggle]}
              onPress={() => !isLogin && switchMode()}
            >
              <Text style={[styles.toggleText, isLogin && styles.activeToggleText]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !isLogin && styles.activeToggle]}
              onPress={() => isLogin && switchMode()}
            >
              <Text style={[styles.toggleText, !isLogin && styles.activeToggleText]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Form Section */}
          <Animated.View
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }]
              }
            ]}
          >
            {!isLogin && (
              <View style={styles.inputWrapper}>
                <User color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textTertiary}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Mail color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={COLORS.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Lock color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                {showPassword ? (
                  <EyeOff color={COLORS.textTertiary} size={20} />
                ) : (
                  <Eye color={COLORS.textTertiary} size={20} />
                )}
              </TouchableOpacity>
            </View>

            {isLogin && (
              <TouchableOpacity style={styles.forgotPass}>
                <Text style={styles.forgotPassText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.mainButton}
                onPress={handleAuth}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={GRADIENTS.greenGlow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.mainButtonText}>
                    {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                  </Text>
                  {!isLoading && <ArrowRight color={COLORS.deepBlack} size={20} strokeWidth={2.5} />}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Social Login */}
          <View style={styles.socialSection}>
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.socialButtons}>
              <TouchableOpacity style={styles.socialBtn}>
                <Chrome color="#fff" size={24} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn}>
                <Apple color="#fff" size={24} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Guest Access */}
          <TouchableOpacity style={styles.guestButton} onPress={handleGuest}>
            <Gamepad2 color={COLORS.neonGreen} size={20} style={{ marginRight: 8 }} />
            <Text style={styles.guestText}>Continue as Guest</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepBlack,
  },
  orb: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.15,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(50, 205, 50, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.neonGreen,
    ...EFFECTS.greenGlow,
  },
  logoGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: COLORS.neonGreen,
    opacity: 0.2,
    zIndex: -1,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeToggle: {
    backgroundColor: 'rgba(50, 205, 50, 0.15)',
  },
  toggleText: {
    color: COLORS.textTertiary,
    fontWeight: '600',
    fontSize: 16,
  },
  activeToggleText: {
    color: COLORS.neonGreen,
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPassText: {
    color: COLORS.neonGreen,
    fontSize: 14,
    fontWeight: '600',
  },
  mainButton: {
    width: '100%',
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
    ...EFFECTS.greenGlow,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  mainButtonText: {
    color: COLORS.deepBlack,
    fontSize: 18,
    fontWeight: 'bold',
  },
  socialSection: {
    marginTop: 40,
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: COLORS.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 16,
    letterSpacing: 1,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  guestButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  guestText: {
    color: COLORS.neonGreen,
    fontSize: 16,
    fontWeight: '600',
  },
});