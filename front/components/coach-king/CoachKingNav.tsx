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

export type CkTab = 'matches' | 'pitch' | 'ranking';

const iconColor = (active: boolean) => (active ? GLASS_ICON_ACTIVE : GLASS_ICON_IDLE);

const TAB_ICON: Record<CkTab, GlassCapsuleItem<CkTab>['renderIcon']> = {
  matches: (active, size) => (
    <Ionicons name={active ? 'calendar' : 'calendar-outline'} size={size} color={iconColor(active)} />
  ),
  pitch: (active, size) => <MaterialCommunityIcons name="soccer-field" size={size} color={iconColor(active)} />,
  ranking: (active, size) => (
    <Ionicons name={active ? 'trophy' : 'trophy-outline'} size={size} color={iconColor(active)} />
  ),
};

export function ckNavBottom(insetBottom: number): number {
  return Math.max(insetBottom, 12) + 8;
}

export function CoachKingNav({ active, onChange }: { active: CkTab; onChange: (tab: CkTab) => void }) {
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const tabs = t.coachKingGame.tabs;
  const items = useMemo<GlassCapsuleItem<CkTab>[]>(() => {
    const order: CkTab[] = language === 'ar' ? ['ranking', 'pitch', 'matches'] : ['matches', 'pitch', 'ranking'];
    return order.map((key) => ({
      key,
      label: tabs[key],
      renderIcon: TAB_ICON[key],
      testID: `ck-nav-${key}`,
    }));
  }, [language, tabs]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: ckNavBottom(insets.bottom) }]}>
      <GlassCapsuleNav items={items} activeKey={active} onChange={onChange} scale={1} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
