import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
    Modal,
    Image,
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
    Trophy,
    Gamepad2,
    Chrome,
    Apple as AppleIcon,
    X,
    KeyRound,
} from 'lucide-react-native';
import { COLORS, GRADIENTS, EFFECTS } from '../../components/reels/constants';
import { useSignIn, useSignUp, useOAuth, useAuth } from '@clerk/clerk-expo';
import { useTranslation } from '../../src/i18n';
import { globalState } from '../../globalState';
import { useHomeStore } from '../../src/store/home.store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { AuthService } from '../../src/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthLoadingScreen from '../../components/AuthLoadingScreen';
import { TermsService } from '../../services/termsService';
import { getApiUrl } from '../../config/api.config';
import { logger } from '../../utils/logger';
import { CoinsService } from '../../services/coins.service';
import { rankingsService } from '../../services/rankingsService';
import { websocketClient } from '../../services/websocketClient';
import { cacheService } from '../../services/cacheService';
import { preloadManager } from '../../services/preloadManager';

WebBrowser.maybeCompleteAuthSession();

/**
 * 🐉 DRAGON FIX: Clear all previous user data with proper coordination
 * Prevents race conditions and ensures complete cleanup
 * ✅ OPTIMIZED: Reduced timeout from 5s to 2s for faster logout
 */
const clearPreviousUserData = async () => {
    logger.debug('🧹 Clearing previous user data...');
    
    const cleanupOperations = [
        globalState.logout().catch(err => {
            logger.error('Failed to clear globalState:', err);
            return null;
        }),
        
        (async () => {
            try {
                CoinsService.clearCurrentUser();
                logger.debug('✅ CoinsService cleared');
            } catch (error) {
                logger.error('Failed to clear CoinsService:', error);
            }
        })(),
        
        (async () => {
            try {
                AuthService.clearMemoryCache();
                logger.debug('✅ AuthService cache cleared');
            } catch (error) {
                logger.error('Failed to clear AuthService cache:', error);
            }
        })(),
        
        (async () => {
            try {
                rankingsService.clearMemoryCache();
                logger.debug('✅ RankingsService cache cleared');
            } catch (error) {
                logger.error('Failed to clear RankingsService cache:', error);
            }
        })(),
        
        (async () => {
            try {
                useHomeStore.getState().clearUserData();
                logger.debug('✅ Home store cleared');
            } catch (error) {
                logger.error('Failed to clear home store:', error);
            }
        })(),
        
        (async () => {
            try {
                websocketClient.disconnect();
                logger.debug('✅ WebSocket disconnected');
            } catch (error) {
                logger.error('Failed to disconnect WebSocket:', error);
            }
        })(),
    ];
    
    // ✅ OPTIMIZATION: Reduced timeout from 5000ms to 2000ms
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cleanup timeout')), 2000)
    );
    
    try {
        await Promise.race([
            Promise.allSettled(cleanupOperations),
            timeoutPromise
        ]);
        logger.info('✅ User data cleanup completed');
    } catch (error) {
        logger.error('⚠️ Cleanup timeout - some operations may not have completed:', error);
    }
    
    try {
        await cacheService.clearAll();
        console.log('✅ Cache service cleared');
    } catch (error) {
        console.warn('⚠️ Failed to clear cache service:', error);
    }
    
    await AsyncStorage.removeItem('@username_setup_complete');
    await AsyncStorage.removeItem('@user_profile');
    console.log('✅ Previous user data cleared');
};

export default function AuthScreen() {
    const { t } = useTranslation();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadingScreen, setShowLoadingScreen] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    // Logo animation values
    const logoScale = useRef(new Animated.Value(1)).current;
    const logoOpacity = useRef(new Animated.Value(1)).current;
    const glowOpacity = useRef(new Animated.Value(0.3)).current;

    const { signIn, setActive: setActiveSignIn } = useSignIn();
    const { signUp, setActive: setActiveSignUp } = useSignUp();

    // Logo animation effect
    useEffect(() => {
        // Pulse animation (scale)
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(logoScale, {
                    toValue: 1.05,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(logoScale, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );

        // Glow animation (opacity)
        const glowAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(glowOpacity, {
                    toValue: 0.6,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(glowOpacity, {
                    toValue: 0.3,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        );

        // Fade animation for logo
        const fadeAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(logoOpacity, {
                    toValue: 0.9,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        );

        pulseAnimation.start();
        glowAnimation.start();
        fadeAnimation.start();

        return () => {
            pulseAnimation.stop();
            glowAnimation.stop();
            fadeAnimation.stop();
        };
    }, []);

    /**
     * Translate Clerk error messages to Arabic
     */
    const getArabicErrorMessage = (error: any): string => {
        const errorCode = error.errors?.[0]?.code;
        const errorMessage = error.errors?.[0]?.message || error.message || '';

        // Common Clerk error codes
        const errorTranslations: Record<string, string> = {
            'form_identifier_exists': 'هذا البريد الإلكتروني مسجل بالفعل',
            'form_password_pwned': 'كلمة المرور ضعيفة جداً، اختر كلمة مرور أقوى',
            'form_password_length_too_short': 'كلمة المرور قصيرة جداً (8 أحرف على الأقل)',
            'form_identifier_not_found': 'البريد الإلكتروني غير مسجل',
            'form_password_incorrect': 'كلمة المرور غير صحيحة',
            'form_code_incorrect': 'رمز التحقق غير صحيح',
            'too_many_requests': 'محاولات كثيرة، حاول مرة أخرى لاحقاً',
            'session_exists': 'أنت مسجل دخول بالفعل',
            'form_param_format_invalid': 'صيغة البريد الإلكتروني غير صحيحة',
        };

        if (errorCode && errorTranslations[errorCode]) {
            return errorTranslations[errorCode];
        }

        // Check message content for common patterns
        if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('taken')) {
            return 'هذا البريد الإلكتروني مسجل بالفعل';
        }
        if (errorMessage.toLowerCase().includes('password') && errorMessage.toLowerCase().includes('incorrect')) {
            return 'كلمة المرور غير صحيحة';
        }
        if (errorMessage.toLowerCase().includes('not found')) {
            return 'البريد الإلكتروني غير مسجل';
        }
        if (errorMessage.toLowerCase().includes('invalid')) {
            return 'البيانات المدخلة غير صحيحة';
        }

        return 'حدث خطأ، حاول مرة أخرى';
    };
    const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
    const { startOAuthFlow: startAppleOAuth } = useOAuth({ strategy: 'oauth_apple' });
    const { getToken } = useAuth();

    /**
     * Sync user with backend after successful authentication
     * This loads the user's saved data from the database
     * Returns: { success: boolean, isNewUser: boolean }
     */
    const syncUserWithBackend = async (): Promise<{ success: boolean; isNewUser: boolean }> => {
        try {
            // ✅ OPTIMIZATION: Reduced wait time from 500ms to 200ms
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const token = await getToken();
            if (!token) {
                console.error('❌ No token available for sync');
                return { success: false, isNewUser: false };
            }

            // ✅ FIX: Add retry logic for sync failures (3 attempts)
            let user = null;
            let retries = 3;
            
            while (retries > 0 && !user) {
                try {
                    user = await AuthService.syncUserWithBackend(token);
                    if (user) break;
                } catch (syncError) {
                    console.warn(`⚠️ Sync attempt failed, ${retries - 1} retries left`, syncError);
                    retries--;
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (user) {
                // User successfully synced with backend database
                console.log('✅ User synced with backend:', user.username);
                
                // Check if user is new (no favorite team set)
                const isNewUser = !user.favoriteTeam;
                
                // IMPORTANT: Save user data to globalState
                // This ensures the profile shows the correct saved data
                globalState.username = user.username;
                globalState.setUserProfile({
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName || user.username,
                    avatar: user.avatar || undefined,
                    bio: user.bio || undefined,
                    stats: {
                        views: 0, likes: 0, questionsSolved: 0, rating: 0, posts: 0,
                        predictions: 0, interactions: 0, level: user.level || 1, followers: 0, following: 0,
                        monthlyViews: 0, yearlyViews: 0, engagementRate: 0, contentQuality: 0,
                    },
                    videos: [], badges: [], achievements: [],
                    socialStats: { followers: [], following: [] },
                    notifications: [],
                    isOwner: true, 
                    isVerified: user.isVerified || false, 
                    isAppOwner: user.isDeveloper || false,
                });
                
                // Mark username setup as complete since user already has a username
                await AsyncStorage.setItem('@username_setup_complete', 'true');
                
                return { success: true, isNewUser };
            }
            
            console.error('❌ Failed to sync user after all retries');
            return { success: false, isNewUser: false };
        } catch (error) {
            console.error('❌ Failed to sync with backend:', error);
            return { success: false, isNewUser: false };
        }
    };

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const bgAnim = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
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
        if (!email || !password) {
            Alert.alert(t.common.error, t.common.fillAllFields);
            return;
        }

        setIsLoading(true);

        try {
            if (isLogin) {
                // Login with Clerk
                if (!signIn) {
                    Alert.alert(t.common.error, t.common.loginServiceUnavailable);
                    setIsLoading(false);
                    return;
                }

                const result = await signIn.create({
                    identifier: email,
                    password: password,
                });

                if (result.status === 'complete') {
                    // Show loading screen
                    setLoadingMessage(t.common.loggingIn);
                    setShowLoadingScreen(true);
                    setIsLoading(false);

                    try {
                        // ✅ OPTIMIZATION: Run operations in parallel
                        const [, syncResult] = await Promise.all([
                            clearPreviousUserData(),
                            setActiveSignIn({ session: result.createdSessionId }).then(() => {
                                console.log('🔄 Syncing user with backend...');
                                return syncUserWithBackend();
                            })
                        ]);

                        // ✅ FIX: Check if sync was successful
                        if (!syncResult.success) {
                            console.error('❌ Sync failed, but continuing...');
                            setShowLoadingScreen(false);
                            Alert.alert(
                                'تحذير',
                                'تم تسجيل الدخول لكن فشل تحميل بعض البيانات. يمكنك المتابعة.',
                                [
                                    {
                                        text: 'متابعة',
                                        onPress: () => {
                                            globalState.setUserType('diamond');
                                            useHomeStore.getState().setUserMode('diamond');
                                            router.replace('/(tabs)/Home');
                                        }
                                    }
                                ]
                            );
                            return;
                        }

                        // ✅ Start background preloading immediately after login (non-blocking)
                        preloadManager.initialize(getToken).catch(err => {
                            console.warn('[Auth] Preload initialization failed (non-critical):', err);
                        });
                        console.log('✅ Background preloading started');

                        // Set user as authenticated
                        globalState.setUserType('diamond');
                        useHomeStore.getState().setUserMode('diamond');

                        // ✅ OPTIMIZATION: Reduced delay from 1500ms to 800ms
                        setTimeout(() => {
                            // If new user, go to onboarding, otherwise go to home
                            if (syncResult.isNewUser) {
                                router.replace('/onboarding');
                            } else {
                                router.replace('/(tabs)/Home');
                            }
                        }, 800);
                    } catch (syncError) {
                        console.error('❌ Login sync error:', syncError);
                        setShowLoadingScreen(false);
                        Alert.alert(
                            'خطأ',
                            'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.',
                            [
                                {
                                    text: 'حاول مرة أخرى',
                                    onPress: () => {
                                        // Reset form
                                        setEmail('');
                                        setPassword('');
                                    }
                                }
                            ]
                        );
                    }
                } else {
                    setShowLoadingScreen(false);
                    Alert.alert(t.common.error, t.common.operationFailed);
                }
            } else {
                // Sign up - Check terms acceptance
                if (!name) {
                    Alert.alert('خطأ', 'يرجى إدخال الاسم');
                    setIsLoading(false);
                    return;
                }

                if (!termsAccepted) {
                    Alert.alert('خطأ', 'يجب الموافقة على الشروط والأحكام للمتابعة');
                    setIsLoading(false);
                    return;
                }

                // Proceed with signup
                await handleSignup();
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            setShowLoadingScreen(false); // ✅ FIX: Always hide loading screen on error
            const errorMessage = getArabicErrorMessage(error);
            Alert.alert('خطأ', errorMessage);
        } finally {
            if (isLogin) {
                setIsLoading(false);
                setShowLoadingScreen(false); // ✅ FIX: Ensure loading screen is hidden
            }
        }
    };

    /**
     * Handle signup after terms acceptance
     */
    const handleSignup = async () => {
        setIsLoading(true);

        try {
            const signupEmail = email;
            const signupPassword = password;
            const signupName = name;

            if (!signUp) {
                Alert.alert('خطأ', 'خدمة التسجيل غير متاحة');
                setIsLoading(false);
                return;
            }

            let result;
            try {
                result = await signUp.create({
                    emailAddress: signupEmail,
                    password: signupPassword,
                    firstName: signupName.split(' ')[0],
                    lastName: signupName.split(' ').slice(1).join(' ') || undefined,
                });
                console.log('📧 SignUp result status:', result.status);
            } catch (createError: any) {
                console.error('SignUp create error:', createError);
                const errorMessage = getArabicErrorMessage(createError);
                Alert.alert('خطأ', errorMessage);
                setIsLoading(false);
                return;
            }

            // Accept terms in backend (will be recorded after email verification)
            try {
                const terms = await TermsService.getLatestTerms();
                // Store terms version to accept after verification
                await AsyncStorage.setItem('@pending_terms_version', terms.version);
            } catch (termsError) {
                console.warn('Failed to get terms version:', termsError);
            }

            // Send email verification
            try {
                await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
                console.log('📧 Verification email sent, showing modal...');
            } catch (verifyError: any) {
                console.error('Prepare verification error:', verifyError);
            }

            // Always show verification modal after sending code
            setIsLoading(false);
            setShowVerificationModal(true);
            console.log('📧 Modal should be visible now');
        } catch (error: any) {
            console.error('Signup error:', error);
            const errorMessage = getArabicErrorMessage(error);
            Alert.alert('خطأ', errorMessage);
            setIsLoading(false);
        }
    };

    /**
     * Open terms in browser
     */
    const handleOpenTerms = async () => {
        try {
            // Get base URL without /api suffix
            const baseUrl = getApiUrl().replace('/api', '');
            const termsUrl = `${baseUrl}/terms`;
            
            const supported = await Linking.canOpenURL(termsUrl);
            
            if (supported) {
                await Linking.openURL(termsUrl);
            } else {
                Alert.alert('خطأ', 'لا يمكن فتح الرابط');
            }
        } catch (error) {
            console.error('Error opening terms:', error);
            Alert.alert('خطأ', 'فشل فتح الشروط والأحكام');
        }
    };

    /**
     * Handle email verification code submission
     */
    const handleVerifyEmail = async () => {
        if (!verificationCode || verificationCode.length < 6) {
            Alert.alert('خطأ', 'يرجى إدخال رمز التحقق المكون من 6 أرقام');
            return;
        }

        setIsVerifying(true);
        try {
            const result = await signUp?.attemptEmailAddressVerification({
                code: verificationCode,
            });

            if (result?.status === 'complete' && setActiveSignUp) {
                setShowVerificationModal(false);
                setLoadingMessage('جاري إنشاء الحساب...');
                setShowLoadingScreen(true);

                // ✅ OPTIMIZATION: Run operations in parallel
                const [, syncResult] = await Promise.all([
                    clearPreviousUserData(),
                    setActiveSignUp({ session: result.createdSessionId }).then(() => {
                        console.log('🔄 Syncing new user with backend...');
                        return syncUserWithBackend();
                    })
                ]);

                // ✅ OPTIMIZATION: Accept terms in background (non-blocking)
                (async () => {
                    try {
                        const termsVersion = await AsyncStorage.getItem('@pending_terms_version');
                        if (termsVersion) {
                            await TermsService.acceptTerms(termsVersion);
                            await AsyncStorage.removeItem('@pending_terms_version');
                            console.log('✅ Terms accepted');
                        }
                    } catch (termsError) {
                        console.warn('Failed to accept terms:', termsError);
                    }
                })();

                // ✅ Start background preloading for new users (non-blocking)
                if (syncResult.success) {
                    preloadManager.initialize(getToken).catch(err => {
                        console.warn('[Auth] Preload initialization failed:', err);
                    });
                }

                globalState.setUserType('diamond');
                useHomeStore.getState().setUserMode('diamond');

                // ✅ OPTIMIZATION: Reduced delay from 1500ms to 800ms
                setTimeout(() => {
                    router.replace('/onboarding');
                }, 800);
            }
        } catch (error: any) {
            console.error('Verification error:', error);
            const errorMessage = getArabicErrorMessage(error);
            Alert.alert('خطأ', errorMessage);
        } finally {
            setIsVerifying(false);
        }
    };

    /**
     * Resend verification code
     */
    const handleResendCode = async () => {
        try {
            await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
            Alert.alert('تم', 'تم إرسال رمز جديد إلى بريدك الإلكتروني');
        } catch (error: any) {
            Alert.alert('خطأ', 'فشل إرسال الرمز، حاول مرة أخرى');
        }
    };

    const handleGuest = () => {
        globalState.setUserType('guest');
        useHomeStore.getState().setUserMode('guest');
        router.replace('/(tabs)/Home');
    };

    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            if (__DEV__) {
                console.log('🔵 Starting Google OAuth...');
            }

            // Clear previous user data before new login
            await clearPreviousUserData();

            // Create redirect URL for the app
            const redirectUrl = Linking.createURL('sso-callback');
            if (__DEV__) {
                console.log('🔵 Redirect URL:', redirectUrl);
            }

            const result = await startGoogleOAuth({ redirectUrl });
            if (__DEV__) {
                console.log('🔵 OAuth result:', {
                    hasSessionId: !!result.createdSessionId,
                    hasSetActive: !!result.setActive
                });
            }

            if (result.createdSessionId && result.setActive) {
                // Show loading screen
                setLoadingMessage('جاري تسجيل الدخول عبر Google...');
                setShowLoadingScreen(true);
                setIsLoading(false);

                if (__DEV__) {
                    console.log('🔵 Setting active session...');
                }
                await result.setActive({ session: result.createdSessionId });

                // Sync user with backend database
                if (__DEV__) {
                    console.log('🔄 Syncing Google user with backend...');
                }
                const syncResult = await syncUserWithBackend();

                // ✅ FIX: Check if sync was successful
                if (!syncResult.success) {
                    console.error('❌ Failed to sync user with backend');
                    setShowLoadingScreen(false);
                    Alert.alert(
                        'خطأ في المزامنة',
                        'فشل تحميل بيانات المستخدم. يرجى المحاولة مرة أخرى.',
                        [
                            {
                                text: 'حاول مرة أخرى',
                                onPress: () => handleGoogleSignIn(),
                            },
                            {
                                text: 'إلغاء',
                                style: 'cancel',
                            },
                        ]
                    );
                    return;
                }

                if (__DEV__) {
                    console.log('🔵 Session activated, setting user type...');
                }
                
                // ✅ FIX: Wrap state updates in try-catch
                try {
                    globalState.setUserType('diamond');
                    useHomeStore.getState().setUserMode('diamond');
                } catch (stateError) {
                    console.error('❌ Failed to update state:', stateError);
                    // Continue anyway - not critical
                }

                if (__DEV__) {
                    console.log('🔵 Navigating...');
                }
                // Small delay for smooth transition
                setTimeout(() => {
                    try {
                        if (syncResult.isNewUser) {
                            router.replace('/onboarding');
                        } else {
                            router.replace('/(tabs)/Home');
                        }
                    } catch (navError) {
                        console.error('❌ Navigation error:', navError);
                        // Fallback navigation
                        router.replace('/(tabs)/Home');
                    }
                }, 1500);
            } else {
                if (__DEV__) {
                    console.error('❌ OAuth failed: Missing session or setActive');
                    console.error('Result:', result);
                }
                Alert.alert(
                    t.common.loginError,
                    t.common.checkRedirectUrls
                );
            }
        } catch (error: any) {
            if (__DEV__) {
                console.error('❌ Google OAuth error:', error);
                console.error('Error details:', {
                    message: error.message,
                    errors: error.errors,
                    code: error.code,
                    stack: error.stack, // ✅ FIX: Add stack trace
                });
            }

            // ✅ FIX: Hide loading screen on error
            setShowLoadingScreen(false);

            let errorMessage = t.common.operationFailed;

            if (error.errors?.[0]?.message) {
                errorMessage = error.errors[0].message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            Alert.alert(t.common.error, errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        try {
            setIsLoading(true);
            console.log('🍎 Starting Apple OAuth...');

            // Clear previous user data before new login
            await clearPreviousUserData();

            // Create redirect URL for the app
            const redirectUrl = Linking.createURL('sso-callback');
            console.log('🍎 Redirect URL:', redirectUrl);

            const result = await startAppleOAuth({ redirectUrl });
            console.log('🍎 OAuth result:', {
                hasSessionId: !!result.createdSessionId,
                hasSetActive: !!result.setActive
            });

            if (result.createdSessionId && result.setActive) {
                // Show loading screen
                setLoadingMessage('جاري تسجيل الدخول عبر Apple...');
                setShowLoadingScreen(true);
                setIsLoading(false);

                console.log('🍎 Setting active session...');
                await result.setActive({ session: result.createdSessionId });

                // Sync user with backend database
                console.log('🔄 Syncing Apple user with backend...');
                const syncResult = await syncUserWithBackend();

                // ✅ FIX: Check if sync was successful
                if (!syncResult.success) {
                    console.error('❌ Failed to sync user with backend');
                    setShowLoadingScreen(false);
                    Alert.alert(
                        'خطأ في المزامنة',
                        'فشل تحميل بيانات المستخدم. يرجى المحاولة مرة أخرى.',
                        [
                            {
                                text: 'حاول مرة أخرى',
                                onPress: () => handleAppleSignIn(),
                            },
                            {
                                text: 'إلغاء',
                                style: 'cancel',
                            },
                        ]
                    );
                    return;
                }

                console.log('🍎 Session activated, setting user type...');
                
                // ✅ FIX: Wrap state updates in try-catch
                try {
                    globalState.setUserType('diamond');
                    useHomeStore.getState().setUserMode('diamond');
                } catch (stateError) {
                    console.error('❌ Failed to update state:', stateError);
                    // Continue anyway - not critical
                }

                console.log('🍎 Navigating...');
                // Small delay for smooth transition
                setTimeout(() => {
                    try {
                        if (syncResult.isNewUser) {
                            router.replace('/onboarding');
                        } else {
                            router.replace('/(tabs)/Home');
                        }
                    } catch (navError) {
                        console.error('❌ Navigation error:', navError);
                        // Fallback navigation
                        router.replace('/(tabs)/Home');
                    }
                }, 1500);
            } else {
                console.error('❌ OAuth failed: Missing session or setActive');
                console.error('Result:', result);
                Alert.alert(
                    t.common.loginError,
                    t.common.checkRedirectUrls
                );
            }
        } catch (error: any) {
            console.error('❌ Apple OAuth error:', error);
            console.error('Error details:', {
                message: error.message,
                errors: error.errors,
                code: error.code,
                stack: error.stack, // ✅ FIX: Add stack trace
            });

            // ✅ FIX: Hide loading screen on error
            setShowLoadingScreen(false);

            let errorMessage = t.common.operationFailed;

            if (error.errors?.[0]?.message) {
                errorMessage = error.errors[0].message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            Alert.alert(t.common.error, errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Show loading screen during authentication
    if (showLoadingScreen) {
        return <AuthLoadingScreen message={loadingMessage} />;
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Dynamic Background */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}>
                <LinearGradient
                    colors={['#0A0514', '#0F0719', '#0A0514']}
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
                                backgroundColor: '#FFD700',
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
                                backgroundColor: '#FFA500',
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
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Animated.View
                                style={[
                                    styles.logoImageContainer,
                                    {
                                        transform: [{ scale: logoScale }],
                                        opacity: logoOpacity,
                                    },
                                ]}
                            >
                                <Image 
                                    source={require('../../assets/images/90Plus.png')} 
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                            <Animated.View 
                                style={[
                                    styles.logoGlow,
                                    {
                                        opacity: glowOpacity,
                                    },
                                ]} 
                            />
                        </View>
                        <Text style={styles.appName}>90Plus</Text>
                        <Text style={styles.tagline}>
                            {isLogin ? 'مرحباً بعودتك!' : 'انضم إلينا الآن'}
                        </Text>
                    </View>

                    {/* Mode Switcher */}
                    <View style={styles.modeSwitcher}>
                        <TouchableOpacity
                            style={[styles.modeButton, isLogin && styles.modeButtonActive]}
                            onPress={() => !isLogin && switchMode()}
                        >
                            <Text style={[styles.modeText, isLogin && styles.modeTextActive]}>
                                تسجيل الدخول
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeButton, !isLogin && styles.modeButtonActive]}
                            onPress={() => isLogin && switchMode()}
                        >
                            <Text style={[styles.modeText, !isLogin && styles.modeTextActive]}>
                                حساب جديد
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <Animated.View
                        style={[
                            styles.formContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }]
                            }
                        ]}
                    >
                        {/* Name Input (Sign Up only) */}
                        {!isLogin && (
                            <View style={styles.inputWrapper}>
                                <User color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="الاسم الكامل"
                                    placeholderTextColor={COLORS.textTertiary}
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />
                            </View>
                        )}

                        {/* Email Input */}
                        <View style={styles.inputWrapper}>
                            <Mail color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="البريد الإلكتروني"
                                placeholderTextColor={COLORS.textTertiary}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputWrapper}>
                            <Lock color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="كلمة المرور"
                                placeholderTextColor={COLORS.textTertiary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
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

                        {/* Terms Checkbox (Sign Up only) */}
                        {!isLogin && (
                            <TouchableOpacity
                                style={styles.termsContainer}
                                onPress={() => setTermsAccepted(!termsAccepted)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                                    {termsAccepted && (
                                        <Text style={styles.checkmark}>✓</Text>
                                    )}
                                </View>
                                <View style={styles.termsTextContainer}>
                                    <Text style={styles.termsText}>
                                        أوافق على{' '}
                                        <Text
                                            style={styles.termsLink}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleOpenTerms();
                                            }}
                                        >
                                            الشروط والأحكام
                                        </Text>
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Submit Button */}
                        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={handleAuth}
                                onPressIn={handlePressIn}
                                onPressOut={handlePressOut}
                                disabled={isLoading}
                            >
                                <View style={styles.gradientButton}>
                                    {isLoading ? (
                                        <ActivityIndicator color="#0A0514" />
                                    ) : (
                                        <>
                                            <Text style={styles.submitText}>
                                                {isLogin ? 'دخول' : 'تسجيل'}
                                            </Text>
                                            <ArrowRight color="#0A0514" size={20} />
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Forgot Password */}
                        {isLogin && (
                            <TouchableOpacity 
                                style={styles.forgotPassword}
                                onPress={() => router.push('/auth/forgot-password')}
                            >
                                <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
                            </TouchableOpacity>
                        )}

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* OAuth Buttons */}
                        <View style={styles.oauthContainer}>
                            <TouchableOpacity
                                style={styles.oauthButton}
                                onPress={handleGoogleSignIn}
                                disabled={isLoading}
                            >
                                <Chrome color={COLORS.white} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.oauthButton}
                                onPress={handleAppleSignIn}
                                disabled={isLoading}
                            >
                                <AppleIcon color={COLORS.white} size={24} />
                            </TouchableOpacity>
                        </View>

                        {/* Guest Button */}
                        <TouchableOpacity style={styles.guestButton} onPress={handleGuest}>
                            <Gamepad2 color="#FFD700" size={20} style={{ marginRight: 8 }} />
                            <Text style={styles.guestText}>متابعة كضيف</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Email Verification Modal */}
            <Modal
                visible={showVerificationModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowVerificationModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity
                            style={styles.modalClose}
                            onPress={() => setShowVerificationModal(false)}
                        >
                            <X color={COLORS.white} size={24} />
                        </TouchableOpacity>

                        <KeyRound color="#FFD700" size={48} style={{ marginBottom: 16 }} />
                        <Text style={styles.modalTitle}>تحقق من بريدك الإلكتروني</Text>
                        <Text style={styles.modalSubtitle}>
                            تم إرسال رمز مكون من 6 أرقام إلى{'\n'}{email}
                        </Text>

                        <View style={styles.codeInputWrapper}>
                            <TextInput
                                style={styles.codeInput}
                                placeholder="000000"
                                placeholderTextColor={COLORS.textTertiary}
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.verifyButton}
                            onPress={handleVerifyEmail}
                            disabled={isVerifying}
                        >
                            <View style={styles.gradientButton}>
                                {isVerifying ? (
                                    <ActivityIndicator color="#0A0514" />
                                ) : (
                                    <Text style={styles.submitText}>تأكيد</Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleResendCode}>
                            <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D0627',
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
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(74, 20, 140, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#4A148C',
        ...EFFECTS.greenGlow,
    },
    logoImageContainer: {
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 40,
        overflow: 'hidden',
    },
    logoImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    logoGlow: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 50,
        backgroundColor: '#4A148C',
        opacity: 0.3,
        zIndex: -1,
    },
    appName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    tagline: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    modeSwitcher: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderRadius: 16,
        padding: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.2)',
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    modeButtonActive: {
        backgroundColor: '#FFD700',
    },
    modeText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
        fontWeight: '600',
    },
    modeTextActive: {
        color: '#0A0514',
        fontWeight: 'bold',
    },
    formContainer: {
        gap: 12,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        borderRadius: 16,
        paddingHorizontal: 16,
        minHeight: Platform.OS === 'ios' ? 54 : 58,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.2)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: COLORS.white,
        fontSize: 16,
        textAlign: 'right',
    },
    eyeIcon: {
        padding: 8,
    },
    submitButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Platform.OS === 'ios' ? 14 : 16,
        gap: 8,
        backgroundColor: '#FFD700',
    },
    submitText: {
        color: '#0A0514',
        fontSize: 16,
        fontWeight: 'bold',
    },
    guestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
    },
    guestText: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '600',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginTop: -8,
    },
    forgotPasswordText: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
    },
    dividerText: {
        color: COLORS.textTertiary,
        fontSize: 12,
        marginHorizontal: 16,
        fontWeight: '600',
    },
    oauthContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 12,
    },
    oauthButton: {
        width: Platform.OS === 'ios' ? 54 : 58,
        height: Platform.OS === 'ios' ? 54 : 58,
        borderRadius: Platform.OS === 'ios' ? 27 : 29,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#0D0627',
        borderRadius: 28,
        padding: 28,
        width: '100%',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFD700',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    modalClose: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 12,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 24,
    },
    codeInputWrapper: {
        width: '100%',
        marginBottom: 20,
    },
    codeInput: {
        backgroundColor: 'rgba(50, 205, 50, 0.1)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 65,
        borderWidth: 2,
        borderColor: COLORS.neonGreen,
        color: COLORS.white,
        fontSize: 32,
        textAlign: 'center',
        letterSpacing: 16,
        fontWeight: 'bold',
    },
    verifyButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    resendText: {
        color: '#FFD700',
        fontSize: 15,
        fontWeight: '600',
        marginTop: 16,
    },
    // Terms checkbox styles
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'rgba(255, 215, 0, 0.5)',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    checkboxChecked: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700',
    },
    checkmark: {
        color: '#0A0514',
        fontSize: 16,
        fontWeight: 'bold',
    },
    termsTextContainer: {
        flex: 1,
    },
    termsText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'right',
        lineHeight: 20,
    },
    termsLink: {
        color: '#FFD700',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
