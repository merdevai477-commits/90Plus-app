/**
 * Hub segmented tab bar — Figma `Component 11` (`636:4598`, 4 variants).
 *
 * 404×67 container, bg #0c051a, 1px #1a052d, radius 14, px 16, space-between.
 * Selected tab renders as a 124×38 radius-12 gradient pill (#650eb8 → #360961,
 * SemiBold 14 white); the others are plain Regular 13 #9f9c9c text separated by
 * 1×14 #201537 dividers. A divider collapses when it touches the pill.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { CompetitionTab } from '../../services/competitions.service';
import {
  PW,
  PW_GRADIENTS,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

/**
 * "All" reads first — start of the reading order — in both languages, so it
 * sits on the right in Arabic and the left in English.
 */
const TABS: CompetitionTab[] = ['all', 'today', 'mine', 'sponsored'];

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
  const { row } = usePWDirection();

  return (
    <View
      style={[
        styles.bar,
        {
          width: contentWidth,
          height: s(67),
          borderRadius: s(PW_RADII.tabBar),
          paddingHorizontal: s(12),
          flexDirection: row,
        },
      ]}
    >
      {TABS.map((tab, i) => {
        const isActive = tab === active;
        const nextIsActive = TABS[i + 1] === active;
        const showDivider = i < TABS.length - 1 && !isActive && !nextIsActive;
        const label = t.predictAndWin.tabs[tab];

        return (
          <React.Fragment key={tab}>
            {isActive ? (
              // Still announced as a selected tab even though it is not
              // pressable — otherwise a screen reader reads four labels with
              // no indication of which one the list is showing.
              <LinearGradient
                colors={[...PW_GRADIENTS.tabPill]}
                accessible
                accessibilityRole="tab"
                accessibilityState={{ selected: true }}
                style={{
                  // Figma's 124 is the Arabic label's width. English labels are
                  // longer and four fixed-width items overflowed the 404 bar,
                  // so the pill grows from that width instead of being pinned
                  // to it and the idle tabs shrink around it.
                  minWidth: s(96),
                  flexShrink: 1,
                  height: s(38),
                  paddingHorizontal: s(10),
                  borderRadius: s(PW_RADII.pill),
                  alignItems: 'center',
                  justifyContent: 'center',
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
              </LinearGradient>
            ) : (
              <Pressable
                onPress={() => onChange(tab)}
                // The idle tabs are bare text on a 67-tall bar; without slop
                // their touch target is the ~17pt glyph box.
                hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: false }}
                style={{ flexShrink: 1, paddingHorizontal: s(2) }}
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
            )}

            {showDivider ? (
              <View
                style={{ width: 1, height: s(14), backgroundColor: PW.tabDivider, flexShrink: 0 }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PW.surface,
    borderWidth: 1,
    borderColor: PW.surfaceBorder,
  },
});
