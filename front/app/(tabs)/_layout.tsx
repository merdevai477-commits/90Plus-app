import { Tabs, useRouter, usePathname } from "expo-router";
import { Home, User, Video, Brain, BarChart2 } from "lucide-react-native";
import React, { useEffect } from "react";
import { Animated, BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '@/components/navigation/BottomNav';

const TAB_STACK_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#000' },
  // Keep inactive tabs mounted but frozen — faster tab switches, less JS work on blur.
  lazy: true,
  freezeOnBlur: true,
} as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let backPressCount = 0;
    let backPressTimer: ReturnType<typeof setTimeout>;

    const backAction = () => {
      if (pathname === "/Home") {
        backPressCount++;

        if (backPressCount === 2) {
          // If pressed twice quickly, let the app close
          return false;
        }

        // Reset the counter after 2 seconds
        backPressTimer = setTimeout(() => {
          backPressCount = 0;
        }, 2000);

        return true;
      } else {
        // If not on home, navigate to home
        router.replace("/Home");
        return true;
      }
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
      <Tabs
        screenOptions={{
          ...TAB_STACK_OPTIONS,
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
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
          name="Home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Animated.View
                style={{
                  transform: [
                    { scale: focused ? 1.15 : 1 },
                    { translateY: focused ? -3 : 0 }
                  ],
                  opacity: focused ? 1 : 0.7
                }}
              >
                <Home color={color} size={26} />
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
          name="quiz"
          options={{
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
          name="matches"
          options={{
            title: "Highlights",
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
          name="reels"
          options={{
            title: "Highlights",
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
          name="chat"
          options={{
            // No tab icon — navigation handled by BottomNav's AI button.
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
      </Tabs>
      <BottomNav />
    </View>
  );
}