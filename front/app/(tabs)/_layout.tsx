import { Tabs, useRouter, usePathname } from "expo-router";
import { User, Video, Brain, BarChart2, Gift } from "lucide-react-native";
import React, { useEffect } from "react";
import { Animated, BackHandler, View } from 'react-native';
import BottomNav from '@/components/navigation/BottomNav';
import { useLiveFixtureSync } from '../../hooks/useLiveFixtureSync';

function LiveFixtureSyncBootstrap() {
  useLiveFixtureSync();
  return null;
}

const TAB_STACK_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#000' },
  lazy: true,
  freezeOnBlur: true,
} as const;

function isLandingTab(pathname: string | null): boolean {
  const p = (pathname ?? '').toLowerCase();
  return p === '/matches' || p.endsWith('/matches');
}

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let backPressCount = 0;
    let backPressTimer: ReturnType<typeof setTimeout>;

    const backAction = () => {
      if (isLandingTab(pathname)) {
        backPressCount++;

        if (backPressCount === 2) {
          return false;
        }

        backPressTimer = setTimeout(() => {
          backPressCount = 0;
        }, 2000);

        return true;
      }

      router.replace('/(tabs)/matches');
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => {
      backHandler.remove();
      if (backPressTimer) {
        clearTimeout(backPressTimer);
      }
    };
  }, [pathname, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <LiveFixtureSyncBootstrap />
      <Tabs
        initialRouteName="matches"
        screenOptions={{
          ...TAB_STACK_OPTIONS,
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
        <Tabs.Screen
          name="matches"
          options={{
            title: "Matches",
            tabBarIcon: ({ color, focused }) => (
              <Animated.View
                style={{
                  transform: [
                    { scale: focused ? 1.1 : 1 },
                    { translateY: focused ? -2 : 0 }
                  ],
                  opacity: focused ? 1 : 0.7
                }}
              >
                <Video color={color} size={24} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="rank"
          options={{
            title: "Rankings",
            tabBarIcon: ({ color, focused }) => (
              <Animated.View
                style={{
                  transform: [
                    { scale: focused ? 1.1 : 1 },
                    { translateY: focused ? -2 : 0 }
                  ],
                  opacity: focused ? 1 : 0.7
                }}
              >
                <BarChart2 color={color} size={24} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="predict-and-win"
          options={{
            title: "Sponsors",
            tabBarIcon: ({ color, focused }) => (
              <Animated.View
                style={{
                  transform: [
                    { scale: focused ? 1.1 : 1 },
                    { translateY: focused ? -2 : 0 }
                  ],
                  opacity: focused ? 1 : 0.7
                }}
              >
                <Gift color={color} size={24} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Animated.View
                style={{
                  transform: [
                    { scale: focused ? 1.1 : 1 },
                    { translateY: focused ? -2 : 0 }
                  ],
                  opacity: focused ? 1 : 0.7
                }}
              >
                <User color={color} size={24} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="quiz"
          options={{
            href: null,
            title: "Quiz",
            tabBarIcon: ({ color, focused }) => (
              <Animated.View
                style={{
                  transform: [
                    { scale: focused ? 1.1 : 1 },
                    { translateY: focused ? -2 : 0 }
                  ],
                  opacity: focused ? 1 : 0.7
                }}
              >
                <Brain color={color} size={24} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="reels"
          options={{
            href: null,
            title: "Reels",
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="aboutUs"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="match-details"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="Home" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="privacy-settings" options={{ href: null }} />
        <Tabs.Screen name="my-reports" options={{ href: null }} />
      </Tabs>
      <BottomNav />
    </View>
  );
}
