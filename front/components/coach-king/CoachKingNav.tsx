import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import {
  GlassCapsuleNav,
  useGlassNavColors,
  type GlassCapsuleItem,
} from '../navigation/GlassCapsuleNav';

export type CkTab = 'matches' | 'pitch' | 'ranking' | 'info';

export function ckNavBottom(insetBottom: number): number {
  return Math.max(insetBottom, 12) + 8;
}

export function CoachKingNav({ active, onChange }: { active: CkTab; onChange: (tab: CkTab) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const navColors = useGlassNavColors();
  const tabs = t.coachKingGame.tabs;
  const items = useMemo<GlassCapsuleItem<CkTab>[]>(() => {
    const order: CkTab[] =
      language === 'ar'
        ? ['info', 'ranking', 'pitch', 'matches']
        : ['matches', 'pitch', 'ranking', 'info'];
    const iconColor = (isActive: boolean) => (isActive ? navColors.iconActive : navColors.iconIdle);
    return order.map((key) => ({
      key,
      label: tabs[key],
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
          case 'pitch':
            return <MaterialCommunityIcons name="soccer-field" size={size} color={iconColor(isActive)} />;
          case 'ranking':
            return (
              <Ionicons
                name={isActive ? 'trophy' : 'trophy-outline'}
                size={size}
                color={iconColor(isActive)}
              />
            );
          case 'info':
            return (
              <Ionicons
                name={isActive ? 'information-circle' : 'information-circle-outline'}
                size={size}
                color={iconColor(isActive)}
              />
            );
        }
      },
      testID: `ck-nav-${key}`,
    }));
  }, [language, navColors.iconActive, navColors.iconIdle, tabs]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: ckNavBottom(insets.bottom) }]}>
      <GlassCapsuleNav
        items={items}
        activeKey={active}
        onChange={onChange}
        scale={0.92}
        maxWidth={Math.min(width - 24, 420)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
