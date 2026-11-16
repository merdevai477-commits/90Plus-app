import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/src/i18n';
import { prefetchCommunityFeed } from '@/hooks/community/useCommunityFeed';
import { prefetchRoute, prefetchRoutes } from '@/utils/routePrefetcher';

import { AiChatFab } from './AiChatFab';
import {
  GlassCapsuleNav,
  useGlassNavColors,
  type GlassCapsuleItem,
  type GlassCapsuleMetrics,
} from './GlassCapsuleNav';
import { BuiltInTabIcon, LIQUID_TAB_ITEMS } from './LiquidGlassTabBar';
import { TAB_BAR_HEIGHT, TAB_BAR_HORIZONTAL_MARGIN } from './liquidGlassTabBar.constants';
import type { LiquidTabId } from './liquidGlassTabBar.types';
import { useProfileTabAvatar } from './useProfileTabAvatar';

/** AI lives on the floating FAB — keep the capsule to the other five tabs. */
const BAR_TAB_ITEMS = LIQUID_TAB_ITEMS.filter((tab) => tab.id !== 'ai');
const AI_TAB = LIQUID_TAB_ITEMS.find((tab) => tab.id === 'ai')!;
const AI_ROUTE = String(AI_TAB.route);

/** Five tabs share the row, so the capsule runs a touch roomier than six. */
const MAIN_METRICS: Partial<GlassCapsuleMetrics> = {
  height: TAB_BAR_HEIGHT,
  pad: 5,
  gap: 2,
  idle: 52,
  minIdle: 40,
  icon: 20,
  font: 12,
  labelGap: 6,
  trail: 14,
};

/** Lift the FAB clear of the capsule so it reads as floating, not docked. */
const FAB_LIFT = TAB_BAR_HEIGHT + 8;

function resolveActiveIndex(pathname: string | null): number {
  const p = (pathname ?? '').toLowerCase();

  if (p.includes('match-details') || (p.includes('matches') && !p.includes('predict-and-win'))) {
    return BAR_TAB_ITEMS.findIndex((t) => t.id === 'matches');
  }
  if (p.includes('reels')) {
    return BAR_TAB_ITEMS.findIndex((t) => t.id === 'reels');
  }
  if (p.includes('community')) {
    return BAR_TAB_ITEMS.findIndex((t) => t.id === 'community');
  }
  if (
    p.includes('/profile') ||
    p.includes('/notifications') ||
    p.includes('/settings')
  ) {
    return BAR_TAB_ITEMS.findIndex((t) => t.id === 'profile');
  }
  if (
    p.includes('/rank') ||
    p.includes('king-of-predictions') ||
    p.includes('predict-and-win')
  ) {
    return BAR_TAB_ITEMS.findIndex((t) => t.id === 'rank');
  }

  const found = BAR_TAB_ITEMS.findIndex((tab) => {
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
  const navColors = useGlassNavColors();

  const isChat = pathname?.includes('chat');
  const isPredictAndWinStack = /predict-and-win\/.+/.test(pathname ?? '');
  const isMatchDetails = pathname?.includes('match-details');
  const isCommunityStack = /\/community\/.+/.test(pathname ?? '');
  const hidden = isChat || isPredictAndWinStack || isMatchDetails || isCommunityStack;

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

      const tab = BAR_TAB_ITEMS[index];
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

  const openAiChat = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.navigate(AI_ROUTE as any);
  }, [router]);

  const qc = useQueryClient();
  const { getToken, isSignedIn } = useAuth();

  const handleTabPressIn = useCallback(
    (index: number) => {
      if (index === activeIndex) return;
      const tab = BAR_TAB_ITEMS[index];
      if (!tab) return;

      prefetchRoute(String(tab.route)).catch(() => {});
      const adjacent = [BAR_TAB_ITEMS[index - 1], BAR_TAB_ITEMS[index + 1]]
        .filter(Boolean)
        .map((t) => String(t!.route));
      if (adjacent.length > 0) prefetchRoutes(adjacent).catch(() => {});
      if (tab.id === 'community' && isSignedIn) {
        void prefetchCommunityFeed(qc, getToken);
      }
    },
    [activeIndex, getToken, isSignedIn, qc],
  );

  const prefetchAi = useCallback(() => {
    prefetchRoute(AI_ROUTE).catch(() => {});
  }, []);

  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const labels = t.bottomNav;

  const items = useMemo<GlassCapsuleItem<LiquidTabId>[]>(
    () =>
      BAR_TAB_ITEMS.map((tab) => ({
        key: tab.id,
        label: labels[tab.id],
        testID: `bottom-nav-${tab.id}`,
        renderIcon: (active, size) => (
          <BuiltInTabIcon
            icon={tab.icon}
            color={active ? navColors.iconActive : navColors.iconIdle}
            size={size}
            avatarUrl={tab.id === 'profile' ? profileAvatarUrl : undefined}
            accent={navColors.iconActive}
            isActive={active}
          />
        ),
      })),
    [labels, navColors.iconActive, navColors.iconIdle, profileAvatarUrl],
  );

  const indexOf = useCallback(
    (key: LiquidTabId) => BAR_TAB_ITEMS.findIndex((tab) => tab.id === key),
    [],
  );

  if (hidden) return null;

  const activeKey = BAR_TAB_ITEMS[activeIndex]?.id ?? BAR_TAB_ITEMS[0]!.id;

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: Math.max(insets.bottom, 16) }]}>
      <View pointerEvents="box-none" style={styles.fabWrap}>
        <AiChatFab onPress={openAiChat} onPressIn={prefetchAi} />
      </View>
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
  fabWrap: {
    position: 'absolute',
    right: 0,
    bottom: FAB_LIFT,
    zIndex: 2,
  },
});

export default BottomNav;
