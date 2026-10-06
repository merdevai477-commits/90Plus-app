import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/src/i18n';
import { prefetchRoute, prefetchRoutes } from '@/utils/routePrefetcher';

import {
  GLASS_ICON_ACTIVE,
  GLASS_ICON_IDLE,
  GlassCapsuleNav,
  type GlassCapsuleItem,
  type GlassCapsuleMetrics,
} from './GlassCapsuleNav';
import { BuiltInTabIcon, LIQUID_TAB_ITEMS } from './LiquidGlassTabBar';
import { TAB_BAR_HEIGHT, TAB_BAR_HORIZONTAL_MARGIN } from './liquidGlassTabBar.constants';
import type { LiquidTabId } from './liquidGlassTabBar.types';
import { useProfileTabAvatar } from './useProfileTabAvatar';

/** Six tabs share the row, so the capsule runs tighter than the three-tab one. */
const MAIN_METRICS: Partial<GlassCapsuleMetrics> = {
  height: TAB_BAR_HEIGHT,
  pad: 5,
  gap: 2,
  idle: 48,
  minIdle: 38,
  icon: 20,
  font: 12,
  labelGap: 6,
  trail: 14,
};

function resolveActiveIndex(pathname: string | null): number {
  const p = (pathname ?? '').toLowerCase();

  if (p.includes('match-details') || (p.includes('matches') && !p.includes('predict-and-win'))) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'matches');
  }
  if (p.includes('reels')) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'reels');
  }
  if (p.includes('chat')) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'ai');
  }
  if (
    p.includes('/profile') ||
    p.includes('/notifications') ||
    p.includes('/settings')
  ) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'profile');
  }
  if (p.includes('/rank') || p.includes('king-of-predictions')) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'rank');
  }
  if (p.includes('predict-and-win')) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'sponsors');
  }

  const found = LIQUID_TAB_ITEMS.findIndex((tab) => {
    const route = String(tab.route).toLowerCase();
    const stripped = route.replace(/\/\([^)]+\)/g, '');
    return p === route || p === stripped || p.endsWith(stripped);
  });

  return found >= 0 ? found : 0;
}

const BottomNav = memo(function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const profileAvatarUrl = useProfileTabAvatar(pathname);

  const isChat = pathname?.includes('chat');
  const isQuiz = pathname?.includes('quiz');
  const isPredictAndWinStack = /predict-and-win\/.+/.test(pathname ?? '');
  const isMatchDetails = pathname?.includes('match-details');
  const hidden = isChat || isQuiz || isPredictAndWinStack || isMatchDetails;

  const activeIndex = useMemo(
    () => resolveActiveIndex(pathname),
    [pathname],
  );

  useEffect(() => {
    prefetchRoutes(LIQUID_TAB_ITEMS.map((tab) => String(tab.route))).catch(() => {});
  }, []);

  const handleNavigate = useCallback(
    (index: number) => {
      if (index === activeIndex) return;

      const tab = LIQUID_TAB_ITEMS[index];
      if (!tab) return;

      const p = (pathname ?? '').toLowerCase();
      const targetStripped = String(tab.route)
        .toLowerCase()
        .replace(/\/\([^)]+\)/g, '');
      const target = String(tab.route).toLowerCase();

      if (p === target || p === targetStripped || p.endsWith(targetStripped)) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.navigate(tab.route as any);
    },
    [activeIndex, pathname, router],
  );

  const handleTabPressIn = useCallback(
    (index: number) => {
      if (index === activeIndex) return;
      const tab = LIQUID_TAB_ITEMS[index];
      if (!tab) return;

      prefetchRoute(String(tab.route)).catch(() => {});
      const adjacent = [LIQUID_TAB_ITEMS[index - 1], LIQUID_TAB_ITEMS[index + 1]]
        .filter(Boolean)
        .map((t) => String(t!.route));
      if (adjacent.length > 0) prefetchRoutes(adjacent).catch(() => {});
    },
    [activeIndex],
  );

  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const labels = t.bottomNav;

  const items = useMemo<GlassCapsuleItem<LiquidTabId>[]>(
    () =>
      LIQUID_TAB_ITEMS.map((tab) => ({
        key: tab.id,
        label: labels[tab.id],
        testID: `bottom-nav-${tab.id}`,
        renderIcon: (active, size) => (
          <BuiltInTabIcon
            icon={tab.icon}
            color={active ? GLASS_ICON_ACTIVE : GLASS_ICON_IDLE}
            size={size}
            avatarUrl={tab.id === 'profile' ? profileAvatarUrl : undefined}
            accent={GLASS_ICON_ACTIVE}
            isActive={active}
          />
        ),
      })),
    [labels, profileAvatarUrl],
  );

  const indexOf = useCallback((key: LiquidTabId) => LIQUID_TAB_ITEMS.findIndex((tab) => tab.id === key), []);

  if (hidden) return null;

  const activeKey = LIQUID_TAB_ITEMS[activeIndex]?.id ?? LIQUID_TAB_ITEMS[0]!.id;

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: Math.max(insets.bottom, 16) }]}>
      <GlassCapsuleNav
        items={items}
        activeKey={activeKey}
        onChange={(key) => handleNavigate(indexOf(key))}
        onPressIn={(key) => handleTabPressIn(indexOf(key))}
        metrics={MAIN_METRICS}
        maxWidth={width - TAB_BAR_HORIZONTAL_MARGIN * 2}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: TAB_BAR_HORIZONTAL_MARGIN,
    right: TAB_BAR_HORIZONTAL_MARGIN,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 100,
  },
});

export default BottomNav;
