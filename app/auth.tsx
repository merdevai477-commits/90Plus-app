import { AntDesign, Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { globalState } from '../globalState';
import React, { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // AMOLED transition animation refs
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const ballScale = useRef(new Animated.Value(0.6)).current;
  const ballRotate = useRef(new Animated.Value(0)).current;

  // Background and image subtle animations
  const bgAnim = useRef(new Animated.Value(0)).current;
  const imageFloat = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 3500, useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 3500, useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(imageFloat, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(imageFloat, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, [bgAnim, imageFloat]);

  const startAmoledTransition = (navigate: () => void) => {
    setIsTransitioning(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(ballScale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(ballRotate, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        navigate();
      }, 150);
    });
  };

  const handleSignIn = () => {
    if (email === 'mahmoud_essam' && password === 'password') {
      // ربط حساب Mahmoud Essam بالبروفايل الماسي
      globalState.setUserType('diamond');
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
          level: 15
        },
        videos: [
          {
            id: '1',
            title: 'تحليل مباراة ريال مدريد ضد برشلونة',
            thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=225&fit=crop',
            duration: '5:30',
            views: 15000,
            likes: 850,
            uploadDate: '2024-01-15'
          },
          {
            id: '2',
            title: 'أفضل أهداف الأسبوع',
            thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=225&fit=crop',
            duration: '3:45',
            views: 8500,
            likes: 420,
            uploadDate: '2024-01-12'
          },
          {
            id: '3',
            title: 'توقعات مباريات نهاية الأسبوع',
            thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=225&fit=crop',
            duration: '7:20',
            views: 12000,
            likes: 680,
            uploadDate: '2024-01-10'
          },
          {
            id: '4',
            title: 'مراجعة تشكيلة المنتخب الوطني',
            thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=225&fit=crop',
            duration: '4:15',
            views: 9500,
            likes: 520,
            uploadDate: '2024-01-08'
          },
          {
            id: '5',
            title: 'أفضل لحظات كأس العالم',
            thumbnail: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&h=225&fit=crop',
            duration: '6:45',
            views: 18000,
            likes: 1200,
            uploadDate: '2024-01-05'
          }
        ],
        isOwner: true,
        isVerified: true,
        isAppOwner: true
      });
      startAmoledTransition(() => router.replace('/(tabs)/diamond-profile'));
    } else if (email === 'admen12' && password === '187m') {
      // الحساب القديم للمدير
      globalState.setUserType('admin');
      globalState.setUserProfile({
        id: 'diamond-user',
        username: 'M.Essam',
        displayName: 'محمد عصام',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        weight: 70,
        height: 171,
        strongFoot: 'right',
        position: 'RB',
        favoriteClub: {
          name: 'الأهلي',
          logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Ahly_SC_logo.png',
          country: 'مصر'
        },
        cardType: 'diamond',
        isVerified: true,
        followers: 125000,
        bio: 'مطور ومؤسس تطبيق كرة القدم الأول في المنطقة العربية 🚀⚽\n\nمؤسس شركة Football Tech\nخبير في تطوير التطبيقات الرياضية\nعاشق كرة القدم منذ الطفولة',
        stats: {
          predictions: 1250,
          questions: 89,
          interactions: 15600,
          level: 25
        },
        isOwner: true
      });
      startAmoledTransition(() => router.replace('/(tabs)/Home'));
    } else {
      Alert.alert('خطأ', 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleGoogleSignIn = () => {
    // Handle Google sign in
    console.log('Google sign in');
  };

  const handleAppleSignIn = () => {
    // Handle Apple sign in
    console.log('Apple sign in');
  };

  const handleContinueAsGuest = () => {
    globalState.setUserType('guest');
    startAmoledTransition(() => router.replace('/(tabs)/Home'));
  };

  const handleSignUp = () => {
    // Navigate to sign up screen
    console.log('Navigate to sign up');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {/* Animated background blobs - brown & gold */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={{
            position: 'absolute',
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: 'rgba(139, 92, 24, 0.22)',
            top: -60,
            left: -60,
            transform: [
              { translateX: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0, 20] }) },
              { translateY: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0, 10] }) },
              { scale: bgAnim.interpolate({ inputRange: [0,1], outputRange: [1, 1.07] }) },
            ],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: 210,
            backgroundColor: 'rgba(212, 175, 55, 0.18)',
            bottom: -100,
            right: -120,
            transform: [
              { translateX: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0, -20] }) },
              { translateY: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0, -10] }) },
              { scale: bgAnim.interpolate({ inputRange: [0,1], outputRange: [1.03, 0.97] }) },
            ],
          }}
        />
        {/* Green football accent */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: 'rgba(16, 185, 129, 0.16)',
            bottom: -60,
            left: -40,
            transform: [
              { translateX: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0, 14] }) },
              { translateY: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0, -8] }) },
              { scale: bgAnim.interpolate({ inputRange: [0,1], outputRange: [1, 1.05] }) },
            ],
          }}
        />

        {/* Stadium lights */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 260,
            height: 260,
            borderRadius: 130,
            top: -80,
            right: -40,
            backgroundColor: 'rgba(255,255,255,0.06)',
            opacity: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0.45, 0.7] }),
            transform: [
              { rotate: '-18deg' },
              { scaleX: 1.3 },
              { scaleY: 0.8 },
            ],
            shadowColor: '#fff',
            shadowOpacity: 0.15,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            width: 260,
            height: 260,
            borderRadius: 130,
            top: -70,
            left: -30,
            backgroundColor: 'rgba(255,255,255,0.05)',
            opacity: bgAnim.interpolate({ inputRange: [0,1], outputRange: [0.4, 0.65] }),
            transform: [
              { rotate: '16deg' },
              { scaleX: 1.2 },
              { scaleY: 0.75 },
            ],
            shadowColor: '#fff',
            shadowOpacity: 0.12,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </View>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stadium Image */}
          <View style={styles.imageContainer}>
            <Animated.Image
              source={require('../assets/images/football.jpg')}
              style={[
                styles.stadiumImage,
                {
                  transform: [
                    {
                      translateY: imageFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -10] })
                    },
                    {
                      scale: imageFloat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] })
                    },
                    {
                      rotate: imageFloat.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-2deg'] })
                    },
                  ]
                }
              ]}
              resizeMode="cover"
            />
          </View>

          {/* Title and Subtitle */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Football Pro</Text>
            <Text style={styles.subtitle}>Join the ultimate football community</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Feather name="mail" color="#8a8a8a" size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Email address"
                placeholderTextColor="#7a7a7a"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Feather name="lock" color="#8a8a8a" size={20} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor="#7a7a7a"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <Ionicons name="eye-off-outline" color="#a5a5a5" size={22} />
                ) : (
                  <Ionicons name="eye-outline" color="#a5a5a5" size={22} />
                )}
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <Pressable onPress={handleSignIn} style={({ pressed }) => [
              styles.signInButton,
              pressed && styles.buttonPressed
            ]}>
              <Text style={styles.signInButtonText}>Sign In</Text>
            </Pressable>

            {/* Divider */}
            <Text style={styles.dividerText}>or continue with</Text>

            {/* Social Buttons */}
            <View style={styles.socialButtonsContainer}>
              <Pressable onPress={handleGoogleSignIn} style={({ pressed }) => [styles.socialButton, pressed && styles.socialPressed]}>
                <View style={styles.socialInner}>
                  <AntDesign name="google" size={18} color="#fff" style={styles.socialIcon} />
                  <Text style={styles.socialButtonText}>Google</Text>
                </View>
              </Pressable>
              <Pressable onPress={handleAppleSignIn} style={({ pressed }) => [styles.socialButton, pressed && styles.socialPressed]}>
                <View style={styles.socialInner}>
                  <Ionicons name="logo-apple" size={20} color="#fff" style={styles.socialIcon} />
                  <Text style={styles.socialButtonText}>Apple</Text>
                </View>
              </Pressable>
            </View>

            {/* Continue as Guest */}
            <Pressable onPress={handleContinueAsGuest} style={({ pressed }) => [styles.guestButton, pressed && styles.guestPressed]}>
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </Pressable>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={handleSignUp}>
                <Text style={styles.signUpLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* AMOLED Transition Overlay */}
      {isTransitioning && (
        <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: overlayOpacity }] }>
          <Animated.View
            style={[
              styles.overlayIconWrap,
              {
                transform: [
                  { scale: ballScale },
                  {
                    rotate: ballRotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    })
                  }
                ]
              }
            ]}
          >
            <Ionicons name="football" size={120} color="#d4af37" />
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  stadiumImage: {
    width: 280,
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#222',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 16,
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  signInButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
    shadowColor: '#22c55e',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#1fb455',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  socialInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialIcon: {
    marginRight: 8,
  },
  socialPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#151515',
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  guestButton: {
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  guestPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#071a10',
  },
  guestButtonText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  signUpText: {
    color: '#666',
    fontSize: 14,
  },
  signUpLink: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBall: {
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  overlayIconWrap: {
    width: 160,
    height: 160,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3a2a0a',
    backgroundColor: 'rgba(0,0,0,0.6)'
  },
});