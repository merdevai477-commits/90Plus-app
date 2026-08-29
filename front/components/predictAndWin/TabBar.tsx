/**
 * Hub segmented tab bar — Figma `Component 11` / SwiftUI variants (`636:4598`).
 *
 * 404×67 container, bg #0c051a, 0.5px #1a052d, radius 14, px 16.
 * Row gap 15; idle = Inter Regular 13 #9f9c9c; active = 124×38 pill radius 12,
 * #660db8 fill, Inter SemiBold 14 white. No dividers — the pill swaps position
 * per tab while the visual order stays sponsored → mine → today → all (LTR).
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { CompetitionTab } from '../../services/competitions.service';
import {
  PW,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

/** SwiftUI HStack order (leading → trailing in LTR). */
const TABS_LTR: CompetitionTab[] = ['sponsored', 'mine', 'today', 'all'];

/** RTL mirrors the same reading order with `row-reverse`. */
const TABS_RTL: CompetitionTab[] = ['all', 'today', 'mine', 'sponsored'];

const TAB_PILL_BG = '#660DB8';

export function PredictAndWinTabBar({
  active,
  onChange,
}: {
  active: CompetitionTab;
  onChange: (tab: CompetitionTab) => void;
}) {
  const { t } = useTranslation();
  const { s, f } = usePWScale();
  const { semibold, regular } = usePWFonts();
  const { contentWidth } = usePWContentWidth();
  const dir = usePWDirection();

  const tabs = useMemo(
    () => (dir.isRTL ? TABS_RTL : TABS_LTR),
    [dir.isRTL],
  );

  return (
    <View
      style={[
        styles.bar,
        {
          width: contentWidth,
          height: s(67),
          borderRadius: s(PW_RADII.tabBar),
          paddingHorizontal: s(16),
          flexDirection: dir.row,
          gap: s(15),
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        const label = t.predictAndWin.tabs[tab];

        if (isActive) {
          return (
            <View
              key={tab}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
              style={{
                width: s(124),
                height: s(38),
                padding: s(10),
                borderRadius: s(PW_RADII.pill),
                backgroundColor: TAB_PILL_BG,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Text
                style={{
                  fontFamily: semibold,
                  fontSize: f(14),
                  color: PW.text,
                  textAlign: 'center',
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {label}
              </Text>
            </View>
          );
        }

        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: false }}
            style={{ flexShrink: 1, minWidth: 0 }}
          >
            <Text
              style={{
                fontFamily: regular,
                fontSize: f(13),
                color: PW.textTabIdle,
                textAlign: 'center',
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: PW.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PW.surfaceBorder,
  },
});
