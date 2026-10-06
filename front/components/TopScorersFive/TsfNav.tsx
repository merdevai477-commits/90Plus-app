/**
 * The switcher that floats over every "خماسي الهدافين" tab — one 404×83 bar at
 * design y 351, lifted off the home indicator the same way King of Predictions
 * lifts its own so the two read as one system.
 */

import { useMemo, type ReactElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import { GlassSurface } from '../KingOfPredictions/GlassSurface';

export type TsfTabKey = 'matches' | 'pitch' | 'ranking';

const TAB_ACTIVE = '#8C5CF5';

const TAB_ICON: Record<TsfTabKey, (size: number) => ReactElement> = {
  matches: (size) => <Ionicons name="calendar-outline" size={size} color="#FFFFFF" />,
  pitch: (size) => <MaterialCommunityIcons name="soccer-field" size={size} color="#FFFFFF" />,
  ranking: (size) => <Ionicons name="trophy-outline" size={size} color="#FFFFFF" />,
};

/**
 * Type size belongs to the tab rather than to its state — across all three
 * designs "الملعب" is 14 and the other two are 12, selected or not. Only the
 * pitch's selected pill narrows, because its label is the short one.
 */
const TAB_METRICS: Record<TsfTabKey, { fontSize: number; activeWidth: number }> = {
  matches: { fontSize: 12, activeWidth: 109 },
  pitch: { fontSize: 14, activeWidth: 86 },
  ranking: { fontSize: 12, activeWidth: 109 },
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
  const fontSemi = useAppFont(600);

  const s = (value: number) => value * scale;

  /** Arabic design order (left → right); English reads the other way. */
  const tabs = useMemo<readonly TsfTabKey[]>(
    () =>
      language === 'ar' ? ['ranking', 'pitch', 'matches'] : ['matches', 'pitch', 'ranking'],
    [language],
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: tsfNavBottom(insets.bottom) }]}
    >
      <GlassSurface
        radius={s(20)}
        tone="muted"
        style={[
          styles.nav,
          { width: s(404), height: s(83), paddingHorizontal: s(20), gap: s(15) },
        ]}
      >
        {tabs.map((tab) => {
          const active = tab === activeTab;
          const metrics = TAB_METRICS[tab];
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onChange(tab)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`tsf-nav-${tab}`}
              style={[
                styles.tab,
                { paddingVertical: s(6) },
                active
                  ? {
                      width: s(metrics.activeWidth),
                      height: s(66),
                      borderRadius: s(12),
                      backgroundColor: TAB_ACTIVE,
                    }
                  : { width: s(109) },
              ]}
            >
              {TAB_ICON[tab](s(24))}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { fontFamily: fontSemi, fontSize: s(metrics.fontSize), marginTop: s(4) },
                ]}
                maxFontSizeMultiplier={1.1}
              >
                {tabsCopy[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050A1A',
    borderWidth: 0.5,
    borderColor: '#A854F7',
    shadowColor: '#5A129E',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  tab: { alignItems: 'center', justifyContent: 'center' },
  label: { color: '#FFFFFF', textAlign: 'center' },
});
