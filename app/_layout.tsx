import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar } from 'react-native';
import { SettingsProvider } from "../contexts/SettingsContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { CoinsProvider } from "../contexts/CoinsContext";
import { configureAudioVideo } from "../utils/videoConfig";

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
  useEffect(() => {
    // تكوين الصوت والفيديو
    configureAudioVideo();
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <SettingsProvider>
          <CoinsProvider>
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
          </CoinsProvider>
        </SettingsProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}