import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Stack, router, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import '../services/sentry.bootstrap';
import React, { useEffect, ErrorInfo } from "react";
import '../global.css';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { applyGlobalFont } from '../utils/fontSetup';
import '../services/notificationForegroundSetup';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppKeyboardProvider } from '@/utils/keyboardControllerSafe';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar, I18nManager, Linking, StyleSheet, Text, InteractionManager } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { isFlashListScrollRaceError } from '../components/chat/safeFlashListScroll';
import { SettingsProvider } from "../contexts/SettingsContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { CoinsProvider } from "../contexts/CoinsContext";
import { XpProvider } from "../contexts/XpContext";
import { VideosProvider } from "../contexts/VideosContext";
import { ToastProvider } from "../contexts/ToastContext";
import { ProfessionalToastProvider } from '../contexts/ProfessionalToastContext';
import { configureAudioVideo } from "../utils/videoConfig";
import { ClerkProvider } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { parseReelIdFromUrl, parseProfileUsernameFromUrl, parseGroupCodeFromUrl, parseReferralCodeFromUrl } from '../constants/shareLinks';
import { capturePendingReferral } from '../utils/pendingReferral';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguageStore } from "../src/i18n";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { logger } from "../services/logger";
import { preloadManager } from "../services/preloadManager";
import { cacheService, CACHE_KEYS } from "../services/cacheService";

// ✅ Required for OAuth redirects to close the in-app browser and resume the
// JS thread. Must be called once at module scope before any OAuth flow runs.
WebBrowser.maybeCompleteAuthSession();
import { AuthService } from "../src/services/authService";
import { createClerkTokenGetter, getClerkBearerToken } from "../utils/clerkAuthToken";
import { useAuth, useUser } from "@clerk/clerk-expo";
import * as Sentry from '@sentry/react-native';
import { captureException } from "../services/sentry.service";
import { SentryUserTracker } from "../components/SentryUserTracker";
import { useNavigationTracking } from "../hooks/useNavigationTracking";
import { BootSplashScreen } from "../components/splash/BootSplashScreen";
import { BootReadyProvider, useBootReady } from "../contexts/BootReadyContext";
import { PushNotificationSetup } from "../src/hooks/usePushNotifications";
import {
  PushTokenSyncBootstrap,
  GlobalNotificationTrayBridge,
} from "../components/common/PushTokenSyncBootstrap";
import { PushRegistrationReportBootstrap } from "../components/common/PushRegistrationReportBootstrap";
import { OtaUpdateBootstrap } from "../components/common/OtaUpdateBootstrap";
import { OtaPendingReloadGate } from "../components/common/OtaPendingReloadGate";
import { FootballCacheEpochBootstrap } from "../components/common/FootballCacheEpochBootstrap";
import { GlobalOfflineBanner } from "../components/common/GlobalOfflineBanner";
import { useOfflineSync } from "../src/hooks/useOfflineSync";
// ErrorUtils is on `global`, not a reliable named export from react-native in SDK 55+.
type GlobalErrorUtils = {
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};
const globalErrorUtils = (globalThis as typeof globalThis & { ErrorUtils?: GlobalErrorUtils })
  .ErrorUtils;
try {
  enableFreeze(false);
} catch {
  /* react-native-screens optional */
}

if (globalErrorUtils?.getGlobalHandler && globalErrorUtils?.setGlobalHandler) {
  const originalHandler = globalErrorUtils.getGlobalHandler();
  globalErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFlashListScrollRaceError(error)) {
      logger.warn('[GlobalErrorHandler] Ignored FlashList scroll race:', error.message);
      return;
    }
    logger.error('[GlobalErrorHandler] Caught unhandled exception:', {
      error: error?.message ?? String(error),
      isFatal,
    });
    if (!isFatal) return;
    originalHandler(error, isFatal);
  });
}

// Lazy load websocket client to avoid bundling issues with socket.io-client
let websocketClient: any = null;
const getWebSocketClient = async () => {
  if (!websocketClient) {
    const module = await import("../services/websocketClient");
    websocketClient = module.websocketClient;
  }
  return websocketClient;
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 450, fade: true });

const queryClient = new QueryClient();

// Get Clerk publishable key.
// Priority order:
//   1) `extra.clerkPublishableKey` from app.json — survives OTA when EAS env
//      omits EXPO_PUBLIC_* at publish time
//   2) EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY env var (native EAS builds)
// If both are missing we render ClerkKeyMissingScreen instead of silently
// crashing `useAuth` later.
const clerkPublishableKey =
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ||
  (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined);

// Fix 2: Guard — if key is missing, show error instead of silently failing
function ClerkKeyMissingScreen() {
  useEffect(() => {
    try {
      Sentry.captureMessage('CRITICAL: clerkPublishableKey missing in build', 'fatal');
    } catch { /* Sentry may not be initialized yet */ }
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={layoutStyles.errorContainer}>
      <Text style={layoutStyles.errorText}>
        Setup error. Please reinstall the app.
      </Text>
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a0030',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

// Token cache for Clerk — AFTER_FIRST_UNLOCK keeps session across device lock/reboot.
const CLERK_SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function secureGetWithRetry(key: string): Promise<string | null> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await SecureStore.getItemAsync(key, CLERK_SECURE_STORE_OPTIONS);
    } catch (err) {
      if (attempt === maxAttempts - 1) {
        logger.warn('SecureStore getToken error (giving up):', err);
        try {
          captureException(err instanceof Error ? err : new Error(String(err)), {
            tags: { area: 'clerk_token_cache', op: 'getToken' },
          });
        } catch {
          /* Sentry optional */
        }
        return null;
      }
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
  }
  return null;
}

const tokenCache = {
  async getToken(key: string) {
    return secureGetWithRetry(key);
  },
  async saveToken(key: string, value: string) {
    try {
      return await SecureStore.setItemAsync(key, value, CLERK_SECURE_STORE_OPTIONS);
    } catch (err) {
      logger.warn('SecureStore saveToken error:', err);
      return;
    }
  },
  async clearToken(key: string) {
    try {
      return await SecureStore.deleteItemAsync(key, CLERK_SECURE_STORE_OPTIONS);
    } catch (err) {
      logger.warn('SecureStore clearToken error:', err);
      return;
    }
  },
};

const STACK_SCREEN_OPTIONS = {
  headerBackTitle: "Back" as const,
  contentStyle: { backgroundColor: '#000' },
  animation: 'fade' as const,
};

function HideSplashWhenReady({ fontsReady }: { fontsReady: boolean }) {
  const { isLoaded: clerkLoaded } = useAuth();
  const { navigationReady } = useBootReady();
  const fullyReady = fontsReady && clerkLoaded && navigationReady;

  useEffect(() => {
    if (!fullyReady) return;
    const id = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, [fullyReady]);

  // Safety net: hide native splash after fonts load even if nav/clerk lag.
  useEffect(() => {
    if (!fontsReady) return;
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 12000);
    return () => clearTimeout(t);
  }, [fontsReady]);

  return null;
}

function ClerkGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <BootSplashScreen />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  // Track navigation changes for Sentry breadcrumbs
  useNavigationTracking();
  const navigationState = useRootNavigationState();
  const { markNavigationReady } = useBootReady();

  useEffect(() => {
    if (navigationState?.key) {
      markNavigationReady();
    }
  }, [navigationState?.key, markNavigationReady]);

  // Drain offline queue when connectivity returns. Must live inside the
  // Clerk + i18n + toast providers, which is true for any screen the Stack
  // renders.
  useOfflineSync();

  return (
    <Stack screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen 
        name="blocked" 
        options={{ 
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back
        }} 
      />
      <Stack.Screen 
        name="parental-consent" 
        options={{ 
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back
        }} 
      />
      <Stack.Screen 
        name="waiting-consent" 
        options={{ 
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back
        }} 
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="delete-account" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="user" options={{ headerShown: false }} />
      <Stack.Screen name="player-profile" options={{ headerShown: false }} />
      <Stack.Screen name="player-career" options={{ headerShown: false }} />
      <Stack.Screen name="coach-profile" options={{ headerShown: false }} />
      <Stack.Screen name="competition-profile" options={{ headerShown: false }} />
      <Stack.Screen name="team-profile" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="prediction-groups" options={{ headerShown: false }} />
      {/*
       * SHARE & WIN — front/app/share-win/
       *   index.tsx       → the Figma screen (node 109:470)
       *   leaderboard.tsx → full weekly ranking
       * Reachable from the Rank tab and from referral deep links
       * (https://90plus.pro/invite/<code> and ninetyplus://invite/<code>).
       */}
      <Stack.Screen name="share-win/index" options={{ headerShown: false }} />
      <Stack.Screen name="share-win/leaderboard" options={{ headerShown: false }} />
      <Stack.Screen name="predict-and-win/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="predict-and-win/create" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="world-cup-news" options={{ headerShown: false }} />
      <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
      {/*
       * QUIZ MODE ROUTE — front/app/quiz/[mode].tsx
       *
       * Without this entry expo-router falls back to the default Stack header,
       * which renders a white bar titled "quiz/[mode]" above every quiz screen.
       * The quiz screens draw their own header (ModeHeader in
       * components/Quiz/QuestionsModeScreen.tsx), so the native one is hidden.
       *
       * CUSTOMIZE: transition animation, gesture and background colour below.
       */}
      <Stack.Screen
        name="quiz/[mode]"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#030303' },
        }}
      />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="push-diagnostics" options={{ title: 'Push Diagnostics' }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

import { LevelUpModal } from "../components/common/LevelUpModal";
import { Image } from "expo-image";
import { CLUBS } from "../data/clubs";
import { BRANDS } from "../data/brands";
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';

function WebSocketInitializer({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, userId: clerkUserId } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user?.id) {
      let unsubscribers: (() => void)[] = [];
      let wsClient: any = null;

      const initWebSocket = async () => {
        try {
          wsClient = await getWebSocketClient();
          logger.info('[WebSocketInitializer] Connecting WebSocket for user:', user.id);
          wsClient.connect(user.id);

          unsubscribers.push(wsClient.subscribe('notification', (message: any) => {
            logger.debug('[WebSocket] Received notification:', message.payload);
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
            if (clerkUserId) {
              cacheService.invalidate(`${CACHE_KEYS.NOTIFICATIONS}_${clerkUserId}`).catch(() => {});
            }
          }));

          unsubscribers.push(wsClient.subscribe('comment', (message: any) => {
            logger.debug('[WebSocket] Received comment:', message.payload);
          }));

          unsubscribers.push(wsClient.subscribe('reply', (message: any) => {
            logger.debug('[WebSocket] Received reply:', message.payload);
          }));

          unsubscribers.push(wsClient.subscribe('like', (message: any) => {
            logger.debug('[WebSocket] Received like:', message.payload);
          }));

          unsubscribers.push(wsClient.subscribe('follow', (message: any) => {
            logger.debug('[WebSocket] Received follow:', message.payload);
          }));
        } catch (err) {
          logger.warn('[WebSocketInitializer] Failed to initialize WebSocket:', err);
        }
      };

      initWebSocket();

      return () => {
        unsubscribers.forEach(unsub => unsub());
        if (wsClient) {
          wsClient.disconnect();
          logger.info('[WebSocketInitializer] WebSocket disconnected');
        }
      };
    }
  }, [isSignedIn, isLoaded, user?.id, clerkUserId, queryClient]);

  return <>{children}</>;
}

function ClerkTokenWarmup() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const getTokenRef = React.useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getClerkBearerToken(getTokenRef.current, { retries: 10, baseDelayMs: 250 }).catch(() => {});
  }, [isLoaded, isSignedIn]);

  return null;
}

function PreloadInitializer({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  // Clerk's `getToken` returns a NEW function reference on every render, so we
  // must not put it in the effect's dependency array — that would re-fire the
  // effect (and its API calls) on every parent re-render, causing a tight
  // request loop and a frozen UI. Stash it in a ref instead.
  const getTokenRef = React.useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      // Fix 4: fire-and-forget — don't block on server wakeup
      try {
        const { serverWakeupService } = await import('../services/serverWakeup.service');
        serverWakeupService.ensureServerAwake().catch(() => {});
        logger.debug('[PreloadInitializer] Server wakeup triggered (non-blocking)');
      } catch (err) {
        logger.warn('[PreloadInitializer] Server wakeup failed (non-critical):', err);
      }

      // Prime the matches cache for today (and yesterday) in the background
      // so the matches tab opens with a memory-cache HIT instead of a network wait.
      // Uses the same in-flight dedup as the tab itself — zero extra requests if
      // the tab mounts before this resolves.
      try {
        const { fetchMatchesByDate } = await import('../components/Matches/leagueApiUtils');
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        fetchMatchesByDate(today).catch(() => {});
        fetchMatchesByDate(yesterday).catch(() => {});
        logger.debug('[PreloadInitializer] Matches cache prime triggered (non-blocking)');
      } catch (err) {
        logger.warn('[PreloadInitializer] Matches cache prime failed (non-critical):', err);
      }

      if (cancelled) return;

      // Prime /clerk/me memory cache before tabs mount — faster profile tab
      if (isSignedIn) {
        try {
          const token = await getClerkBearerToken(getTokenRef.current);
          if (token && !cancelled) {
            await AuthService.syncUserWithBackend(token, {
              getToken: getTokenRef.current,
            }).catch((e) =>
              logger.warn('[PreloadInitializer] Early profile sync failed (non-critical):', e)
            );
          }
        } catch (e) {
          logger.warn('[PreloadInitializer] Early profile sync error:', e);
        }

        /*
         * Share & Win referral attribution.
         *
         * Runs immediately AFTER syncUserWithBackend, so the backend account
         * exists before we claim — that ordering is what makes "attribute only
         * on successful registration" true. Cancelled or abandoned sign-ups
         * never reach this point, so they never create a participant.
         *
         * Safe to run on every launch: the device short-circuits once claimed,
         * and the backend enforces one referrer per user regardless.
         */
        if (!cancelled) {
          try {
            const { redeemPendingReferral } = await import('../hooks/useShareWin');
            await redeemPendingReferral(getTokenRef.current);
          } catch (e) {
            logger.warn('[PreloadInitializer] Referral claim failed (non-critical):', e);
          }
        }
      }

      if (cancelled) return;

      try {
        const CACHE_CLEAR_FLAG = 'profile_cache_cleared_v1';
        const alreadyCleared = await cacheService.get(CACHE_CLEAR_FLAG);

        if (!alreadyCleared) {
          logger.info('[PreloadInitializer] Clearing old profile cache (one-time fix)');
          await cacheService.invalidate('PROFILE_DATA');
          await cacheService.set(CACHE_CLEAR_FLAG, true, 365 * 24 * 60 * 60);
          logger.info('[PreloadInitializer] ✅ Old profile cache cleared');
        }
      } catch (err) {
        logger.warn('[PreloadInitializer] Failed to clear old profile cache (non-critical):', err);
      }

      if (cancelled) return;

      // Don't wipe match calendars during first paint — cleanup used to delete
      // today's snapshot (short TTL) and force a blank spinner after app kill.
      cleanupTimer = setTimeout(() => {
        if (cancelled) return;
        cacheService.cleanup().catch(err => {
          logger.warn('[PreloadInitializer] Cache cleanup failed (non-critical):', err);
        });
      }, 15_000);

      if (isSignedIn) {
        const tokenGetter = createClerkTokenGetter(getTokenRef.current);
        const token = await tokenGetter();
        if (token && !cancelled) {
          preloadManager.initialize(tokenGetter).catch((err) =>
            logger.warn('[PreloadInitializer] Failed to initialize preloading:', err),
          );
        }
      }
    };

    let startTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      startTimer = setTimeout(() => {
        void run();
      }, 1500);
    });

    return () => {
      interactionHandle.cancel?.();
      if (startTimer) clearTimeout(startTimer);
      cancelled = true;
      if (cleanupTimer) clearTimeout(cleanupTimer);
      if (!isSignedIn) {
        preloadManager.cleanup();
      }
    };
  }, [isSignedIn, isLoaded]);

  return <>{children}</>;
}

// Key to persist RTL reload flag across app restarts (prevents infinite reload loop)
const RTL_RELOAD_FLAG_KEY = '@rtl_reload_requested_v1';

function LanguageInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useLanguageStore(state => state.initialize);
  const isInitialized = useLanguageStore(state => state.isInitialized);
  const [forceShow, setForceShow] = React.useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Layout stays LTR for all languages. forceRTL is cleared without
  // Updates.reloadAsync — a cold start may be needed once for native mirror
  // to fully reset on devices that previously ran Arabic in RTL mode.
  useEffect(() => {
    if (!isInitialized) return;
    if (I18nManager.isRTL) {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }
    AsyncStorage.removeItem(RTL_RELOAD_FLAG_KEY).catch(() => {});
  }, [isInitialized]);

  // Safety net: never block boot longer than 5s
  useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (forceShow || isInitialized) {
    return <>{children}</>;
  }

  return <BootSplashScreen />;
}

function RootLayout() {
  // ── Load Poppins (Latin) + Cairo (Arabic) globally ────────────────────
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Apply once fonts are registered so every <Text> defaults to Poppins.
  useEffect(() => {
    if (fontsLoaded) applyGlobalFont();
  }, [fontsLoaded]);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      logger.debug('[DeepLink] Received:', url);

      if (/auth-callback/i.test(url)) {
        return;
      }

      const navigateToReel = (reelId: string) => {
        router.push({
          pathname: '/(tabs)/reels',
          params: { reelId },
        });
      };

      const navigateToProfile = (username: string) => {
        router.push({
          pathname: '/user/[username]',
          params: { username },
        });
      };

      /*
       * Share & Win referral. Parked before anything else so the code survives
       * a fresh install → store → onboarding → registration journey; it is
       * redeemed once, after the account exists. Attribution is decided by the
       * backend, never here.
       */
      const referralCode = parseReferralCodeFromUrl(url);
      if (referralCode) {
        void capturePendingReferral(referralCode).then(() => {
          router.push('/share-win');
        });
        return;
      }

      const profileUsername = parseProfileUsernameFromUrl(url);
      if (profileUsername) {
        navigateToProfile(profileUsername);
        return;
      }

      const groupCode = parseGroupCodeFromUrl(url);
      if (groupCode) {
        router.push({
          pathname: '/prediction-groups',
          params: { joinCode: groupCode },
        });
        return;
      }

      const reelId = parseReelIdFromUrl(url);
      if (reelId) {
        navigateToReel(reelId);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Only run version check once — prevent re-render triggering multiple calls
    let didRun = false;
    const checkVersion = async () => {
      if (didRun) return;
      didRun = true;
      try {
        const { checkAppVersion, showUpdateDialog, showMaintenanceDialog } = await import('../services/appVersionService');
        const versionInfo = await checkAppVersion();

        if (versionInfo) {
          if (versionInfo.maintenance) {
            showMaintenanceDialog(versionInfo);
          } else if (versionInfo.needsUpdate) {
            showUpdateDialog(versionInfo);
          }
        }
      } catch (error) {
        logger.warn('Failed to check app version:', error);
      }
    };

    checkVersion();
  }, []); // Empty deps — run once on mount only

  useEffect(() => {
    const initializeAudioAndAssets = async () => {
      await configureAudioVideo();
    };
    initializeAudioAndAssets();

    // Fix 1.5: batch prefetch with 5s delay — max 30 logos, batch 5, 100ms between batches
    const loadLogosAndPrefetch = async () => {
      try {
        const { preloadClubLogos } = await import('../services/clubLogoService');
        await preloadClubLogos(CLUBS);

        const logoPromises = CLUBS.map(async (club) => {
          if (club.apiId && !club.logo) {
            const { getClubLogo } = await import('../services/clubLogoService');
            const logo = await getClubLogo(club.apiId);
            if (logo) { club.logo = logo; }
          }
        });
        await Promise.allSettled(logoPromises);

        const clubImages = CLUBS.map(c => c.logo).filter((url): url is string => !!url && url.length > 0);
        const brandImages = BRANDS.map(b => b.logo).filter((url): url is string => !!url && url.length > 0);
        const allImages = [...clubImages, ...brandImages].slice(0, 30);

        const batchSize = 5;
        for (let i = 0; i < allImages.length; i += batchSize) {
          const batch = allImages.slice(i, i + batchSize);
          await Promise.allSettled(batch.map(url => Image.prefetch(url)));
          if (i + batchSize < allImages.length) {
            await new Promise<void>(r => setTimeout(r, 100));
          }
        }
      } catch (err) {
        logger.warn('[RootLayout] Logo loading/prefetch failed:', err);
      }
    };

    // Delay logos until after app is interactive (Fix 1.5)
    setTimeout(() => {
      loadLogosAndPrefetch().catch(err => {
        logger.warn('[RootLayout] Logo loading failed:', err);
      });
    }, 5000);

    cacheService.cleanup().catch(err => {
      logger.warn('[RootLayout] Cache cleanup failed (non-critical):', err);
    });

    cacheService.clearSearchCache().catch(err => {
      logger.warn('[RootLayout] Search cache clear failed (non-critical):', err);
    });

  }, []);

  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    logger.error('App Error:', error.message);
    logger.error('Component Stack:', errorInfo.componentStack);
    
    // Send error to Sentry with React error boundary context
    try {
      captureException(error, {
        tags: {
          errorBoundary: 'RootLayout',
          platform: 'mobile',
        },
        extra: {
          componentStack: errorInfo.componentStack,
        },
        level: 'error',
      });
    } catch (sentryError) {
      // If Sentry fails, just log it - don't break the app
      logger.warn('[RootLayout] Failed to send error to Sentry:', sentryError);
    }
  };

  const handleGoHome = () => {
    try {
      router.replace('/');
    } catch (e) {
      logger.warn('Failed to navigate home:', e);
    }
  };

  // Hold the UI behind the splash screen until Poppins is ready.
  // The splash is already visible (we call preventAutoHideAsync above), so
  // returning null here keeps the native splash up instead of flashing fallback
  // system fonts. A safety fallback ensures we never block forever on a
  // missing font download.
  const [fontTimeout, setFontTimeout] = React.useState(false);
  const fontsReady = fontsLoaded || fontTimeout;
  useEffect(() => {
    if (fontsLoaded) return;
    const t = setTimeout(() => setFontTimeout(true), 4000);
    return () => clearTimeout(t);
  }, [fontsLoaded]);

  // Solid brand color if native splash drops before fonts are ready — avoids a
  // blank white frame on iOS release builds.
  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: '#4A148C' }} />;
  }

  return (
    <OtaPendingReloadGate>
      {!clerkPublishableKey ? (
        <ClerkKeyMissingScreen />
      ) : (
        <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
          <ErrorBoundary onError={handleError} onGoHome={handleGoHome}>
            <TamaguiProvider config={config} defaultTheme="dark">
              <BootReadyProvider>
                <HideSplashWhenReady fontsReady={fontsReady} />
                <SentryUserTracker />
                <QueryClientProvider client={queryClient}>
                  <OtaUpdateBootstrap />
                  <FootballCacheEpochBootstrap />
                  <PushNotificationSetup />
                  <PushRegistrationReportBootstrap />
                  <LanguageInitializer>
                    <LanguageProvider>
                      <SettingsProvider>
                        <CoinsProvider>
                          <XpProvider>
                            <VideosProvider>
                              <ToastProvider>
                                <ProfessionalToastProvider>
                                  <GestureHandlerRootView style={{ flex: 1 }}>
                                    <SafeAreaProvider>
                                      <AppKeyboardProvider>
                                        <View style={{ flex: 1, backgroundColor: '#000' }}>
                                          <GlobalOfflineBanner />
                                          <StatusBar
                                            barStyle="light-content"
                                            backgroundColor="#000"
                                          />
                                          <ClerkGate>
                                            <ClerkTokenWarmup />
                                            <PushTokenSyncBootstrap />
                                            <GlobalNotificationTrayBridge />
                                            <WebSocketInitializer>
                                              <PreloadInitializer>
                                                <RootLayoutNav />
                                              </PreloadInitializer>
                                            </WebSocketInitializer>
                                          </ClerkGate>
                                          <LevelUpModal />
                                        </View>
                                      </AppKeyboardProvider>
                                    </SafeAreaProvider>
                                  </GestureHandlerRootView>
                                </ProfessionalToastProvider>
                              </ToastProvider>
                            </VideosProvider>
                          </XpProvider>
                        </CoinsProvider>
                      </SettingsProvider>
                    </LanguageProvider>
                  </LanguageInitializer>
                </QueryClientProvider>
              </BootReadyProvider>
            </TamaguiProvider>
          </ErrorBoundary>
        </ClerkProvider>
      )}
    </OtaPendingReloadGate>
  );
}

export default Sentry.wrap(RootLayout);