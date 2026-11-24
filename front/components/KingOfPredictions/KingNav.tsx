/**
 * Floating capsule switcher for ملك التوقعات — same liquid-glass system as
 * خماسي الهدافين. Fixed order: مباريات / ترتيب / سجل so the bubble moves
 * and labels never swap places.
 */

import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import {
  GlassCapsuleNav,
  useGlassNavColors,
  type GlassCapsuleItem,
} from '../navigation/GlassCapsuleNav';

export type KingTabKey = 'matches' | 'ranking' | 'history';

/** Height of the open capsule slot — keep list padding in sync. */
export const KING_NAV_HEIGHT = 58;

export function kingNavBottom(insetBottom: number): number {
  return Math.max(insetBottom, 12) + 8;
}

export function parseKingTab(value: string | string[] | undefined): KingTabKey | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'matches' || raw === 'ranking' || raw === 'history') return raw;
  if (raw === 'play') return 'matches';
  return null;
}

type KingNavProps = {
  activeTab: KingTabKey;
  onChange: (tab: KingTabKey) => void;
};

export function KingNav({ activeTab, onChange }: KingNavProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.kingPredictions;
  const navColors = useGlassNavColors();

  /** Arabic design order (left → right); English reads the other way. */
  const items = useMemo<GlassCapsuleItem<KingTabKey>[]>(() => {
    const order: KingTabKey[] =
      language === 'ar' ? ['history', 'ranking', 'matches'] : ['matches', 'ranking', 'history'];
    const iconColor = (isActive: boolean) => (isActive ? navColors.iconActive : navColors.iconIdle);
    const labelOf = (key: KingTabKey) => {
      switch (key) {
        case 'matches':
          return copy.tabMatches;
        case 'ranking':
          return copy.tabRanking;
        case 'history':
          return copy.tabHistory;
      }
    };
    return order.map((key) => ({
      key,
      label: labelOf(key),
      renderIcon: (isActive, size) => {
        switch (key) {
          case 'matches':
            return (
              <Ionicons
                name={isActive ? 'calendar' : 'calendar-outline'}
                size={size}
                color={iconColor(isActive)}
              />
            );
          case 'ranking':
            return (
              <Ionicons
                name={isActive ? 'trophy' : 'trophy-outline'}
                size={size}
                color={iconColor(isActive)}
              />
            );
          case 'history':
            return (
              <Ionicons
                name={isActive ? 'time' : 'time-outline'}
                size={size}
                color={iconColor(isActive)}
              />
            );
        }
      },
      testID: `king-nav-${key}`,
    }));
  }, [
    copy.tabHistory,
    copy.tabMatches,
    copy.tabRanking,
    language,
    navColors.iconActive,
    navColors.iconIdle,
  ]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: kingNavBottom(insets.bottom) }]}>
      <GlassCapsuleNav
        items={items}
        activeKey={activeTab}
        onChange={onChange}
        scale={0.88}
        maxWidth={Math.min(width - 24, 360)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
