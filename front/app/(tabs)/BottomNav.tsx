import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { Home, Brain, User, BarChart3, Video, Sparkles } from 'lucide-react-native';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { prefetchRoute, prefetchRoutes } from '../../utils/routePrefetcher';
import { TAB_COLORS } from '../../constants/tokens';
import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';

const { width } = Dimensions.get('window');

type TabName = keyof typeof TAB_COLORS;

// ─── Custom pitch icon ────────────────────────────────────────────────────────
const PitchIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
    <Line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.5" />
    <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />
    <Rect x="2" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
    <Rect x="18" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
  </Svg>
);

// ─── AI Chat icon — uses lucide Sparkles ─────────────────────────────────────
const AIIcon = ({ color, size }: { color: string; size: number }) => (
  <Sparkles color={color} size={size} strokeWidth={2} />
);

const ICON_COLOR = 'rgba(255,255,255,0.55)';

// ─── Nav Item ─────────────────────────────────────────────────────────────────
interface NavItemProps {
  icon: React.ElementType;
  isActive: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  scaleAnim: Animated.Value;
  activeColor: string;
}

const NavItem = ({ icon: Icon, isActive, onPress, onPressIn, scaleAnim, activeColor }: NavItemProps) => (
  <TouchableOpacity onPress={onPress} onPressIn={onPressIn} style={styles.navItem} activeOpacity={0.7}>
    {/* Outer glow — larger, more diffuse */}
    {isActive && (
      <View style={[styles.glowOuter, { backgroundColor: activeColor, shadowColor: activeColor }]} />
    )}
    <Animated.View
      style={[
        styles.iconContainer,
        isActive && [styles.activeIconContainer, { borderColor: activeColor }],
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Icon color={isActive ? activeColor : ICON_COLOR} size={22} strokeWidth={isActive ? 2.5 : 2} />
    </Animated.View>
  </TouchableOpacity>
);

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
type AppRoute = '/home' | '/matches' | '/quiz' | '/chat' | '/profile' | '/reels' | '/rank';

const BottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const scaleAnims = useRef(
    Array(7).fill(0).map(() => new Animated.Value(1))
  ).current;

  const tabs: { name: TabName; icon: typeof Home | null; customIcon?: boolean; aiIcon?: boolean; route: AppRoute }[] = [
    { name: 'Home',       icon: Home,      route: '/home' },
    { name: 'Leagues',    icon: null,      customIcon: true, route: '/matches' },
    { name: 'AI',         icon: null,      aiIcon: true, route: '/chat' },
    { name: 'Profile',    icon: User,      route: '/profile' },
    { name: 'Highlights', icon: Video,     route: '/reels' },
    { name: 'Rank',       icon: BarChart3, route: '/rank' },
  ];

  const isMatchDetails = pathname?.includes('match-details');
  const isMatches = pathname?.includes('matches');
  const isChat = pathname?.includes('chat');
  const isProfileStack =
    pathname?.includes('/notifications') ||
    pathname?.includes('/settings');
  const activeTab: TabName =
    isMatchDetails || isMatches
      ? 'Leagues'
      : isChat
      ? 'AI'
      : isProfileStack
      ? 'Profile'
      : (tabs.find(tab => pathname === tab.route || pathname?.toLowerCase() === tab.route)?.name ?? 'Home');

  const glassProps = isLiquidGlassSupported
    ? { effect: "clear" as const, interactive: true }
    : { intensity: 20, tint: "dark" as const };

  const GlassWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;

  useEffect(() => {
    const allRoutes = tabs.map(tab => tab.route);
    prefetchRoutes(allRoutes).catch(() => {});
  }, []);

  const handlePressIn = (tab: typeof tabs[number]) => {
    prefetchRoute(tab.route).catch(() => {});
    const currentIndex = tabs.findIndex(t => t.route === tab.route);
    const adjacentRoutes = [
      tabs[currentIndex - 1]?.route,
      tabs[currentIndex + 1]?.route,
    ].filter(Boolean) as string[];
    if (adjacentRoutes.length > 0) prefetchRoutes(adjacentRoutes).catch(() => {});
  };

  const handlePress = (tab: typeof tabs[number], index: number) => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnims[index], { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(tab.route as any);
  };

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.navWrapper}>
        <GlassWrapper {...(glassProps as any)} style={StyleSheet.absoluteFill} />

        {/* Top gradient border — blue→purple */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topBorder}
        />

        {/* Navigation items */}
        <View style={styles.navItemsContainer}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.name;
            const activeColor = TAB_COLORS[tab.name];

            // ── AI tab — special treatment ──────────────────────────────────
            if (tab.aiIcon) {
              return (
                <TouchableOpacity
                  key={tab.name}
                  onPressIn={() => handlePressIn(tab)}
                  onPress={() => handlePress(tab, index)}
                  style={styles.navItem}
                  activeOpacity={0.7}
                >
                  {/* Extra-strong glow for AI tab */}
                  {isActive && (
                    <View style={[styles.glowOuter, styles.aiGlowOuter, { backgroundColor: activeColor, shadowColor: activeColor }]} />
                  )}
                  <Animated.View
                    style={[
                      styles.iconContainer,
                      isActive && [styles.activeIconContainer, styles.aiActiveContainer, { borderColor: activeColor }],
                      { transform: [{ scale: scaleAnims[index] }] },
                    ]}
                  >
                    {/* Gradient background when active */}
                    {isActive && (
                      <LinearGradient
                        colors={['rgba(124,58,237,0.35)', 'rgba(76,29,149,0.2)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    )}
                    <AIIcon color={isActive ? activeColor : ICON_COLOR} size={22} />
                  </Animated.View>
                </TouchableOpacity>
              );
            }

            // ── Pitch (Leagues) custom icon ─────────────────────────────────
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
                    <View style={[styles.glowOuter, { backgroundColor: activeColor, shadowColor: activeColor }]} />
                  )}
                  <Animated.View
                    style={[
                      styles.iconContainer,
                      isActive && [styles.activeIconContainer, { borderColor: activeColor }],
                      { transform: [{ scale: scaleAnims[index] }] },
                    ]}
                  >
                    <PitchIcon color={isActive ? activeColor : ICON_COLOR} size={22} />
                  </Animated.View>
                </TouchableOpacity>
              );
            }

            // ── Standard icon tab ───────────────────────────────────────────
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const NAV_HEIGHT = 56;
const NAV_WIDTH = width - 48;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 24, right: 24,
    alignItems: 'center',
    zIndex: 9999, elevation: 100,
  },
  navWrapper: {
    width: NAV_WIDTH, height: NAV_HEIGHT,
    borderRadius: NAV_HEIGHT / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 18, 28, 0.00)', // Semi-transparent glass base
    borderWidth: 1,
    borderColor: 'rgba(75, 0, 105, 0.47)', // Subtle glass border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 20,
  },
  topBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.5,
    zIndex: 10,
    opacity: 0.6,
  },
  navItemsContainer: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 8,
    zIndex: 20,
  },
  navItem: {
    flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%',
  },

  // Layered glow — outer (larger, more diffuse)
  glowOuter: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    opacity: 0.1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 5,
  },

  iconContainer: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5,
  },
  // AI tab — stronger glow + gradient container
  aiGlowOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0.14,
    shadowOpacity: 0.65,
    shadowRadius: 20,
  },
  aiActiveContainer: {
    overflow: 'hidden',
    borderWidth: 1.5,
  },
});

export default BottomNav;
