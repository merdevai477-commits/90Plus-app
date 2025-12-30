import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Home, Brain, User, BarChart3, Video, Landmark } from 'lucide-react-native';
import Svg, { Rect, Line, Circle, Ellipse } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { prefetchRoute, prefetchRoutes } from '../../utils/routePrefetcher';

const { width } = Dimensions.get('window');

// Tab colors - each tab has its own color
const TAB_COLORS = {
  Home: '#f59e0b',      // Orange
  Leagues: '#22c55e',   // Green (الملعب)
  Quiz: '#3b82f6',      // Blue
  Profile: '#a855f7',   // Purple
  Reels: '#ef4444',     // Red
  Rank: '#ec4899',      // Pink
};

// أيقونة الملعب المخصصة
const PitchIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* الملعب الخارجي */}
    <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
    {/* خط النص */}
    <Line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.5" />
    {/* دائرة النص */}
    <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />
    {/* منطقة الجزاء اليسرى */}
    <Rect x="2" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
    {/* منطقة الجزاء اليمنى */}
    <Rect x="18" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
  </Svg>
);

const ICON_COLOR = 'rgba(255, 255, 255, 0.5)';

interface NavItemProps {
  icon: React.ElementType;
  isActive: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  scaleAnim: Animated.Value;
  activeColor: string;
}

const NavItem = ({
  icon: Icon,
  isActive,
  onPress,
  onPressIn,
  scaleAnim,
  activeColor,
}: NavItemProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      style={styles.navItem}
      activeOpacity={0.7}
    >
      {/* Glow effect behind the icon */}
      {isActive && (
        <View
          style={[
            styles.glowEffect,
            {
              backgroundColor: activeColor,
              shadowColor: activeColor,
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.iconContainer,
          isActive && [
            styles.activeIconContainer,
            { borderColor: activeColor },
          ],
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Icon
          color={isActive ? activeColor : ICON_COLOR}
          size={22}
          strokeWidth={isActive ? 2.5 : 2}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const BottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Animation refs for each tab (6 tabs)
  const scaleAnims = useRef(
    Array(6)
      .fill(0)
      .map(() => new Animated.Value(1))
  ).current;

  type AppRoute = '/Home' | '/leagues' | '/quiz' | '/profile' | '/reels' | '/rank';
  type TabName = 'Home' | 'Leagues' | 'Quiz' | 'Profile' | 'Reels' | 'Rank';

  const tabs: { name: TabName; icon: typeof Home | null; customIcon?: boolean; route: AppRoute }[] = [
    { name: 'Home', icon: Home, route: '/Home' },
    { name: 'Leagues', icon: null, customIcon: true, route: '/leagues' },
    { name: 'Quiz', icon: Brain, route: '/quiz' },
    { name: 'Profile', icon: User, route: '/profile' },
    { name: 'Reels', icon: Video, route: '/reels' },
    { name: 'Rank', icon: BarChart3, route: '/rank' },
  ];

  const isMatchDetails = pathname?.includes('match-details');
  const isLeagues = pathname?.includes('leagues');
  const activeTab = isMatchDetails || isLeagues
    ? 'Leagues'
    : tabs.find((tab) => pathname === tab.route)?.name || 'Home';

  // Prefetch adjacent tabs and popular routes on mount
  useEffect(() => {
    // Prefetch all tab routes for instant navigation
    const allRoutes = tabs.map(tab => tab.route);
    prefetchRoutes(allRoutes).catch(() => {
      // Silent fail for prefetching
    });
  }, []);

  const handlePressIn = (tab: typeof tabs[number]) => {
    // Prefetch on press start (before release) for instant navigation
    prefetchRoute(tab.route).catch(() => {
      // Silent fail
    });
    
    // Prefetch adjacent routes
    const currentIndex = tabs.findIndex(t => t.route === tab.route);
    const adjacentRoutes = [
      tabs[currentIndex - 1]?.route,
      tabs[currentIndex + 1]?.route,
    ].filter(Boolean) as string[];
    
    if (adjacentRoutes.length > 0) {
      prefetchRoutes(adjacentRoutes).catch(() => {
        // Silent fail
      });
    }
  };

  const handlePress = (tab: typeof tabs[number], index: number) => {
    // Light haptic feedback
    Haptics.selectionAsync();

    // Animate press
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    router.push(tab.route);
  };

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.navWrapper}>
        {/* Background blur effect */}
        <BlurView intensity={80} tint="dark" style={styles.blurBackground} />

        {/* Dark overlay */}
        <View style={styles.darkOverlay} />

        {/* Navigation items */}
        <View style={styles.navItemsContainer}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.name;
            const activeColor = TAB_COLORS[tab.name];

            // أيقونة الملعب المخصصة
            if (tab.customIcon) {
              return (
                <TouchableOpacity
                  key={tab.name}
                  onPressIn={() => handlePressIn(tab)}
                  onPress={() => handlePress(tab, index)}
                  style={styles.navItem}
                  activeOpacity={0.7}
                >
                  {isActive && (
                    <View
                      style={[
                        styles.glowEffect,
                        {
                          backgroundColor: activeColor,
                          shadowColor: activeColor,
                        },
                      ]}
                    />
                  )}
                  <Animated.View
                    style={[
                      styles.iconContainer,
                      isActive && [
                        styles.activeIconContainer,
                        { borderColor: activeColor },
                      ],
                      { transform: [{ scale: scaleAnims[index] }] },
                    ]}
                  >
                    <PitchIcon
                      color={isActive ? activeColor : ICON_COLOR}
                      size={22}
                    />
                  </Animated.View>
                </TouchableOpacity>
              );
            }

            return (
              <NavItem
                key={tab.name}
                icon={tab.icon!}
                isActive={isActive}
                onPress={() => handlePress(tab, index)}
                onPressIn={() => handlePressIn(tab)}
                scaleAnim={scaleAnims[index]}
                activeColor={activeColor}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const NAV_HEIGHT = 56;
const NAV_WIDTH = width - 48;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 100,
  },
  navWrapper: {
    width: NAV_WIDTH,
    height: NAV_HEIGHT,
    borderRadius: NAV_HEIGHT / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 25, 25, 0.7)',
  },
  navItemsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  glowEffect: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1.5,
  },
});

export default BottomNav;
