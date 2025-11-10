import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar, I18nManager, Platform } from 'react-native';
import { useAppSettings, useTheme, useLanguage } from "../src/store/useAppSettings";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const theme = useTheme();
  const language = useLanguage();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Apply RTL/LTR globally when language changes (requires app reload to fully apply)
  useEffect(() => {
    const shouldRTL = language.direction === 'rtl';
    if (I18nManager.isRTL !== shouldRTL) {
      try {
        I18nManager.allowRTL(shouldRTL);
        I18nManager.forceRTL(shouldRTL);
        if (Platform.OS !== 'web') {
          // Soft notice: full effect after reload
          console.log('Direction changed. Restart app to fully apply.');
        }
      } catch (e) {
        console.warn('Failed to toggle RTL', e);
      }
    }
  }, [language.direction]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar
              barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
              backgroundColor={theme.colors.background}
            />
          <RootLayoutNav />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}