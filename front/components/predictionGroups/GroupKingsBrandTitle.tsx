/**
 * Center header brand — 90 PLUS pill + "Kings" (matches / Live Score style).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { usePGFonts } from './theme';

const ACCENT = '#A855F7';

export function GroupKingsBrandTitle({
  onPress,
  isRTL,
  title = 'Kings',
  compact = false,
}: {
  onPress: () => void;
  isRTL: boolean;
  title?: string;
  /** Fixed header — tighter pill, no extra gap. */
  compact?: boolean;
}) {
  const { extra } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        compact && styles.wrapCompact,
        pressed && { opacity: 0.82 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.logoPill, row]}>
        <Text style={[styles.logo90, { fontFamily: extra }]}>90</Text>
        <View style={styles.plusChip}>
          <Text style={styles.logoPlus}>PLUS</Text>
        </View>
        <View style={[styles.titleDivider, isRTL ? styles.titleDividerRtl : styles.titleDividerLtr]} />
        <Text
          style={[styles.title, compact && styles.titleCompact, { fontFamily: extra }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  wrapCompact: {},
  logoPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 5,
  },
  logo90: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plusChip: {
    backgroundColor: ACCENT,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  logoPlus: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  titleDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  titleDividerLtr: {
    marginLeft: 2,
    marginRight: 1,
  },
  titleDividerRtl: {
    marginLeft: 1,
    marginRight: 2,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  titleCompact: {
    fontSize: 15,
    letterSpacing: -0.3,
  },
});
