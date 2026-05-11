import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, ErrorInfo } from "react";
import '../services/notificationForegroundSetup';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar, I18nManager, Linking, StyleSheet, Text } from 'react-native';
import * as Updates from 'expo-updates';
import { SettingsProvider } from "../contexts/SettingsContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { CoinsProvider } from "../contexts/CoinsContext";
import { VideosProvider } from "../contexts/VideosContext";
import { ToastProvider } from "../contexts/ToastContext";
import { ProfessionalToastProvider } from '../contexts/ProfessionalToastContext';
import { configureAudioVideo } from "../utils/videoConfig";
import { ClerkProvider } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguageStore } from "../src/i18n";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { logger } from "../services/logger";
import { preloadManager } from "../services/preloadManager";
import { AuthService } from "../src/services/authService";
import { useAuth, useUser } from "@clerk/clerk-expo";
import * as Sentry from '@sentry/react-native';
import { initSentry, captureException } from "../services/sentry.service";
import { SentryUserTracker } from "../components/SentryUserTracker";
import { useNavigationTracking } from "../hooks/useNavigationTracking";
import { AppSplashScreen } from "../components/splash/AppSplashScreen";
import { PushNotificationSetup } from "../src/hooks/usePushNotifications";
import { GlobalOfflineBanner } from "../components/common/GlobalOfflineBanner";
import { useOfflineSync } from "../src/hooks/useOfflineSync";

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

const queryClient = new QueryClient();

// Get Clerk publishable key.
// Priority order:
//   1) EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY env var (works everywhere including
//      production builds where `Constants.expoConfig` can return null)
//   2) `extra.clerkPublishableKey` from app.json (used by default in dev)
// If both are missing we render ClerkKeyMissingScreen instead of silently
// crashing `useAuth` later.
const clerkPublishableKey =
  (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined) ||
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined);

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
        خطأ في الإعداد. يرجى إعادة تثبيت التطبيق.
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

// Token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn('SecureStore getToken error:', err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.warn('SecureStore saveToken error:', err);
      return;
    }
  },
};

function ClerkGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();

  // Fix 3a: hide splash as soon as Clerk is ready
  useEffect(() => {
    if (!isLoaded) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [isLoaded]);

  // Absolute safety — hide splash after 5s no matter what (reduced from 10s)
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(safetyTimer);
  }, []);

  if (!isLoaded) {
    return <AppSplashScreen />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  // Track navigation changes for Sentry breadcrumbs
  useNavigationTracking();

  // Drain offline queue when connectivity returns. Must live inside the
  // Clerk + i18n + toast providers, which is true for any screen the Stack
  // renders.
  useOfflineSync();

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen 
        name="age-gate" 
        options={{ 
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back
        }} 
      />
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
      <Stack.Screen name="user" options={{ headerShown: false }} />
      <Stack.Screen name="player-profile" options={{ headerShown: false }} />
      <Stack.Screen name="team-profile" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

import { Image } from "expo-image";
import { CLUBS } from "../data/clubs";
import { BRANDS } from "../data/brands";
import { cacheService } from "../services/cacheService";
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';

function WebSocketInitializer({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

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
  }, [isSignedIn, isLoaded, user?.id]);

  return <>{children}</>;
}

function PreloadInitializer({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

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
      if (isSignedIn && getToken) {
        try {
          const token = await getToken();
          if (token && !cancelled) {
            await AuthService.syncUserWithBackend(token).catch((e) =>
              logger.warn('[PreloadInitializer] Early profile sync failed (non-critical):', e)
            );
          }
        } catch (e) {
          logger.warn('[PreloadInitializer] Early profile sync error:', e);
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

      cacheService.cleanup().catch(err => {
        logger.warn('[PreloadInitializer] Cache cleanup failed (non-critical):', err);
      });

      if (isSignedIn && getToken) {
        preloadManager.initialize(getToken).catch(err => {
          logger.warn('[PreloadInitializer] Failed to initialize preloading:', err);
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (!isSignedIn) {
        preloadManager.cleanup();
      }
    };
  }, [isSignedIn, isLoaded, getToken]);

  return <>{children}</>;
}

// Key to persist RTL reload flag across app restarts (prevents infinite reload loop)
const RTL_RELOAD_FLAG_KEY = '@rtl_reload_requested_v1';

function LanguageInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useLanguageStore(state => state.initialize);
  const isInitialized = useLanguageStore(state => state.isInitialized);
  const isRTL = useLanguageStore(state => state.isRTL);
  const isReloadingRef = React.useRef(false); // In-flight guard only
  const [reloadFailed, setReloadFailed] = React.useState(false);
  const [forceShow, setForceShow] = React.useState(false);
  // null = unknown, true = already reloaded once, false = not yet
  const [alreadyReloaded, setAlreadyReloaded] = React.useState<boolean | null>(null);

  // Read persisted reload flag on mount
  useEffect(() => {
    AsyncStorage.getItem(RTL_RELOAD_FLAG_KEY)
      .then(val => setAlreadyReloaded(val === 'true'))
      .catch(() => setAlreadyReloaded(false));
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Safety net: after 5s always show children regardless of state
  useEffect(() => {
    const timer = setTimeout(() => {
      // Clear the reload flag in case it caused the loop
      AsyncStorage.removeItem(RTL_RELOAD_FLAG_KEY).catch(() => {});
      setForceShow(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Wait until we know if we already reloaded
    if (!isInitialized || alreadyReloaded === null) return;

    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);

      // CRITICAL: Only reload ONCE across app restarts using AsyncStorage
      // useRef resets on every restart → causes infinite reload loop
      if (!alreadyReloaded && !isReloadingRef.current) {
        isReloadingRef.current = true;
        logger.info('[LanguageInitializer] RTL mismatch — reloading once to fix layout direction');
        AsyncStorage.setItem(RTL_RELOAD_FLAG_KEY, 'true')
          .then(() => Updates.reloadAsync())
          .catch(() => {
            // Reload failed — clear flag and continue without RTL fix
            isReloadingRef.current = false;
            AsyncStorage.removeItem(RTL_RELOAD_FLAG_KEY).catch(() => {});
            setReloadFailed(true);
          });
      } else {
        // Already reloaded once — don't loop. Clear flag for next cold start.
        logger.info('[LanguageInitializer] RTL mismatch after reload — skipping to avoid loop');
        AsyncStorage.removeItem(RTL_RELOAD_FLAG_KEY).catch(() => {});
      }
    } else {
      // RTL is now correct — clear the persisted flag
      AsyncStorage.removeItem(RTL_RELOAD_FLAG_KEY).catch(() => {});
    }
  }, [isInitialized, isRTL, alreadyReloaded]);

  // Safety net fired — show children no matter what
  if (forceShow) return <>{children}</>;

  // Still reading AsyncStorage or initializing language
  if (alreadyReloaded === null || !isInitialized) return <AppSplashScreen />;

  // Reload failed — proceed without RTL fix (better than stuck forever)
  if (reloadFailed) return <>{children}</>;

  // Reload in progress — wait for it (safety net will unblock after 5s)
  if (isReloadingRef.current) return <AppSplashScreen />;

  return <>{children}</>;
}

export default function RootLayout() {
  // Initialize Sentry before app rendering
  useEffect(() => {
    try {
      initSentry();
      logger.info('[RootLayout] Sentry initialized successfully');
    } catch (error) {
      // Handle initialization failures gracefully - log warning but continue startup
      logger.warn('[RootLayout] Sentry initialization failed (non-critical):', error);
    }
  }, []);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      logger.debug('[DeepLink] Received:', url);

      if (url.startsWith('90plus://reel/')) {
        const reelId = url.replace('90plus://reel/', '');
        if (reelId) {
          router.push({
            pathname: '/(tabs)/reels',
            params: { reelId }
          });
        }
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

       SplashScreen.setOptions({ duration: 450, fade: true });
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

  return (
    <ErrorBoundary onError={handleError} onGoHome={handleGoHome}>
      {!clerkPublishableKey ? (
        <ClerkKeyMissingScreen />
      ) : (
      <TamaguiProvider config={config} defaultTheme="dark">
        <ClerkProvider
          publishableKey={clerkPublishableKey}
          tokenCache={tokenCache}
        >
          <SentryUserTracker />
          <QueryClientProvider client={queryClient}>
            <PushNotificationSetup />
            <WebSocketInitializer>
              <PreloadInitializer>
                <LanguageInitializer>
                  <LanguageProvider>
                    <SettingsProvider>
                      <CoinsProvider>
                        <VideosProvider>
                          <ToastProvider>
                            <ProfessionalToastProvider>
                              <GestureHandlerRootView style={{ flex: 1 }}>
                                <SafeAreaProvider>
                                  <View style={{ flex: 1, backgroundColor: '#000' }}>
                                    <GlobalOfflineBanner />
                                    <StatusBar
                                      barStyle="light-content"
                                      backgroundColor="#000"
                                    />
                                    <ClerkGate>
                                      <RootLayoutNav />
                                    </ClerkGate>
                                  </View>
                                </SafeAreaProvider>
                              </GestureHandlerRootView>
                            </ProfessionalToastProvider>
                          </ToastProvider>
                        </VideosProvider>
                      </CoinsProvider>
                    </SettingsProvider>
                  </LanguageProvider>
                </LanguageInitializer>
              </PreloadInitializer>
            </WebSocketInitializer>
          </QueryClientProvider>
        </ClerkProvider>
      </TamaguiProvider>
      )}
    </ErrorBoundary>
  );
}