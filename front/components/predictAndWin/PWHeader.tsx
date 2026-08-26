/**
 * Shared Predict & Win header — identical on all six Figma screens
 * (`624:4393`, `658:5521`, `666:5850`, `690:1455`, `695:1847`, `696:2186`).
 *
 * Figma: 448×66 bar, bg #0c051a, px 24, inner row 38 tall,
 * back 38 / title 20 SemiBold / bell 32. The status bar above it is the
 * device safe-area inset.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PW, PW_HEADER, usePWDirection, usePWFonts, usePWScale } from './theme';

export function PWHeader({
  title,
  onBack,
  onBell,
}: {
  title: string;
  onBack: () => void;
  onBell?: () => void;
}) {
  const { s, f } = usePWScale();
  const { semibold } = usePWFonts();
  const { isRTL, row } = usePWDirection();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: insets.top + s(PW_HEADER.height) }]}>
      <View
        style={[
          styles.row,
          {
            height: s(PW_HEADER.rowHeight),
            paddingHorizontal: s(PW_HEADER.paddingH),
            flexDirection: row,
          },
        ]}
      >
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button">
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={s(PW_HEADER.backSize)}
            color={PW.text}
          />
        </Pressable>

        <Text
          style={[styles.title, { fontFamily: semibold, fontSize: f(PW_HEADER.titleSize) }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Pressable onPress={onBell} hitSlop={10} accessibilityRole="button" disabled={!onBell}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={s(PW_HEADER.bellSize)}
            color={PW.text}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: PW.surface, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: PW.text, textAlign: 'center' },
});
