import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, ErrorInfo } from "react";
import '../services/notificationForegroundSetup';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar, I18nManager, ActivityIndicator, Linking } from 'react-native';
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
import { useLanguageStore } from "../src/i18n";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { logger } from "../services/logger";
import { preloadManager } from "../services/preloadManager";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { initSentry, captureException } from "../services/sentry.service";
import { SentryUserTracker } from "../components/SentryUserTracker";
import { useNavigationTracking } from "../hooks/useNavigationTracking";

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

// Get Clerk publishable key
const clerkPublishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || '';

// Token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

function RootLayoutNav() {
  const { isLoaded } = useAuth();
  
  // Track navigation changes for Sentry breadcrumbs
  useNavigationTracking();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

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
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

import { Image } from "expo-image";
import { CLUBS } from "../data/clubs";
import { BRANDS } from "../data/brands";
import { cacheService } from "../services/cacheService";

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

    // Wake up server on app start (Railway cold start fix)
    const wakeupServer = async () => {
      try {
        const { serverWakeupService } = await import('../services/serverWakeup.service');
        await serverWakeupService.ensureServerAwake();
        logger.debug('[PreloadInitializer] Server wakeup complete');
      } catch (err) {
        logger.warn('[PreloadInitializer] Server wakeup failed (non-critical):', err);
      }
    };

    wakeupServer();

    // One-time profile cache clear to fix shared data bug
    const clearOldProfileCache = async () => {
      try {
        const CACHE_CLEAR_FLAG = 'profile_cache_cleared_v1';
        const alreadyCleared = await cacheService.get(CACHE_CLEAR_FLAG);
        
        if (!alreadyCleared) {
          logger.info('[PreloadInitializer] Clearing old profile cache (one-time fix)');
          
          // Clear old shared profile cache
          await cacheService.invalidate('PROFILE_DATA');
          
          // Mark as cleared
          await cacheService.set(CACHE_CLEAR_FLAG, true, 365 * 24 * 60 * 60); // 1 year
          
          logger.info('[PreloadInitializer] ✅ Old profile cache cleared');
        }
      } catch (err) {
        logger.warn('[PreloadInitializer] Failed to clear old profile cache (non-critical):', err);
      }
    };

    clearOldProfileCache();

    cacheService.cleanup().catch(err => {
      logger.warn('[PreloadInitializer] Cache cleanup failed (non-critical):', err);
    });

    if (isSignedIn && getToken) {
      preloadManager.initialize(getToken).catch(err => {
        logger.warn('[PreloadInitializer] Failed to initialize preloading:', err);
      });
    }

    return () => {
      if (!isSignedIn) {
        preloadManager.cleanup();
      }
    };
  }, [isSignedIn, isLoaded, getToken]);

  return <>{children}</>;
}

function LanguageInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useLanguageStore(state => state.initialize);
  const isInitialized = useLanguageStore(state => state.isInitialized);
  const isRTL = useLanguageStore(state => state.isRTL);
  const didRequestReloadRef = React.useRef(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized) {
      if (I18nManager.isRTL !== isRTL) {
        I18nManager.allowRTL(isRTL);
        I18nManager.forceRTL(isRTL);
        // Applying RTL/LTR requires a full reload for stable layout.
        // Without reload, the UI may "shake" during startup as layout direction changes.
        if (!didRequestReloadRef.current) {
          didRequestReloadRef.current = true;
          Updates.reloadAsync().catch(() => {});
        }
      }
    }
  }, [isInitialized, isRTL]);

  // While direction is mismatched (or we just asked for reload), keep a stable loading screen.
  if (!isInitialized || I18nManager.isRTL !== isRTL || didRequestReloadRef.current) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

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
      console.log('[DeepLink] Received:', url);

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
    const checkVersion = async () => {
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
        console.warn('Failed to check app version:', error);
      }
    };

    checkVersion();
  }, []);

  useEffect(() => {
    const initializeAudioAndAssets = async () => {
      await configureAudioVideo();
    };
    initializeAudioAndAssets();

    const loadLogosAndPrefetch = async () => {
      try {
        const { preloadClubLogos } = await import('../services/clubLogoService');
        await preloadClubLogos(CLUBS);

        const logoPromises = CLUBS.map(async (club) => {
          if (club.apiId && !club.logo) {
            const { getClubLogo } = await import('../services/clubLogoService');
            const logo = await getClubLogo(club.apiId);
            if (logo) {
              club.logo = logo;
            }
          }
        });
        await Promise.allSettled(logoPromises);

        const clubImages = CLUBS.map(c => c.logo).filter(url => url && url.length > 0);
        const brandImages = BRANDS.map(b => b.logo).filter(url => url && url.length > 0);
        const allImages = [...clubImages, ...brandImages];
        if (allImages.length > 0) {
          await Image.prefetch(allImages);
        }
      } catch (err) {
        logger.warn('[RootLayout] Logo loading/prefetch failed:', err);
      }
    };

    loadLogosAndPrefetch().catch(err => {
      logger.warn('[RootLayout] Logo loading failed:', err);
    });

    cacheService.cleanup().catch(err => {
      console.warn('[RootLayout] Cache cleanup failed:', err);
    });

    cacheService.clearSearchCache().catch(err => {
      console.warn('[RootLayout] Search cache clear failed:', err);
    });

    SplashScreen.setOptions({ duration: 500, fade: true });
    SplashScreen.hideAsync().catch(() => {});
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
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        tokenCache={tokenCache}
      >
        <SentryUserTracker />
        <QueryClientProvider client={queryClient}>
          <WebSocketInitializer>
            <PreloadInitializer>
              <LanguageInitializer>
                <LanguageProvider>
                  <SettingsProvider>
                    <CoinsProvider>
                      <VideosProvider>
                        <ToastProvider>
                          <ProfessionalToastProvider>
                            <GestureHandlerRootView>
                              <SafeAreaProvider>
                                <View style={{ flex: 1, backgroundColor: '#000' }}>
                                  <StatusBar
                                    barStyle="light-content"
                                    backgroundColor="#000"
                                  />
                                  <RootLayoutNav />
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
    </ErrorBoundary>
  );
}