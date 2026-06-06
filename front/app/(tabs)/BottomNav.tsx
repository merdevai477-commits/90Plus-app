import React, { useRef, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import { Home, User, BarChart3, Video, Sparkles } from 'lucide-react-native';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { prefetchRoute, prefetchRoutes } from '../../utils/routePrefetcher';
import { TAB_COLORS } from '../../constants/tokens';
import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';
import { SlidingLiquidBubble } from '../../components/navigation/SlidingLiquidBubble';

const { width } = Dimensions.get('window');

type TabName = keyof typeof TAB_COLORS;

const PitchIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
    <Line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.5" />
    <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />
    <Rect x="2" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
    <Rect x="18" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
  </Svg>
);

const AIIcon = ({ color, size }: { color: string; size: number }) => (
  <Sparkles color={color} size={size} strokeWidth={2} />
);

const ICON_COLOR = 'rgba(255,255,255,0.5)';
const ICON_ACTIVE = '#FFFFFF';

interface NavItemProps {
  icon: React.ElementType;
  isActive: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  scaleAnim: Animated.Value;
}

const NavItem = ({ icon: Icon, isActive, onPress, onPressIn, scaleAnim }: NavItemProps) => (
  <TouchableOpacity onPress={onPress} onPressIn={onPressIn} style={styles.navItem} activeOpacity={0.7}>
    <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Icon color={isActive ? ICON_ACTIVE : ICON_COLOR} size={22} strokeWidth={isActive ? 2.5 : 2} />
    </Animated.View>
  </TouchableOpacity>
);

type AppRoute =
  | '/(tabs)/Home'
  | '/(tabs)/matches'
  | '/(tabs)/quiz'
  | '/(tabs)/chat'
  | '/(tabs)/profile'
  | '/(tabs)/reels'
  | '/(tabs)/rank';

const TABS: { name: TabName; icon: typeof Home | null; customIcon?: boolean; aiIcon?: boolean; route: AppRoute }[] = [
  { name: 'Home', icon: Home, route: '/(tabs)/Home' },
  { name: 'Leagues', icon: null, customIcon: true, route: '/(tabs)/matches' },
  { name: 'AI', icon: null, aiIcon: true, route: '/(tabs)/chat' },
  { name: 'Profile', icon: User, route: '/(tabs)/profile' },
  { name: 'Highlights', icon: Video, route: '/(tabs)/reels' },
  { name: 'Rank', icon: BarChart3, route: '/(tabs)/rank' },
];

const BottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const scaleAnims = useRef(Array(TABS.length).fill(0).map(() => new Animated.Value(1))).current;

  const isMatchDetails = pathname?.includes('match-details');
  const isMatches = pathname?.includes('matches');
  const isChat = pathname?.includes('chat');
  const isQuiz = pathname?.includes('quiz');
  const isProfileStack =
    pathname?.includes('/notifications') || pathname?.includes('/settings');

  useEffect(() => {
    prefetchRoutes(TABS.map((tab) => tab.route)).catch(() => {});
  }, []);

  if (isChat || isQuiz) return null;

  const activeTab: TabName = (() => {
    if (isMatchDetails || isMatches) return 'Leagues';
    if (isChat) return 'AI';
    if (isProfileStack) return 'Profile';
    const p = (pathname ?? '').toLowerCase();
    const found = TABS.find((tab) => {
      const r = tab.route.toLowerCase();
      const stripped = r.replace(/\/\([^)]+\)/g, '');
      return p === r || p === stripped || p.endsWith(stripped);
    });
    return found?.name ?? 'Home';
  })();

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.name === activeTab));

  const barGlassProps = useMemo(
    () =>
      isLiquidGlassSupported
        ? {
            effect: 'clear' as const,
            interactive: false,
            tintColor: 'rgba(255,255,255,0.08)',
            colorScheme: 'dark' as const,
          }
        : { intensity: Platform.OS === 'android' ? 85 : 28, tint: 'dark' as const },
    [],
  );

  const GlassWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;

  const handlePressIn = (tab: (typeof TABS)[number]) => {
    prefetchRoute(tab.route).catch(() => {});
    const currentIndex = TABS.findIndex((t) => t.route === tab.route);
    const adjacentRoutes = [TABS[currentIndex - 1]?.route, TABS[currentIndex + 1]?.route].filter(
      Boolean,
    ) as string[];
    if (adjacentRoutes.length > 0) prefetchRoutes(adjacentRoutes).catch(() => {});
  };

  const handlePress = (tab: (typeof TABS)[number], index: number) => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.spring(scaleAnims[index], { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    const p = (pathname ?? '').toLowerCase();
    const targetStripped = tab.route.toLowerCase().replace(/\/\([^)]+\)/g, '');
    if (p === tab.route.toLowerCase() || p === targetStripped || p.endsWith(targetStripped)) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.replace(tab.route as any);
  };

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.navWrapper}>
        <GlassWrapper {...(barGlassProps as any)} style={StyleSheet.absoluteFill} />

        {!isLiquidGlassSupported && Platform.OS === 'android' ? (
          <View style={styles.androidBarTint} pointerEvents="none" />
        ) : null}

        <View style={styles.barRim} pointerEvents="none" />

        <SlidingLiquidBubble
          activeIndex={activeIndex}
          tabCount={TABS.length}
          navWidth={NAV_WIDTH}
          navHeight={NAV_HEIGHT}
        />

        <View style={styles.navItemsContainer}>
          {TABS.map((tab, index) => {
            const isActive = activeTab === tab.name;

            if (tab.aiIcon) {
              return (
                <TouchableOpacity
                  key={tab.name}
                  onPressIn={() => handlePressIn(tab)}
                  onPress={() => handlePress(tab, index)}
                  style={styles.navItem}
                  activeOpacity={0.7}
                >
                  <Animated.View
                    style={[styles.iconContainer, { transform: [{ scale: scaleAnims[index] }] }]}
                  >
                    <AIIcon color={isActive ? TAB_COLORS.AI : ICON_COLOR} size={22} />
                  </Animated.View>
                </TouchableOpacity>
              );
            }

            if (tab.customIcon) {
              return (
                <TouchableOpacity
                  key={tab.name}
                  onPressIn={() => handlePressIn(tab)}
                  onPress={() => handlePress(tab, index)}
                  style={styles.navItem}
                  activeOpacity={0.7}
                >
                  <Animated.View
                    style={[styles.iconContainer, { transform: [{ scale: scaleAnims[index] }] }]}
                  >
                    <PitchIcon color={isActive ? TAB_COLORS.Leagues : ICON_COLOR} size={22} />
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
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const NAV_HEIGHT = 58;
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
    backgroundColor: isLiquidGlassSupported ? 'transparent' : 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
    }),
  },
  androidBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  barRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NAV_HEIGHT / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 2,
  },
  navItemsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    zIndex: 20,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BottomNav;
