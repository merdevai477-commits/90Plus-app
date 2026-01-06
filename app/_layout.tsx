import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, ErrorInfo } from "react";
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar, I18nManager, ActivityIndicator, Linking } from 'react-native';
import { SettingsProvider } from "../contexts/SettingsContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { CoinsProvider } from "../contexts/CoinsContext";
import { VideosProvider } from "../contexts/VideosContext";
import { ToastProvider } from "../contexts/ToastContext";
import { configureAudioVideo } from "../utils/videoConfig";
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useLanguageStore } from "../src/i18n";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { logger } from "../services/logger";
import { preloadManager } from "../services/preloadManager";
import { useAuth, useUser } from "@clerk/clerk-expo";

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
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
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

/**
 * WebSocket Initializer Component
 * 
 * Establishes WebSocket connection on app start and subscribes to relevant events.
 * 
 * Requirements: 21.1, 21.5
 * - 21.1: Establish WebSocket connection on app start
 * - 21.5: Subscribe to relevant events and update UI
 */
function WebSocketInitializer({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Connect to WebSocket when user is signed in
    // Requirement 21.1: Establish WebSocket connection on app start
    if (isSignedIn && user?.id) {
      let unsubscribers: (() => void)[] = [];
      let wsClient: any = null;

      const initWebSocket = async () => {
        try {
          wsClient = await getWebSocketClient();
          logger.info('[WebSocketInitializer] Connecting WebSocket for user:', user.id);
          wsClient.connect(user.id);

          // Subscribe to notification events
          unsubscribers.push(wsClient.subscribe('notification', (message: any) => {
            logger.debug('[WebSocket] Received notification:', message.payload);
          }));

          // Subscribe to comment events
          unsubscribers.push(wsClient.subscribe('comment', (message: any) => {
            logger.debug('[WebSocket] Received comment:', message.payload);
          }));

          // Subscribe to reply events
          unsubscribers.push(wsClient.subscribe('reply', (message: any) => {
            logger.debug('[WebSocket] Received reply:', message.payload);
          }));

          // Subscribe to like events
          unsubscribers.push(wsClient.subscribe('like', (message: any) => {
            logger.debug('[WebSocket] Received like:', message.payload);
          }));

          // Subscribe to follow events
          unsubscribers.push(wsClient.subscribe('follow', (message: any) => {
            logger.debug('[WebSocket] Received follow:', message.payload);
          }));
        } catch (err) {
          logger.warn('[WebSocketInitializer] Failed to initialize WebSocket:', err);
        }
      };

      initWebSocket();

      // Cleanup on unmount or user change
      return () => {
        unsubscribers.forEach(unsub => unsub());
        if (wsClient) {
          wsClient.disconnect();
          logger.info('[WebSocketInitializer] WebSocket disconnected');
        }
      };
    }
  }, [isSignedIn, user?.id]);

  return <>{children}</>;
}

/**
 * Preload Initializer Component
 * 
 * Initializes background data preloading on app start.
 * Preloads data for Profile, Reels, Notifications, and Matches screens.
 * 
 * Requirements: 8.1, 8.5
 * - 8.1: Preload data on app start
 * - 8.5: Set up periodic refresh
 */
function PreloadInitializer({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    // ✅ IMPROVED: Start preloading immediately when user signs in
    if (isSignedIn && getToken) {
      preloadManager.initialize(getToken).catch(err => {
        logger.warn('[PreloadInitializer] Failed to initialize preloading:', err);
      });
    }

    // Cleanup on unmount or logout
    return () => {
      if (!isSignedIn) {
        preloadManager.cleanup();
      }
    };
  }, [isSignedIn, getToken]);

  return <>{children}</>;
}

/**
 * Language Initializer Component
 * 
 * Initializes the language store on app start and applies RTL settings
 * before rendering the main app content.
 * 
 * Requirements: 2.1, 4.1, 4.2
 */
function LanguageInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useLanguageStore(state => state.initialize);
  const isInitialized = useLanguageStore(state => state.isInitialized);
  const isRTL = useLanguageStore(state => state.isRTL);

  useEffect(() => {
    // Initialize language store on mount
    // This will detect device language or load saved preference
    // Requirements: 2.1 - Detect device's system language on first launch
    initialize();
  }, [initialize]);

  useEffect(() => {
    // Apply RTL settings when language changes
    // Requirements: 4.1, 4.2 - Set app direction based on language
    if (isInitialized) {
      if (I18nManager.isRTL !== isRTL) {
        I18nManager.allowRTL(isRTL);
        I18nManager.forceRTL(isRTL);
      }
    }
  }, [isInitialized, isRTL]);

  // Show loading indicator while initializing language
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
  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('[DeepLink] Received:', url);
      
      // Parse deep link: 90plus://reel/:reelId
      if (url.startsWith('90plus://reel/')) {
        const reelId = url.replace('90plus://reel/', '');
        if (reelId) {
          // Navigate to reels page and scroll to specific reel
          router.push({
            pathname: '/(tabs)/reels',
            params: { reelId }
          });
        }
      }
    };

    // Handle initial URL (if app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  // Check app version on mount
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
    // 1. Configure Audio/Video
    configureAudioVideo();

    // 2. Load real club logos from API-Football and prefetch images
    const loadLogosAndPrefetch = async () => {
      try {
        // Load club logos from API-Football
        const { preloadClubLogos } = await import('../services/clubLogoService');
        await preloadClubLogos(CLUBS);
        
        // Update CLUBS with fetched logos
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
        
        // Prefetch all images (clubs + brands)
        const clubImages = CLUBS.map(c => c.logo).filter(url => url && url.length > 0);
        const brandImages = BRANDS.map(b => b.logo).filter(url => url && url.length > 0);
        const allImages = [...clubImages, ...brandImages];
        if (allImages.length > 0) {
          // ✅ SUPER SPEED: Prefetch all images in parallel
          await Image.prefetch(allImages);
        }
      } catch (err) {
        logger.warn('[RootLayout] Logo loading/prefetch failed:', err);
      }
    };
    // ✅ SUPER SPEED: Don't wait for logo loading - do it in background
    loadLogosAndPrefetch().catch(err => {
      logger.warn('[RootLayout] Logo loading failed:', err);
    });

    // 3. Clean up expired cache entries on app start (Requirement 4.5)
    // ✅ SUPER SPEED: Don't wait for cleanup - do it in background
    cacheService.cleanup().catch(err => {
      console.warn('[RootLayout] Cache cleanup failed:', err);
    });

    // 4. Clear old search cache format (one-time migration)
    // This ensures old cached search results with array format are cleared
    cacheService.clearSearchCache().catch(err => {
      console.warn('[RootLayout] Search cache clear failed:', err);
    });

    // 4. Hide Splash - ✅ SUPER SPEED: Hide immediately
    SplashScreen.hideAsync();
  }, []);

  /**
   * Handle errors caught by ErrorBoundary
   * Requirement 7.3: Log error details for debugging
   */
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    logger.error('App Error:', error.message);
    logger.error('Component Stack:', errorInfo.componentStack);
  };

  /**
   * Handle go home action from ErrorBoundary
   * Requirement 7.4: Provide return to home option
   */
  const handleGoHome = () => {
    try {
      router.replace('/');
    } catch (e) {
      // If router fails, just log it
      logger.warn('Failed to navigate home:', e);
    }
  };

  return (
    <ErrorBoundary onError={handleError} onGoHome={handleGoHome}>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        tokenCache={tokenCache}
      >
        <ClerkLoaded>
          <QueryClientProvider client={queryClient}>
            <WebSocketInitializer>
              <PreloadInitializer>
                <LanguageInitializer>
                <LanguageProvider>
                  <SettingsProvider>
                    <CoinsProvider>
                      <VideosProvider>
                        <ToastProvider>
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
                        </ToastProvider>
                      </VideosProvider>
                    </CoinsProvider>
                  </SettingsProvider>
                </LanguageProvider>
                </LanguageInitializer>
              </PreloadInitializer>
            </WebSocketInitializer>
          </QueryClientProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </ErrorBoundary>
  );
}