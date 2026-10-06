/**
 * The switcher that floats over every "خماسي الهدافين" tab — the app's
 * liquid-glass capsule, lifted off the home indicator the same way King of
 * Predictions lifts its own so the two read as one system.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import {
  GLASS_ICON_ACTIVE,
  GLASS_ICON_IDLE,
  GlassCapsuleNav,
  type GlassCapsuleItem,
} from '../navigation/GlassCapsuleNav';

export type TsfTabKey = 'matches' | 'pitch' | 'ranking';

const iconColor = (active: boolean) => (active ? GLASS_ICON_ACTIVE : GLASS_ICON_IDLE);

const TAB_ICON: Record<TsfTabKey, GlassCapsuleItem<TsfTabKey>['renderIcon']> = {
  matches: (active, size) => (
    <Ionicons name={active ? 'calendar' : 'calendar-outline'} size={size} color={iconColor(active)} />
  ),
  pitch: (active, size) => <MaterialCommunityIcons name="soccer-field" size={size} color={iconColor(active)} />,
  ranking: (active, size) => (
    <Ionicons name={active ? 'trophy' : 'trophy-outline'} size={size} color={iconColor(active)} />
  ),
};

/** How far the bar sits off the foot of the screen. */
export function tsfNavBottom(insetBottom: number): number {
  return Math.max(insetBottom, 12) + 8;
}

type TsfNavProps = {
  activeTab: TsfTabKey;
  onChange: (tab: TsfTabKey) => void;
  /**
   * Design units → px. The host passes the same height-constrained scale its
   * content uses, so the bar can never outgrow the slot reserved for it.
   */
  scale: number;
};

export function TsfNav({ activeTab, onChange, scale }: TsfNavProps) {
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const tabsCopy = t.topScorersFive.pick.tabs;

  /** Arabic design order (left → right); English reads the other way. */
  const items = useMemo<GlassCapsuleItem<TsfTabKey>[]>(() => {
    const order: TsfTabKey[] =
      language === 'ar' ? ['ranking', 'pitch', 'matches'] : ['matches', 'pitch', 'ranking'];
    return order.map((key) => ({
      key,
      label: tabsCopy[key],
      renderIcon: TAB_ICON[key],
      testID: `tsf-nav-${key}`,
    }));
  }, [language, tabsCopy]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: tsfNavBottom(insets.bottom) }]}>
      <GlassCapsuleNav items={items} activeKey={activeTab} onChange={onChange} scale={scale} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
