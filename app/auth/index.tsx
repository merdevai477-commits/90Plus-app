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
    Dimensions,
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
import { useSignIn, useSignUp, useOAuth, useAuth, useUser, isClerkAPIResponseError } from '@clerk/clerk-expo';
import { useTranslation } from '../../src/i18n';
import { globalState } from '../../globalState';
import { useHomeStore } from '../../src/store/home.store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { AuthService, SyncTimeoutError, SyncNetworkError, SyncServerError } from '../../src/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthLoadingScreen from '../../components/AuthLoadingScreen';
import { TermsService } from '../../services/termsService';
import { getApiUrl } from '../../config/api.config';
import { logger } from '../../utils/logger';
import { CoinsService } from '../../services/coins.service';
import { rankingsService } from '../../services/rankingsService';
import { websocketClient } from '../../services/websocketClient';
import { cacheService } from '../../services/cacheService';
import { toastManager } from '../../services/toastManager';
import { preloadManager } from '../../services/preloadManager';

WebBrowser.maybeCompleteAuthSession();

/** Prefer TOTP / backup codes, then SMS / email MFA (Clerk `supportedSecondFactors`). */
function pickClerkSecondFactor(factors: any[] | null | undefined) {
    if (!factors?.length) return null;
    const order = ['totp', 'backup_code', 'phone_code', 'email_code'];
    for (const s of order) {
        const f = factors.find((x) => x?.strategy === s);
        if (f) return f;
    }
    return factors[0];
}

// ✅ iPad Detection: Detect if device is iPad for responsive layout
const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

/**
 * 🐉 DRAGON FIX: Clear all previous user data with proper coordination
 * Prevents race conditions and ensures complete cleanup
 * ✅ OPTIMIZED: Reduced timeout from 5s to 2s for faster logout
 */
const clearPreviousUserData = async () => {
    logger.debug('🧹 Clearing previous user data...');
    
    const cleanupOperations = [
        // ✅ CRITICAL: Clear videos first to prevent data leakage between users
        (async () => {
            try {
                const { useVideos } = await import('../../contexts/VideosContext');
                // Get clearVideos from context
                // Note: This is a workaround since we can't use hooks here
                // The actual clearing will happen in the VideosContext
                logger.debug('✅ Videos context accessed for clearing');
            } catch (error) {
                logger.error('Failed to access videos context:', error);
            }
        })(),
        
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
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [mfaPrepareLoading, setMfaPrepareLoading] = useState(false);
    const [isMfaVerifying, setIsMfaVerifying] = useState(false);
    const [mfaSubtitle, setMfaSubtitle] = useState('');
    const [mfaStrategyUi, setMfaStrategyUi] = useState<string | null>(null);
    const selectedSecondFactorRef = useRef<{
        strategy: string;
        phoneNumberId?: string;
        emailAddressId?: string;
        safeIdentifier?: string;
    } | null>(null);

    // Logo animation values
    const logoScale = useRef(new Animated.Value(1)).current;
    const logoOpacity = useRef(new Animated.Value(1)).current;
    const glowOpacity = useRef(new Animated.Value(0.3)).current;

    const { signIn, setActive: setActiveSignIn } = useSignIn();
    const { signUp, setActive: setActiveSignUp } = useSignUp();
    const { isSignedIn, isLoaded, signOut } = useAuth();
    const { user } = useUser(); // ✅ Get user from useUser hook

    // ✅ CRITICAL FIX: Handle case where user is already signed in but on auth screen
    // This can happen if sync failed after Clerk session was activated
    useEffect(() => {
        if (isLoaded && isSignedIn) {
            console.log('⚠️ User already signed in on auth screen - attempting to sync or sign out');
            
            // Try to sync with backend
            const attemptSync = async () => {
                try {
                    setLoadingMessage('جاري التحقق من حالة تسجيل الدخول...');
                    setShowLoadingScreen(true);
                    
                    const syncResult = await syncUserWithBackend();
                    
                    if (syncResult.success) {
                        // Sync successful, redirect to home
                        console.log('✅ Sync successful, redirecting to home');
                        globalState.setUserType('diamond');
                        useHomeStore.getState().setUserMode('diamond');
                        
                        // ✅ Skip onboarding, go directly to Home
                        setTimeout(() => {
                            setShowLoadingScreen(false);
                            router.replace('/(tabs)/Home');
                        }, 500);
                    } else {
                        // Sync failed, sign out and let user try again
                        console.log('❌ Sync failed, signing out');
                        await signOut?.();
                        setShowLoadingScreen(false);
                        toastManager.showError('خطأ في المزامنة', 'فشل تحميل بيانات المستخدم. يرجى تسجيل الدخول مرة أخرى.');
                    }
                } catch (error) {
                    console.error('❌ Sync attempt failed:', error);
                    // Sign out on error
                    await signOut?.();
                    setShowLoadingScreen(false);
                    toastManager.showError('خطأ', 'حدث خطأ أثناء التحقق من حالة تسجيل الدخول. يرجى المحاولة مرة أخرى.');
                }
            };
            
            attemptSync();
        }
    }, [isLoaded, isSignedIn]);

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
            const token = await getToken();
            if (!token) {
                console.error('❌ No token available for sync');
                throw new Error('No authentication token available');
            }

            // Call AuthService.syncUserWithBackend (handles retries and timeout internally)
            const user = await AuthService.syncUserWithBackend(token);
            
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
            
            console.error('❌ Failed to sync user');
            return { success: false, isNewUser: false };
        } catch (error: any) {
            console.error('❌ Failed to sync with backend:', error);
            
            // ✅ IMPROVED: Better error handling for database errors
            if (error instanceof SyncServerError) {
                // Check for database error (E009)
                if (error.message.includes('E009') || error.message.includes('Database error')) {
                    console.error('❌ Database connection error - server may be starting up');
                    toastManager.showError('خطأ في الاتصال', 'حدث خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى بعد قليل.');
                    return { success: false, isNewUser: false };
                }
                
                // Handle 502 errors (server unavailable)
                if (error.statusCode === 502) {
                    console.warn('⚠️ Server unavailable (502), continuing with Clerk data...');
                    
                    // Use Clerk user data as fallback
                    try {
                        // Get user from useUser hook (already defined at top of component)
                        if (user) {
                            const username = user.username || user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'user';
                            
                            globalState.username = username;
                            globalState.setUserProfile({
                                id: user.id,
                                username: username,
                                displayName: user.fullName || username,
                                avatar: user.imageUrl || undefined,
                                bio: undefined,
                                stats: {
                                    views: 0, likes: 0, questionsSolved: 0, rating: 0, posts: 0,
                                    predictions: 0, interactions: 0, level: 1, followers: 0, following: 0,
                                    monthlyViews: 0, yearlyViews: 0, engagementRate: 0, contentQuality: 0,
                                },
                                videos: [], badges: [], achievements: [],
                                socialStats: { followers: [], following: [] },
                                notifications: [],
                                isOwner: true, 
                                isVerified: false, 
                                isAppOwner: false,
                            });
                            
                            await AsyncStorage.setItem('@username_setup_complete', 'true');
                            
                            console.log('✅ Using Clerk fallback data, continuing...');
                            return { success: true, isNewUser: true };
                        } else {
                            console.error('❌ No Clerk user data available for fallback');
                        }
                    } catch (fallbackError) {
                        console.error('❌ Fallback also failed:', fallbackError);
                    }
                }
            }
            
            // Determine error type and provide specific error message
            let errorMessage = 'حدث خطأ أثناء تحميل بيانات المستخدم';
            let errorTitle = 'خطأ في المزامنة';
            
            if (error instanceof SyncTimeoutError || error.name === 'SyncTimeoutError') {
                errorMessage = 'انتهت مهلة الاتصال. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
                errorTitle = 'انتهت مهلة الاتصال';
            } else if (error instanceof SyncNetworkError || error.name === 'SyncNetworkError') {
                errorMessage = 'فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
                errorTitle = 'خطأ في الاتصال';
            } else if (error instanceof SyncServerError || error.name === 'SyncServerError') {
                errorMessage = 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.';
                errorTitle = 'خطأ في الخادم';
            }
            
            // Throw error with message for caller to handle
            throw { name: error.name, message: errorMessage, title: errorTitle };
        } finally {
            // Ensure loading screen is always hidden
            setShowLoadingScreen(false);
        }
    };

    const subtitleForMfaFactor = (factor: any) => {
        if (!factor) return '';
        switch (factor.strategy) {
            case 'totp':
                return t.common.loginMfaTotpHint;
            case 'backup_code':
                return t.common.loginMfaBackupHint;
            case 'phone_code':
                return factor.safeIdentifier
                    ? `${t.common.loginMfaSmsHint}\n${factor.safeIdentifier}`
                    : t.common.loginMfaSmsHint;
            case 'email_code':
                return factor.safeIdentifier
                    ? `${t.common.loginMfaEmailHint}\n${factor.safeIdentifier}`
                    : t.common.loginMfaEmailHint;
            default:
                return t.common.loginMfaTotpHint;
        }
    };

    const completeSignInWithSession = async (createdSessionId: string | null | undefined) => {
        if (!createdSessionId) {
            toastManager.showError(t.common.error, t.common.loginCouldNotComplete);
            return;
        }
        const sessionIdForRetry = createdSessionId;
        setLoadingMessage(t.common.loggingIn);
        setShowLoadingScreen(true);
        try {
            await clearPreviousUserData();
            console.log('🔑 Activating Clerk session...');
            await setActiveSignIn({ session: sessionIdForRetry });
            console.log('✅ Session activated successfully');
            console.log('🔄 Syncing user with backend...');
            const syncResult = await syncUserWithBackend();
            if (!syncResult.success) {
                console.error('❌ Sync failed after session activation');
                await signOut?.();
                setShowLoadingScreen(false);
                throw new Error('Sync failed');
            }
            preloadManager.initialize(getToken).catch((err) => {
                console.warn('[Auth] Preload initialization failed (non-critical):', err);
            });
            console.log('✅ Background preloading started');
            globalState.setUserType('diamond');
            useHomeStore.getState().setUserMode('diamond');
            setTimeout(() => {
                setShowLoadingScreen(false);
                router.replace('/(tabs)/Home');
            }, 500);
        } catch (syncError: any) {
            console.error('❌ Login sync error:', syncError);
            try {
                await signOut?.();
                console.log('✅ Clerk session signed out after sync failure');
            } catch (signOutError) {
                console.warn('⚠️ Failed to sign out:', signOutError);
            }
            setShowLoadingScreen(false);
            const isTimeoutError = syncError.name === 'SyncTimeoutError';
            const errorTitle = syncError.title || 'خطأ';
            const errorMessage =
                syncError.message || 'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.';
            if (isTimeoutError) {
                Alert.alert(errorTitle, errorMessage, [
                    {
                        text: 'إلغاء',
                        style: 'cancel',
                        onPress: () => {
                            setEmail('');
                            setPassword('');
                        },
                    },
                    {
                        text: 'إعادة المحاولة',
                        onPress: () => {
                            void completeSignInWithSession(sessionIdForRetry);
                        },
                    },
                ]);
            } else {
                Alert.alert(errorTitle, errorMessage, [
                    {
                        text: 'حسناً',
                        onPress: () => {},
                    },
                ]);
            }
        }
    };

    useEffect(() => {
        if (!showMfaModal || !signIn) return;
        const factor = selectedSecondFactorRef.current;
        if (!factor) return;
        if (factor.strategy !== 'phone_code' && factor.strategy !== 'email_code') {
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                setMfaPrepareLoading(true);
                if (factor.strategy === 'phone_code' && factor.phoneNumberId) {
                    await signIn.prepareSecondFactor({
                        strategy: 'phone_code',
                        phoneNumberId: factor.phoneNumberId,
                    });
                    if (!cancelled) {
                        toastManager.showInfo(t.common.success, t.common.loginMfaSmsSent);
                    }
                } else if (factor.strategy === 'email_code' && factor.emailAddressId) {
                    await signIn.prepareSecondFactor({
                        strategy: 'email_code',
                        emailAddressId: factor.emailAddressId,
                    });
                    if (!cancelled) {
                        toastManager.showInfo(t.common.success, t.common.loginMfaEmailSent);
                    }
                }
            } catch (e: any) {
                if (!cancelled) {
                    const msg = isClerkAPIResponseError(e)
                        ? e.errors?.[0]?.message || String(e)
                        : e?.message || t.common.errorOccurred;
                    toastManager.showError(t.common.error, msg);
                    setShowMfaModal(false);
                }
            } finally {
                if (!cancelled) setMfaPrepareLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showMfaModal, signIn]);

    const handleMfaSubmit = async () => {
        if (!signIn || !mfaCode.trim()) {
            toastManager.showError(t.common.error, t.common.fillAllFields);
            return;
        }
        const factor = selectedSecondFactorRef.current;
        if (!factor) return;
        setIsMfaVerifying(true);
        try {
            const attemptParams: Record<string, string> = {
                strategy: factor.strategy,
                code: mfaCode.trim(),
            };
            const updated = await signIn.attemptSecondFactor(attemptParams as any);
            if (updated.status === 'complete' && updated.createdSessionId) {
                setShowMfaModal(false);
                setMfaCode('');
                setMfaStrategyUi(null);
                selectedSecondFactorRef.current = null;
                await completeSignInWithSession(updated.createdSessionId);
            } else {
                toastManager.showError(t.common.error, t.common.loginCouldNotComplete);
            }
        } catch (e: any) {
            const msg = isClerkAPIResponseError(e)
                ? e.errors?.[0]?.longMessage || e.errors?.[0]?.message || t.common.errorOccurred
                : getArabicErrorMessage(e);
            toastManager.showError(t.common.error, msg);
        } finally {
            setIsMfaVerifying(false);
        }
    };

    const handleMfaResendSms = async () => {
        const factor = selectedSecondFactorRef.current;
        if (!signIn || factor?.strategy !== 'phone_code' || !factor.phoneNumberId) return;
        try {
            setMfaPrepareLoading(true);
            await signIn.prepareSecondFactor({
                strategy: 'phone_code',
                phoneNumberId: factor.phoneNumberId,
            });
            toastManager.showInfo(t.common.success, t.common.loginMfaSmsSent);
        } catch (e: any) {
            const msg = isClerkAPIResponseError(e)
                ? e.errors?.[0]?.message || String(e)
                : e?.message || t.common.errorOccurred;
            toastManager.showError(t.common.error, msg);
        } finally {
            setMfaPrepareLoading(false);
        }
    };

    const handleMfaResendEmail = async () => {
        const factor = selectedSecondFactorRef.current;
        if (!signIn || factor?.strategy !== 'email_code' || !factor.emailAddressId) return;
        try {
            setMfaPrepareLoading(true);
            await signIn.prepareSecondFactor({
                strategy: 'email_code',
                emailAddressId: factor.emailAddressId,
            });
            toastManager.showInfo(t.common.success, t.common.loginMfaEmailSent);
        } catch (e: any) {
            const msg = isClerkAPIResponseError(e)
                ? e.errors?.[0]?.message || String(e)
                : e?.message || t.common.errorOccurred;
            toastManager.showError(t.common.error, msg);
        } finally {
            setMfaPrepareLoading(false);
        }
    };

    const closeMfaModal = () => {
        setShowMfaModal(false);
        setMfaCode('');
        setMfaStrategyUi(null);
        selectedSecondFactorRef.current = null;
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
        // ✅ iPad Debug Logging
        console.log('🔐 Login attempt started', {
            device: {
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height,
                isTablet,
                platform: Platform.OS,
                version: Platform.Version,
            },
            apiUrl: getApiUrl(),
            hasEmail: !!email,
            hasPassword: !!password,
        });

        // ✅ Sentry breadcrumb for remote debugging
        try {
            const Sentry = require('@sentry/react-native');
            Sentry.addBreadcrumb({
                category: 'auth',
                message: 'Login attempt started',
                level: 'info',
                data: {
                    platform: Platform.OS,
                    isTablet,
                    width: Dimensions.get('window').width,
                }
            });
        } catch (e) {
            // Sentry not available
        }

        if (!email || !password) {
            toastManager.showError(t.common.error, t.common.fillAllFields);
            return;
        }

        setIsLoading(true);

        try {
            if (isLogin) {
                // Login with Clerk
                if (!signIn) {
                    console.error('❌ signIn is null/undefined - Clerk not initialized');
                    
                    // ✅ Send to Sentry
                    try {
                        const Sentry = require('@sentry/react-native');
                        Sentry.captureMessage('Clerk signIn is null', {
                            level: 'error',
                            tags: { platform: Platform.OS, screen: 'login' }
                        });
                    } catch (e) {}
                    
                    toastManager.showError(t.common.error, t.common.loginServiceUnavailable);
                    setIsLoading(false);
                    return;
                }

                console.log('📞 Calling Clerk signIn.create()...');
                console.log('📧 Email:', email.substring(0, 3) + '***');

                // ✅ Sentry breadcrumb
                try {
                    const Sentry = require('@sentry/react-native');
                    Sentry.addBreadcrumb({
                        category: 'auth',
                        message: 'Calling Clerk signIn.create',
                        level: 'info',
                    });
                } catch (e) {}

                const result = await signIn.create({
                    identifier: email,
                    password: password,
                });

                console.log('📦 Clerk response received:', {
                    status: result.status,
                    hasSessionId: !!result.createdSessionId,
                    // Don't log full result - may contain sensitive data
                });

                // ✅ Sentry breadcrumb
                try {
                    const Sentry = require('@sentry/react-native');
                    Sentry.addBreadcrumb({
                        category: 'auth',
                        message: 'Clerk response received',
                        level: 'info',
                        data: {
                            status: result.status,
                            hasSessionId: !!result.createdSessionId,
                        }
                    });
                } catch (e) {}

                if (result.status === 'complete') {
                    console.log('✅ Clerk login status: complete');
                    setIsLoading(false);
                    await completeSignInWithSession(result.createdSessionId);
                } else if (result.status === 'needs_second_factor') {
                    setIsLoading(false);
                    setShowLoadingScreen(false);
                    const factors =
                        result.supportedSecondFactors ?? signIn.supportedSecondFactors ?? null;
                    const raw = pickClerkSecondFactor(factors as any[] | null);
                    console.log('[Auth] needs_second_factor - supported factors:', JSON.stringify(factors));
                    if (!raw) {
                        toastManager.showError(
                            'التحقق بخطوتين مطلوب',
                            'حسابك يتطلب التحقق بخطوتين ولكن لم يتم إعداده. يرجى التواصل مع الدعم أو إيقاف التحقق بخطوتين من إعدادات حسابك.'
                        );
                        return;
                    }
                    selectedSecondFactorRef.current = {
                        strategy: raw.strategy,
                        phoneNumberId: raw.phoneNumberId,
                        emailAddressId: raw.emailAddressId,
                        safeIdentifier: raw.safeIdentifier,
                    };
                    setMfaSubtitle(subtitleForMfaFactor(raw));
                    setMfaCode('');
                    setMfaStrategyUi(raw.strategy);
                    setShowMfaModal(true);
                    console.log('[Auth] ✅ MFA modal opened for strategy:', raw.strategy);
                } else if (result.status === 'needs_first_factor') {
                    setIsLoading(false);
                    setShowLoadingScreen(false);
                    toastManager.showError(t.common.error, t.common.loginNeedsFirstFactor);
                } else if (result.status === 'needs_verification') {
                    setIsLoading(false);
                    setShowLoadingScreen(false);
                    toastManager.showError(t.common.error, t.common.verifyEmail);
                } else {
                    console.warn('⚠️ Clerk login incomplete:', {
                        status: result.status,
                        identifier: email.substring(0, 3) + '***',
                    });
                    try {
                        const Sentry = require('@sentry/react-native');
                        Sentry.captureMessage(`Clerk login incomplete: ${result.status}`, {
                            level: 'warning',
                            tags: {
                                platform: Platform.OS,
                                clerkStatus: String(result.status),
                                isTablet: String(isTablet),
                            },
                            extra: {
                                email: email.substring(0, 3) + '***',
                                hasSessionId: !!result.createdSessionId,
                            },
                        });
                    } catch (e) {
                        console.warn('Failed to send to Sentry:', e);
                    }
                    setShowLoadingScreen(false);
                    setIsLoading(false);
                    toastManager.showError(t.common.error, t.common.loginCouldNotComplete);
                }
            } else {
                // Sign up - Check terms acceptance
                if (!name) {
                    toastManager.showError('خطأ', 'يرجى إدخال الاسم');
                    setIsLoading(false);
                    return;
                }

                if (!termsAccepted) {
                    toastManager.showWarning('خطأ', 'يجب الموافقة على الشروط والأحكام للمتابعة');
                    setIsLoading(false);
                    return;
                }

                // Proceed with signup
                await handleSignup();
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            
            // ✅ iPad Debug: Log detailed error info
            console.error('❌ Login failed:', {
                error: error.message,
                code: error.code,
                errors: error.errors,
                status: error.status,
                name: error.name,
                device: {
                    isTablet,
                    width: Dimensions.get('window').width,
                    platform: Platform.OS,
                },
            });
            
            setShowLoadingScreen(false); // ✅ FIX: Always hide loading screen on error
            
            // ✅ iOS FIX: Show actual error message instead of generic
            let errorMessage = getArabicErrorMessage(error);
            
            // Check for CORS/Network errors (common on iOS)
            if (error.message?.includes('Network request failed') || 
                error.message?.includes('CORS') ||
                error.name === 'TypeError' && error.message?.includes('fetch')) {
                errorMessage = 'خطأ في الاتصال بالخادم. تأكد من اتصال الإنترنت وحاول مرة أخرى.';
                console.error('🚨 Possible CORS issue detected on iOS');
            }
            
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
                toastManager.showError('خطأ', 'خدمة التسجيل غير متاحة');
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
                toastManager.showError('خطأ', 'لا يمكن فتح الرابط');
            }
        } catch (error) {
            console.error('Error opening terms:', error);
            toastManager.showError('خطأ', 'فشل فتح الشروط والأحكام');
        }
    };

    /**
     * Handle email verification code submission
     */
    const handleVerifyEmail = async () => {
        if (!verificationCode || verificationCode.length < 6) {
            toastManager.showError('خطأ', 'يرجى إدخال رمز التحقق المكون من 6 أرقام');
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

                try {
                    await clearPreviousUserData();
                    await setActiveSignUp({ session: result.createdSessionId });
                    
                    console.log('🔄 Syncing new user with backend...');
                    const syncResult = await syncUserWithBackend();

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

                    // ✅ Skip onboarding, go directly to Home
                    setTimeout(() => {
                        router.replace('/(tabs)/Home');
                    }, 500); // ✅ Reduced delay
                } catch (syncError: any) {
                    console.error('❌ Signup sync error:', syncError);
                    
                    const isTimeoutError = syncError.name === 'SyncTimeoutError';
                    const errorTitle = syncError.title || 'خطأ';
                    const errorMessage = syncError.message || 'حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.';
                    
                    if (isTimeoutError) {
                        Alert.alert(
                            errorTitle,
                            errorMessage,
                            [
                                {
                                    text: 'إلغاء',
                                    style: 'cancel',
                                },
                                {
                                    text: 'إعادة المحاولة',
                                    onPress: () => handleVerifyEmail()
                                }
                            ]
                        );
                    } else {
                        Alert.alert(errorTitle, errorMessage);
                    }
                }
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
            toastManager.showSuccess('تم', 'تم إرسال رمز جديد إلى بريدك الإلكتروني');
        } catch (error: any) {
            toastManager.showError('خطأ', 'فشل إرسال الرمز، حاول مرة أخرى');
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
                
                try {
                    const syncResult = await syncUserWithBackend();

                    // ✅ FIX: Check if sync was successful
                    if (!syncResult.success) {
                        console.error('❌ Failed to sync user with backend');
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
                    // ✅ Skip onboarding, go directly to Home
                    setTimeout(() => {
                        try {
                            router.replace('/(tabs)/Home');
                        } catch (navError) {
                            console.error('❌ Navigation error:', navError);
                            // Fallback navigation
                            router.replace('/(tabs)/Home');
                        }
                    }, 500); // ✅ Reduced delay
                } catch (syncError: any) {
                    console.error('❌ Google OAuth sync error:', syncError);
                    
                    const isTimeoutError = syncError.name === 'SyncTimeoutError';
                    const errorTitle = syncError.title || 'خطأ في المزامنة';
                    const errorMessage = syncError.message || 'فشل تحميل بيانات المستخدم. يرجى المحاولة مرة أخرى.';
                    
                    if (isTimeoutError) {
                        Alert.alert(
                            errorTitle,
                            errorMessage,
                            [
                                {
                                    text: 'إلغاء',
                                    style: 'cancel',
                                },
                                {
                                    text: 'إعادة المحاولة',
                                    onPress: () => handleGoogleSignIn(),
                                }
                            ]
                        );
                    } else {
                        Alert.alert(
                            errorTitle,
                            errorMessage,
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
                    }
                }
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

            toastManager.showError('خطأ', errorMessage);
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
                
                try {
                    const syncResult = await syncUserWithBackend();

                    // ✅ FIX: Check if sync was successful
                    if (!syncResult.success) {
                        console.error('❌ Failed to sync user with backend');
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
                    // ✅ Skip onboarding, go directly to Home
                    setTimeout(() => {
                        try {
                            router.replace('/(tabs)/Home');
                        } catch (navError) {
                            console.error('❌ Navigation error:', navError);
                            // Fallback navigation
                            router.replace('/(tabs)/Home');
                        }
                    }, 500); // ✅ Reduced delay
                } catch (syncError: any) {
                    console.error('❌ Apple OAuth sync error:', syncError);
                    
                    const isTimeoutError = syncError.name === 'SyncTimeoutError';
                    const errorTitle = syncError.title || 'خطأ في المزامنة';
                    const errorMessage = syncError.message || 'فشل تحميل بيانات المستخدم. يرجى المحاولة مرة أخرى.';
                    
                    if (isTimeoutError) {
                        Alert.alert(
                            errorTitle,
                            errorMessage,
                            [
                                {
                                    text: 'إلغاء',
                                    style: 'cancel',
                                },
                                {
                                    text: 'إعادة المحاولة',
                                    onPress: () => handleAppleSignIn(),
                                }
                            ]
                        );
                    } else {
                        Alert.alert(
                            errorTitle,
                            errorMessage,
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
                    }
                }
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

            toastManager.showError('خطأ', errorMessage);
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

            {/* MFA / 2FA (Clerk needs_second_factor) */}
            <Modal
                visible={showMfaModal}
                transparent
                animationType="fade"
                onRequestClose={closeMfaModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={closeMfaModal}>
                            <X color={COLORS.white} size={24} />
                        </TouchableOpacity>

                        <KeyRound color="#FFD700" size={48} style={{ marginBottom: 16 }} />
                        <Text style={styles.modalTitle}>{t.common.loginMfaTitle}</Text>
                        <Text style={styles.modalSubtitle}>{mfaSubtitle}</Text>

                        {mfaPrepareLoading && (
                            <ActivityIndicator
                                color={COLORS.neonGreen}
                                style={{ marginVertical: 12 }}
                            />
                        )}

                        <View style={styles.codeInputWrapper}>
                            <TextInput
                                style={styles.codeInput}
                                placeholder={t.common.loginMfaCodePlaceholder}
                                placeholderTextColor={COLORS.textTertiary}
                                value={mfaCode}
                                onChangeText={setMfaCode}
                                keyboardType="default"
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={16}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.verifyButton}
                            onPress={() => void handleMfaSubmit()}
                            disabled={isMfaVerifying || mfaPrepareLoading}
                        >
                            <View style={styles.gradientButton}>
                                {isMfaVerifying ? (
                                    <ActivityIndicator color="#0A0514" />
                                ) : (
                                    <Text style={styles.submitText}>{t.common.confirm}</Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {mfaStrategyUi === 'phone_code' && (
                            <TouchableOpacity
                                onPress={() => void handleMfaResendSms()}
                                disabled={mfaPrepareLoading || isMfaVerifying}
                            >
                                <Text style={styles.resendText}>{t.common.loginMfaResendSms}</Text>
                            </TouchableOpacity>
                        )}
                        {mfaStrategyUi === 'email_code' && (
                            <TouchableOpacity
                                onPress={() => void handleMfaResendEmail()}
                                disabled={mfaPrepareLoading || isMfaVerifying}
                            >
                                <Text style={styles.resendText}>{t.common.loginMfaResendSms}</Text>
                            </TouchableOpacity>
                        )}
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
        padding: isTablet ? 40 : 24,
        paddingHorizontal: isTablet ? 60 : 24,
        paddingBottom: isTablet ? 60 : 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: isTablet ? 32 : 24,
    },
    logoContainer: {
        width: isTablet ? 120 : 100,
        height: isTablet ? 120 : 100,
        borderRadius: isTablet ? 60 : 50,
        backgroundColor: 'rgba(74, 20, 140, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: isTablet ? 20 : 16,
        borderWidth: 2,
        borderColor: '#4A148C',
        ...EFFECTS.greenGlow,
    },
    logoImageContainer: {
        width: isTablet ? 100 : 80,
        height: isTablet ? 100 : 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: isTablet ? 50 : 40,
        overflow: 'hidden',
    },
    logoImage: {
        width: isTablet ? 100 : 80,
        height: isTablet ? 100 : 80,
        borderRadius: isTablet ? 50 : 40,
    },
    logoGlow: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: isTablet ? 60 : 50,
        backgroundColor: '#4A148C',
        opacity: 0.3,
        zIndex: -1,
    },
    appName: {
        fontSize: isTablet ? 36 : 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    tagline: {
        fontSize: isTablet ? 16 : 14,
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
        maxWidth: isTablet ? 600 : undefined,
        alignSelf: isTablet ? 'center' : 'stretch',
        width: isTablet ? '100%' : undefined,
    },
    modeButton: {
        flex: 1,
        paddingVertical: isTablet ? 14 : 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    modeButtonActive: {
        backgroundColor: '#FFD700',
    },
    modeText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: isTablet ? 16 : 14,
        fontWeight: '600',
    },
    modeTextActive: {
        color: '#0A0514',
        fontWeight: 'bold',
    },
    formContainer: {
        gap: isTablet ? 16 : 12,
        maxWidth: isTablet ? 600 : undefined,
        alignSelf: isTablet ? 'center' : 'stretch',
        width: '100%',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        borderRadius: 16,
        paddingHorizontal: isTablet ? 20 : 16,
        minHeight: isTablet ? 64 : (Platform.OS === 'ios' ? 54 : 58),
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.2)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: COLORS.white,
        fontSize: isTablet ? 18 : 16,
        textAlign: 'right',
    },
    eyeIcon: {
        padding: 8,
    },
    submitButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: isTablet ? 12 : 8,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: isTablet ? 18 : (Platform.OS === 'ios' ? 14 : 16),
        gap: 8,
        backgroundColor: '#FFD700',
    },
    submitText: {
        color: '#0A0514',
        fontSize: isTablet ? 18 : 16,
        fontWeight: 'bold',
    },
    guestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: isTablet ? 16 : 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
    },
    guestText: {
        color: '#FFD700',
        fontSize: isTablet ? 16 : 14,
        fontWeight: '600',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginTop: -8,
    },
    forgotPasswordText: {
        color: '#FFD700',
        fontSize: isTablet ? 16 : 14,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: isTablet ? 20 : 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
    },
    dividerText: {
        color: COLORS.textTertiary,
        fontSize: isTablet ? 14 : 12,
        marginHorizontal: 16,
        fontWeight: '600',
    },
    oauthContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: isTablet ? 20 : 16,
        marginBottom: 12,
    },
    oauthButton: {
        width: isTablet ? 64 : (Platform.OS === 'ios' ? 54 : 58),
        height: isTablet ? 64 : (Platform.OS === 'ios' ? 54 : 58),
        borderRadius: isTablet ? 32 : (Platform.OS === 'ios' ? 27 : 29),
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
        padding: isTablet ? 40 : 20,
    },
    modalContent: {
        backgroundColor: '#0D0627',
        borderRadius: 28,
        padding: isTablet ? 36 : 28,
        width: '100%',
        maxWidth: isTablet ? 600 : undefined,
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
        width: isTablet ? 48 : 40,
        height: isTablet ? 48 : 40,
        borderRadius: isTablet ? 24 : 20,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    modalTitle: {
        fontSize: isTablet ? 28 : 24,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 12,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: isTablet ? 17 : 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: isTablet ? 32 : 28,
        lineHeight: isTablet ? 28 : 24,
    },
    codeInputWrapper: {
        width: '100%',
        marginBottom: isTablet ? 24 : 20,
    },
    codeInput: {
        backgroundColor: 'rgba(50, 205, 50, 0.1)',
        borderRadius: 16,
        paddingHorizontal: isTablet ? 20 : 16,
        height: isTablet ? 75 : 65,
        borderWidth: 2,
        borderColor: COLORS.neonGreen,
        color: COLORS.white,
        fontSize: isTablet ? 36 : 32,
        textAlign: 'center',
        letterSpacing: isTablet ? 20 : 16,
        fontWeight: 'bold',
    },
    verifyButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    resendText: {
        color: '#FFD700',
        fontSize: isTablet ? 17 : 15,
        fontWeight: '600',
        marginTop: 16,
    },
    // Terms checkbox styles
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: isTablet ? 16 : 12,
        paddingHorizontal: 4,
    },
    checkbox: {
        width: isTablet ? 32 : 28,
        height: isTablet ? 32 : 28,
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
        fontSize: isTablet ? 18 : 16,
        fontWeight: 'bold',
    },
    termsTextContainer: {
        flex: 1,
    },
    termsText: {
        fontSize: isTablet ? 16 : 14,
        color: COLORS.textSecondary,
        textAlign: 'right',
        lineHeight: isTablet ? 24 : 20,
    },
    termsLink: {
        color: '#FFD700',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
