import React, { useCallback, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LIQUID_TAB_ITEMS,
  LiquidGlassTabBar,
} from '../../components/navigation/LiquidGlassTabBar';
import { useProfileTabAvatar } from '../../components/navigation/useProfileTabAvatar';
import { prefetchRoute, prefetchRoutes } from '../../utils/routePrefetcher';

function resolveActiveIndex(pathname: string | null): number {
  const p = (pathname ?? '').toLowerCase();

  if (p.includes('match-details') || p.includes('matches')) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'matches');
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
  if (p.includes('/rank')) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'rank');
  }
  if (p.includes('/reels')) {
    return LIQUID_TAB_ITEMS.findIndex((t) => t.id === 'reels');
  }

  const found = LIQUID_TAB_ITEMS.findIndex((tab) => {
    const route = String(tab.route).toLowerCase();
    const stripped = route.replace(/\/\([^)]+\)/g, '');
    return p === route || p === stripped || p.endsWith(stripped);
  });

  return found >= 0 ? found : 0;
}

const BottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const profileAvatarUrl = useProfileTabAvatar();

  const isChat = pathname?.includes('chat');
  const isQuiz = pathname?.includes('quiz');
  const hidden = isChat || isQuiz;

  const activeIndex = useMemo(
    () => resolveActiveIndex(pathname),
    [pathname],
  );

  useEffect(() => {
    prefetchRoutes(LIQUID_TAB_ITEMS.map((tab) => String(tab.route))).catch(() => {});
  }, []);

  const handleNavigate = useCallback(
    (index: number) => {
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
      router.replace(tab.route as any);
    },
    [pathname, router],
  );

  const handleTabPressIn = useCallback((index: number) => {
    const tab = LIQUID_TAB_ITEMS[index];
    if (!tab) return;

    prefetchRoute(String(tab.route)).catch(() => {});
    const adjacent = [LIQUID_TAB_ITEMS[index - 1], LIQUID_TAB_ITEMS[index + 1]]
      .filter(Boolean)
      .map((t) => String(t!.route));
    if (adjacent.length > 0) prefetchRoutes(adjacent).catch(() => {});
  }, []);

  if (hidden) return null;

  return (
    <LiquidGlassTabBar
      activeIndex={activeIndex}
      onNavigate={handleNavigate}
      profileAvatarUrl={profileAvatarUrl}
      bottomInset={insets.bottom}
      onTabPressIn={handleTabPressIn}
    />
  );
};

export default BottomNav;
