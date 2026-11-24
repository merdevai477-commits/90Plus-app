/**
 * Floating capsule switcher for ملك التوقعات — same liquid-glass system as
 * خماسي الهدافين / ملك المدربين. Tab order stays fixed so the active bubble
 * moves; labels never swap places between play and ranking.
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

export type KingTabKey = 'play' | 'ranking';

/** Height of the open capsule slot — keep list padding in sync. */
export const KING_NAV_HEIGHT = 58;

export function kingNavBottom(insetBottom: number): number {
  return Math.max(insetBottom, 12) + 8;
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
    const order: KingTabKey[] = language === 'ar' ? ['ranking', 'play'] : ['play', 'ranking'];
    const iconColor = (isActive: boolean) => (isActive ? navColors.iconActive : navColors.iconIdle);
    return order.map((key) => ({
      key,
      // Arabic: سجل + ترتيب (fixed order). English keeps Predict + Ranking.
      label:
        key === 'play'
          ? language === 'ar'
            ? copy.tabHistory
            : copy.tabPredict
          : copy.tabRanking,
      renderIcon: (isActive, size) => {
        if (key === 'ranking') {
          return (
            <Ionicons
              name={isActive ? 'trophy' : 'trophy-outline'}
              size={size}
              color={iconColor(isActive)}
            />
          );
        }
        const playIcon =
          language === 'ar'
            ? isActive
              ? ('time' as const)
              : ('time-outline' as const)
            : ('sparkles' as const);
        return <Ionicons name={playIcon} size={size} color={iconColor(isActive)} />;
      },
      testID: `king-nav-${key}`,
    }));
  }, [
    copy.tabHistory,
    copy.tabPredict,
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
        scale={0.92}
        maxWidth={Math.min(width - 40, 280)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
